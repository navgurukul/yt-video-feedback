import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import { GoogleGenAI, Type } from '@google/genai';
import { pgPool } from './db.js';
import { authenticate } from './middleware/auth.js';
import { tagEvaluation } from './lib/tenant.js';
import { registerEvaluationRoutes } from './routes/evaluations.js';

// Load environment variables from .env when running via node
dotenv.config();

const app = express();
// app.use(cors());

const CORS_ORIGINS = (process.env.CORS_ORIGINS ||
  'http://localhost:8080,http://localhost:3000,https://master.d33dd8pvqtvje3.amplifyapp.com')
  .split(',').map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Institution-Id']
  })
);
app.use(express.json({ limit: '5mb' }));

// Health endpoint for readiness checks (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Every route below requires a signed-in user with an institution membership.
app.use(authenticate);

// Who am I + which institutions can I use
app.get('/api/me', async (req, res) => {
  const byInst = new Map();
  for (const m of req.memberships) {
    if (!m.institution_id) continue;
    const cur = byInst.get(m.institution_id) || {
      institutionId: m.institution_id, name: m.institution_name, slug: m.slug, logoUrl: m.logo_url, roles: []
    };
    cur.roles.push(m.role);
    byInst.set(m.institution_id, cur);
  }
  const active = await pgPool.query(
    `SELECT id, name, slug, logo_url FROM institutions WHERE id = $1`, [req.tenant.institutionId]);
  res.json({
    email: req.user.email,
    isSuperAdmin: req.tenant.isSuperAdmin,
    role: req.tenant.role,
    memberships: [...byInst.values()],
    activeInstitution: active.rows[0]
      ? { id: active.rows[0].id, name: active.rows[0].name, slug: active.rows[0].slug, logoUrl: active.rows[0].logo_url }
      : null,
  });
});

const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

const isGeminiModelAvailabilityError = (errorString = '') =>
  /model.*(not found|unavailable|unsupported|quota|capacity)|(?:not found|unavailable|unsupported).*model/i.test(errorString) ||
  /not available to new users|going obsolete|no longer available|has been (retired|deprecated)/i.test(errorString) ||
  /not (found|available)|unavailable|NOT_FOUND|obsolete/i.test(errorString);

// PostgreSQL connection configuration
// PostgreSQL pool: see db.js (DB_TARGET selects test / prod / prod-readonly)

// Log whether GEMINI key was loaded (masked) to help debugging local env issues
if (GEMINI_KEY) {
  try {
    const masked = `${GEMINI_KEY.slice(0,4)}...${GEMINI_KEY.slice(-4)}`;
    console.log('GEMINI_KEY loaded from environment (masked):', masked);
  } catch (e) {
    console.log('GEMINI_KEY loaded (length):', GEMINI_KEY.length || 'unknown');
  }
} else {
  console.log('GEMINI_KEY not provided in environment');
}

app.post('/evaluate', async (req, res) => {
  try {
    const { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext, model: requestedModel } = req.body;
    const model = requestedModel || GEMINI_MODELS[0];

    if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });

    if (!GEMINI_MODELS.includes(model)) {
      return res.status(400).json({
        error: {
          type: 'invalid_model',
          message: `Unsupported Gemini model: ${model}`,
          status_code: 400,
          error_code: 'INVALID_MODEL'
        }
      });
    }
    
    // Use API key from request body if provided, otherwise fall back to environment variable
    const effectiveApiKey = apiKey || GEMINI_KEY;
    
    if (!effectiveApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured and not provided in request' });

    // Initialize Google GenAI client with the effective API key
    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

    let contents;
    let config;
      // Build the prompt for accuracy evaluation
      const rubricContent = (rubric && Object.keys(rubric).length > 0) 
        ? `RUBRIC:\n${JSON.stringify(rubric)}`
        : '';

    // Handle different config formats
    // Some configs have generationConfig wrapper, others don't
    let apiConfig;
    if (structuredreturnedconfig.generationConfig) {
      // New format with generationConfig wrapper
      apiConfig = structuredreturnedconfig.generationConfig;
    } else {
      // Old format with direct responseMimeType and responseSchema
      apiConfig = structuredreturnedconfig;
    }

    // Build custom prompt section if provided
    const customPromptContent = customPrompt 
      ? `CUSTOM_PROMPT:
${customPrompt}

`
      : '';

    const promptText = promptbegining+`
          ${customPromptContent}VIDEO DETAILS:
          ${videoDetails}

          ${rubricContent}`;

      contents = [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: videoUrl,
                mimeType: 'video/*',
              }
            },
            {
              text: promptText
            }
          ],
        },
      ];
   
    console.log(`--- Calling Gemini API to evaluate video (${evaluationType} evaluation, streaming response) ---`);

    // Initialize timing and metadata variables OUTSIDE try block so they're available in catch
    const requestTimestamp = new Date();
    const startTime = Date.now();
    let usageMetadata = null;
    let finishReason = null;

    try {

      // Call the streaming API using @google/genai SDK
      const response = await ai.models.generateContentStream({
        model,
        config: apiConfig,
        contents,
      });

      // Collect the streaming response chunks and extract metadata
      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
        // Try to capture usage metadata from chunk
        if (chunk.usageMetadata && !usageMetadata) {
          usageMetadata = chunk.usageMetadata;
        }
        // Try to capture finish reason from chunk
        if (chunk.finishReason && !finishReason) {
          finishReason = chunk.finishReason;
        }
      }

      // Try to capture metadata from response object if not captured from chunks
      if (response.usageMetadata && !usageMetadata) {
        usageMetadata = response.usageMetadata;
      }
      if (response.finishReason && !finishReason) {
        finishReason = response.finishReason;
      }

      // Calculate latency
      const endTime = Date.now();
      const apiLatencyMs = endTime - startTime;

      console.log('--- Stream finished ---');
      console.log(`API Latency: ${apiLatencyMs}ms, Tokens: ${usageMetadata?.totalTokens || 'unknown'}, Finish Reason: ${finishReason || 'unknown'}`);

      // Parse the JSON response
      let parsed = null;
      try {
        parsed = JSON.parse(fullResponse);
      } catch (err) {
        console.warn('Failed to parse JSON from response:', err);
        // If parsing fails, try to extract JSON from the text
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse extracted JSON:', e);
          }
        }
      }

      // Build metrics object
      const metrics = {
        api_latency_ms: apiLatencyMs,
        prompt_tokens: usageMetadata?.promptTokenCount || null,
        completion_tokens: usageMetadata?.candidatesTokenCount || null,
        total_tokens: usageMetadata?.totalTokenCount || null,
        finish_reason: finishReason || 'UNKNOWN',
        model_version: model,
        timestamp: requestTimestamp.toISOString(),
        raw_usage_metadata: usageMetadata || null,
        http_status: 200
      };

      return res.json({ 
        raw: fullResponse, 
        text: fullResponse, 
        parsed,
        metrics,
        error: null
      });
    } catch (error) {
      console.error('An error occurred during the API call:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        code: error.code,
        status: error.status
      });
      
      // Determine appropriate status code and categorize error
      let statusCode = 502; // Default to Bad Gateway
      let errorMessage = 'Upstream model API error';
      let errorType = 'unknown_error';
      let errorCode = error.code || 'UNKNOWN';
      
      const errorString = error.message || String(error);
      errorMessage = errorString;
      const isAuthenticationError =
        errorString.includes('API key not valid') ||
        errorString.includes('API_KEY_INVALID') ||
        errorString.includes('PERMISSION_DENIED') ||
        errorString.includes('permission denied');
      const hasModelErrorHint = isGeminiModelAvailabilityError(errorString);
      const isQuotaError =
        error.status === 429 ||
        /RESOURCE_EXHAUSTED|quota exceeded|daily quota|rate limit/i.test(errorString);
      const isInvalidRequest =
        errorString.includes('INVALID_ARGUMENT') ||
        (error.status === 400 && !hasModelErrorHint);
      const isModelUnavailable =
        !isAuthenticationError &&
        !isQuotaError &&
        !isInvalidRequest &&
        (error.status === 404 ||
          error.status === 408 ||
          error.status >= 500 ||
          error.code === 404 ||
          /temporarily unavailable|service unavailable|high demand|overloaded/i.test(errorString) ||
          /(?:code|status)["']?\s*[:=]\s*50[023]/i.test(errorString) ||
          hasModelErrorHint);
      
      // Categorize error type; keep Gemini's original message for the UI
      if (isQuotaError) {
        statusCode = 429;
        errorType = 'quota_exceeded';
        errorCode = 'QUOTA_EXCEEDED';
      } else if (isModelUnavailable) {
        statusCode = error.status || 503;
        errorType = 'model_unavailable';
        errorCode = 'MODEL_RETRYABLE_ERROR';
      } else if (errorString.includes('API key not valid') || errorString.includes('API_KEY_INVALID')) {
        statusCode = 401;
        errorType = 'invalid_api_key';
        errorCode = 'API_KEY_INVALID';
      } else if (errorString.includes('quota') || errorString.includes('QUOTA_EXCEEDED')) {
        statusCode = 429;
        errorType = 'quota_exceeded';
        errorCode = 'QUOTA_EXCEEDED';
      } else if (errorString.includes('INVALID_ARGUMENT') || error.status === 400) {
        statusCode = 400;
        errorType = 'invalid_argument';
        errorCode = 'INVALID_ARGUMENT';
      } else if (errorString.includes('fetch failed') || errorString.includes('ECONNREFUSED') || errorString.includes('ETIMEDOUT')) {
        statusCode = 503;
        errorType = 'network_error';
        errorCode = 'NETWORK_ERROR';
      } else if (errorString.includes('PERMISSION_DENIED') || errorString.includes('permission denied')) {
        statusCode = 403;
        errorType = 'permission_denied';
        errorCode = 'PERMISSION_DENIED';
      } else if (errorString.includes('UNAVAILABLE') || errorString.includes('unavailable')) {
        statusCode = 503;
        errorType = 'service_unavailable';
        errorCode = 'SERVICE_UNAVAILABLE';
      }
      
      // Build error metrics object
      const errorMetrics = {
        api_latency_ms: Date.now() - startTime,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        finish_reason: null,
        model_version: model,
        timestamp: requestTimestamp.toISOString(),
        raw_usage_metadata: null,
        http_status: statusCode,
        error_message: errorMessage
      };
      
      return res.status(statusCode).json({ 
        raw: null,
        text: null,
        parsed: null,
        metrics: errorMetrics,
        error: {
          type: errorType,
          message: errorMessage, 
          details: errorString,
          status_code: statusCode,
          error_code: errorCode,
          model,
          stacktrace: error.stack || 'No stack trace available'
        }
      });
    }
  } catch (err) {
    console.error('evaluate error', err);
    res.status(500).json({ error: String(err) });
  }
});

// New endpoint to store evaluation results in PostgreSQL
app.post('/store-evaluation', async (req, res) => {
  try {
    const { userId, userEmail, videoUrl, videoType, evaluationData, videoDetails,selectedPhase,selectedVideoTitle, customPrompt, customContext } = req.body;

    console.log('Received request to store evaluation:', { userId, userEmail, videoUrl, videoDetails, selectedPhase, selectedVideoTitle });
    //console.log('Full request body:', JSON.stringify(req.body, null, 2));
    //console.log('Evaluation data:', JSON.stringify(evaluationData, null, 2));
    
    // Log the structure of evaluation_result specifically
    if (evaluationData && evaluationData.evaluation_result) {
      //console.log('Evaluation result structure:', JSON.stringify(evaluationData.evaluation_result, null, 2));
      
      // Log accuracy and abilityToExplain separately
      if (evaluationData.evaluation_result.accuracy) {
        console.log('Accuracy evaluation:', JSON.stringify(evaluationData.evaluation_result.accuracy, null, 2));
      }
      if (evaluationData.evaluation_result.abilityToExplain) {
        console.log('Ability evaluation:', JSON.stringify(evaluationData.evaluation_result.abilityToExplain, null, 2));
      }
    }

    if (!userId || !userEmail || !videoUrl) {
      return res.status(400).json({ error: 'Missing required fields: userId, userEmail, videoUrl' });
    }

    // Store evaluation data in separate tables based on video type
    if (videoType === 'concept') {
      console.log('Storing concept evaluation data:', JSON.stringify(evaluationData, null, 2));
      
      // For concept explanation, we have two evaluations: accuracy and ability to explain
      const accuracyEvaluation = evaluationData.evaluation_result.accuracy;
      const abilityEvaluation = evaluationData.evaluation_result.abilityToExplain;
      
      // Calculate accuracy score and feedback from the new structured format
      let accuracyScore = null;
      let accuracyFeedback = '';
      
      // Extract accuracy score and feedback from the evaluation result
      if (accuracyEvaluation) {
        console.log('Processing accuracy evaluation:', JSON.stringify(accuracyEvaluation, null, 2));
        try {
          // First, check if it's the parsed response object with "Accuracy Level" array
          const parsedAccuracy = accuracyEvaluation.parsed || accuracyEvaluation;
          
          if (parsedAccuracy && parsedAccuracy["Accuracy Level"] && Array.isArray(parsedAccuracy["Accuracy Level"]) && parsedAccuracy["Accuracy Level"].length > 0) {
            // New structured format: Extract from "Accuracy Level" array
            const accuracyItem = parsedAccuracy["Accuracy Level"][0];
            const accuracyLevelString = accuracyItem["Accuracy Level"] || '';
            const feedbackObj = accuracyItem["Feedback"] || {};
            
            // Handle structured feedback (new format with three fields)
            if (typeof feedbackObj === 'object' && feedbackObj !== null) {
              // Store structured feedback as JSON string
              accuracyFeedback = JSON.stringify(feedbackObj);
            } else {
              // Fallback for simple string feedback (backward compatibility)
              accuracyFeedback = feedbackObj || '';
            }
            
            // Try to extract numeric percentage from the accuracy level string
            // Expected format: "85%" or "85 out of 100" or "85/100"
            const percentMatch = accuracyLevelString.match(/(\d+)\s*%/);
            const outOfMatch = accuracyLevelString.match(/(\d+)\s*(?:out of|\/)\s*100/);
            
            if (percentMatch) {
              accuracyScore = parseInt(percentMatch[1], 10);
            } else if (outOfMatch) {
              accuracyScore = parseInt(outOfMatch[1], 10);
            } else {
              // If no numeric value found, try to parse the string as a number
              const numericValue = parseFloat(accuracyLevelString);
              if (!isNaN(numericValue)) {
                accuracyScore = numericValue;
              } else {
                // Store as null if we can't extract a number
                accuracyScore = null;
              }
            }
            
            console.log('Extracted accuracy from structured format:', { accuracyScore, accuracyFeedback });
          }
          // Fallback to old format for backward compatibility
          else if (accuracyEvaluation.criteria && accuracyEvaluation.criteria.length > 0) {
            // Ensure score is between 1-10
            const rawScore = accuracyEvaluation.criteria[0].score;
            accuracyScore = (rawScore >= 1 && rawScore <= 10) ? rawScore : 
                           (rawScore > 10 ? 10 : 
                           (rawScore < 1 ? 1 : rawScore)) || 1;
            accuracyFeedback = accuracyEvaluation.criteria[0].feedback || '';
          } 
          // Fallback to overallScore if criteria is not available
          else if (accuracyEvaluation.overallScore !== undefined) {
            // Ensure score is between 1-10
            const rawScore = accuracyEvaluation.overallScore;
            accuracyScore = (rawScore >= 1 && rawScore <= 10) ? rawScore : 
                           (rawScore > 10 ? 10 : 
                           (rawScore < 1 ? 1 : rawScore)) || 1;
            accuracyFeedback = accuracyEvaluation.overallFeedback || '';
          }
          // Handle text-based evaluations (legacy support)
          else if (accuracyEvaluation.text) {
            console.log('Processing text-based accuracy evaluation');
            // Try to extract JSON from markdown code block
            const codeBlockMatch = accuracyEvaluation.text.match(/```json\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              const jsonText = codeBlockMatch[1];
              console.log('Extracted JSON text from accuracy evaluation:', jsonText);
              const parsedJson = JSON.parse(jsonText);
              console.log('Parsed JSON from accuracy evaluation:', JSON.stringify(parsedJson, null, 2));
              
              // Look for content_evaluation object (based on the actual structure you provided)
              if (parsedJson.content_evaluation) {
                const ce = parsedJson.content_evaluation;
                // Create a composite feedback from the various fields
                const feedbackParts = [];
                if (ce.accuracy) feedbackParts.push(ce.accuracy);
                if (ce.completeness) feedbackParts.push(ce.completeness);
                if (ce.clarity) feedbackParts.push(ce.clarity);
                if (ce.depth) feedbackParts.push(ce.depth);
                if (ce.engagement) feedbackParts.push(ce.engagement);
                
                accuracyFeedback = feedbackParts.join(' ');
                // If the model provided a numeric score field, use it; otherwise leave as null
                if (ce.score !== undefined && !isNaN(Number(ce.score))) {
                  accuracyScore = Number(ce.score);
                } else if (parsedJson.overallScore !== undefined && !isNaN(Number(parsedJson.overallScore))) {
                  accuracyScore = Number(parsedJson.overallScore);
                } else {
                  accuracyScore = null;
                }
                console.log('Extracted accuracy from content_evaluation:', { accuracyScore, accuracyFeedback });
              }
              // Fallback to looking for video_evaluation object (previous structure)
              else if (parsedJson.video_evaluation) {
                const ve = parsedJson.video_evaluation;
                // Create a composite feedback from the various fields
                const feedbackParts = [];
                if (ve.relevance_to_content_type) feedbackParts.push(ve.relevance_to_content_type);
                if (ve.relevance_to_page_details) feedbackParts.push(ve.relevance_to_page_details);
                
                // Handle content_coverage object
                if (ve.content_coverage) {
                  const cc = ve.content_coverage;
                  if (cc.build_profile_page_elements) feedbackParts.push(cc.build_profile_page_elements);
                  
                  if (cc.image_embedding_attributes && cc.image_embedding_attributes.details) {
                    feedbackParts.push(cc.image_embedding_attributes.details);
                  }
                  
                  if (cc.section_organization_tags && cc.section_organization_tags.details) {
                    feedbackParts.push(cc.section_organization_tags.details);
                  }
                  
                  if (cc.unordered_ordered_lists && cc.unordered_ordered_lists.details) {
                    feedbackParts.push(cc.unordered_ordered_lists.details);
                  }
                }
                
                accuracyFeedback = feedbackParts.join(' ');
                // If the model provided numeric fields use them, otherwise leave null
                if (ve.overallScore !== undefined && !isNaN(Number(ve.overallScore))) {
                  accuracyScore = Number(ve.overallScore);
                } else if (ve.score !== undefined && !isNaN(Number(ve.score))) {
                  accuracyScore = Number(ve.score);
                } else {
                  accuracyScore = null;
                }
                console.log('Extracted accuracy from video_evaluation:', { accuracyScore, accuracyFeedback });
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse accuracy evaluation:', e);
          // Set default values if parsing fails
          accuracyScore = null;
          accuracyFeedback = '';
        }
        console.log('Final accuracy values:', { accuracyScore, accuracyFeedback });
      }
      
      // Get ability to explain evaluation level and feedback
      let abilityEvaluationText = '';
      let abilityFeedback = '';
      
      if (abilityEvaluation) {
        console.log('Processing ability evaluation:', JSON.stringify(abilityEvaluation, null, 2));
        try {
          // First, check if it's the parsed response object with "Ability to explain" array
          const parsedAbility = abilityEvaluation.parsed || abilityEvaluation;
          
          if (parsedAbility && parsedAbility["Ability to explain"] && Array.isArray(parsedAbility["Ability to explain"]) && parsedAbility["Ability to explain"].length > 0) {
            // New structured format: Extract from "Ability to explain" array
            const abilityItem = parsedAbility["Ability to explain"][0];
            abilityEvaluationText = abilityItem["Ability to explain"] || '';
            const feedbackObj = abilityItem["Structured Feedback"] || abilityItem["Feedback"] || {};
            
            // Handle structured feedback (new format with three fields)
            if (typeof feedbackObj === 'object' && feedbackObj !== null) {
              // Store structured feedback as JSON string
              abilityFeedback = JSON.stringify(feedbackObj);
            } else {
              // Fallback for simple string feedback (backward compatibility)
              abilityFeedback = feedbackObj || '';
            }
            
            console.log('Extracted ability from structured format:', { abilityEvaluationText, abilityFeedback });
          }
          // Fallback to old format for backward compatibility
          else if (abilityEvaluation.criteria && abilityEvaluation.criteria.length > 0) {
            // The level is in the "name" field of the first criterion
            abilityEvaluationText = abilityEvaluation.criteria[0].name || '';
            abilityFeedback = abilityEvaluation.criteria[0].feedback || '';
          } else if (abilityEvaluation.level) {
            // Fallback to level property if available
            abilityEvaluationText = abilityEvaluation.level;
            abilityFeedback = abilityEvaluation.overallFeedback || '';
          }
        } catch (e) {
          console.warn('Failed to parse ability evaluation:', e);
          // Set default values if parsing fails
          abilityEvaluationText = '';
          abilityFeedback = '';
        }
        console.log('Final ability values:', { abilityEvaluationText, abilityFeedback });
      }
      
      // Insert concept evaluation data into PostgreSQL
      const query = `
        INSERT INTO tbl_ailabs_ytfeedback_concept_evaluations (
          email,
          project_name,
          page_name,
          video_url,
          concept_explanation_accuracy,
          concept_explanation_feedback,
          ability_to_explain_evaluation,
          ability_to_explain_feedback,
          actual_model_used,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        selectedPhase || '',
        selectedVideoTitle || '',
        videoUrl,
        accuracyScore,
        accuracyFeedback,
        abilityEvaluationText,
        abilityFeedback,
        evaluationData.actual_model_used || null
      ];

      console.log('Final concept evaluation values to be stored:', {
        accuracyScore,
        accuracyFeedback,
        abilityEvaluationText,
        abilityFeedback
      });
      console.log('Executing concept evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      const evaluationId = result.rows[0].id;
      await tagEvaluation({
        videoType: 'concept', id: evaluationId, institutionId: req.tenant.institutionId,
        phaseName: selectedPhase, videoTitle: selectedVideoTitle, model: evaluationData?.actual_model_used
      });
      
      console.log('Successfully inserted concept evaluation with ID:', evaluationId);

      // Insert API call metrics into tbl_llm_api_calls
      if (evaluationData.api_calls && Array.isArray(evaluationData.api_calls)) {
        const apiCallsInsertPromises = evaluationData.api_calls.map(apiCall => {
          const metricsQuery = `
            INSERT INTO tbl_llm_api_calls (
              evaluation_id,
              user_email,
              evaluation_type,
              video_type,
              video_url,
              api_call_number,
              request_timestamp,
              api_latency_ms,
              prompt_tokens,
              completion_tokens,
              total_tokens,
              finish_reason,
              model_version,
              http_status,
              error_message,
              raw_usage_metadata,
              institution_id,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          `;
          
          const metricsValues = [
            evaluationId,
            userEmail,
            apiCall.evaluation_type || 'concept',
            videoType,
            videoUrl,
            apiCall.call_number,
            apiCall.metrics?.timestamp || new Date().toISOString(),
            apiCall.metrics?.api_latency_ms || null,
            apiCall.metrics?.prompt_tokens || null,
            apiCall.metrics?.completion_tokens || null,
            apiCall.metrics?.total_tokens || null,
            apiCall.metrics?.finish_reason || null,
            apiCall.metrics?.model_version || null,
            apiCall.metrics?.http_status || (apiCall.error ? 500 : 200),
            apiCall.error?.message || apiCall.metrics?.error_message || null,
            apiCall.metrics?.raw_usage_metadata ? JSON.stringify(apiCall.metrics.raw_usage_metadata) : null,
            req.tenant.institutionId
          ];
          
          return pgPool.query(metricsQuery, metricsValues);
        });
        
        try {
          await Promise.all(apiCallsInsertPromises);
          console.log('Successfully inserted API call metrics');
        } catch (metricsErr) {
          console.error('Error inserting API call metrics:', metricsErr);
          // Don't fail the entire request, just log the error
        }
      }

      // Insert user issues if any were captured
      if (evaluationData.issues && Array.isArray(evaluationData.issues) && evaluationData.issues.length > 0) {
        const issuesInsertPromises = evaluationData.issues.map(issue => {
          const issueQuery = `
            INSERT INTO tbl_user_issues (
              evaluation_id,
              user_email,
              issue_type,
              issue_description,
              error_code,
              stacktrace,
              institution_id,
              resolved,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
          `;
          
          const issueValues = [
            evaluationId,
            userEmail,
            issue.issue_type || 'unknown_error',
            issue.issue_description || 'Unknown error occurred',
            issue.error_code || null,
            issue.stacktrace || null,
            req.tenant.institutionId
          ];
          
          return pgPool.query(issueQuery, issueValues);
        });
        
        try {
          await Promise.all(issuesInsertPromises);
          console.log('Successfully inserted user issues');
        } catch (issuesErr) {
          console.error('Error inserting user issues:', issuesErr);
          // Don't fail the entire request, just log the error
        }
      }
      
      res.json({ 
        success: true, 
        id: evaluationId,
        message: 'Concept evaluation stored successfully' 
      });
    } else if (videoType === 'project') {
      // For project explanation with new structured format
      const projectEvaluation = evaluationData.evaluation_result;
      
     // console.log('Storing project evaluation data:', JSON.stringify(projectEvaluation, null, 2));
      
      // Extract data from the new structured format
      let evaluationText = '';
      let feedbackText = '';
      let evaluationJson = '';
      
      if (projectEvaluation) {
        // The projectEvaluation should contain the parameters array directly
        if (projectEvaluation.parameters && Array.isArray(projectEvaluation.parameters)) {
          // New structured format: Extract from "parameters" array
          evaluationJson = JSON.stringify(projectEvaluation);
          
          // Create a summary text from parameters
          const parameterSummaries = projectEvaluation.parameters.map(param => {
            return `${param.name} (${param.weightage}%): ${param.level}`;
          }).join('; ');
          
          evaluationText = parameterSummaries;
          
          // Combine all feedback into one text - handle both old and new feedback structure
          const allFeedback = projectEvaluation.parameters.map(param => {
            const fb = param.feedback || {};
            
            // Check if it's the new structured format with three specific fields
            if (fb["What could you do well?"] || fb["What can you do better?"] || fb["Next Suggested Deep Dive?"]) {
              return `${param.name}:\n  ✓ What could you do well?: ${fb["What could you do well?"] || 'N/A'}\n  ✗ What can you do better?: ${fb["What can you do better?"] || 'N/A'}\n  ⚠ Next Suggested Deep Dive?: ${fb["Next Suggested Deep Dive?"] || 'N/A'}`;
            }
            // Fallback to old format (good/bad/ugly)
            else {
              return `${param.name}:\n  ✓ Good: ${fb.good || 'N/A'}\n  ✗ Bad: ${fb.bad || 'N/A'}\n  ⚠ Improvements: ${fb.ugly || 'N/A'}`;
            }
          }).join('\n\n');
          
          feedbackText = allFeedback;
          
          // Extracted project data from structured format
          console.log('Extracted project evaluation data');
        }
        // Fallback to old format for backward compatibility
        else {
          evaluationJson = JSON.stringify(projectEvaluation);
          evaluationText = projectEvaluation.overallScore ? `Overall Score: ${projectEvaluation.overallScore}` : '';
          feedbackText = projectEvaluation.overallFeedback || '';
        }
      }
      
      console.log('Final project evaluation values to be stored:', {
        evaluationText: evaluationText.substring(0, 100),
        feedbackText: feedbackText.substring(0, 100),
        evaluationJsonLength: evaluationJson.length
      });
      
      // Insert project evaluation data into PostgreSQL
      const query = `
        INSERT INTO tbl_ailabs_ytfeedback_project_evaluation (
          email,
          project_name,
          video_url,
          project_explanation_evaluation,
          project_explanation_feedback,
          project_explanation_evaluationjson,
          actual_model_used,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        selectedPhase,
        videoUrl,
        evaluationText,
        feedbackText,
        evaluationJson,
        evaluationData.actual_model_used || null
      ];

      //console.log('Executing project evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      const evaluationId = result.rows[0].id;
      await tagEvaluation({
        videoType: 'project', id: evaluationId, institutionId: req.tenant.institutionId,
        phaseName: selectedPhase, videoTitle: selectedVideoTitle, model: evaluationData?.actual_model_used
      });
      
      console.log('Successfully inserted project evaluation with ID:', evaluationId);

      // Insert API call metrics into tbl_llm_api_calls
      if (evaluationData.api_calls && Array.isArray(evaluationData.api_calls)) {
        const apiCallsInsertPromises = evaluationData.api_calls.map(apiCall => {
          const metricsQuery = `
            INSERT INTO tbl_llm_api_calls (
              evaluation_id,
              user_email,
              evaluation_type,
              video_type,
              video_url,
              api_call_number,
              request_timestamp,
              api_latency_ms,
              prompt_tokens,
              completion_tokens,
              total_tokens,
              finish_reason,
              model_version,
              http_status,
              error_message,
              raw_usage_metadata,
              institution_id,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          `;
          
          const metricsValues = [
            evaluationId,
            userEmail,
            apiCall.evaluation_type || 'project',
            videoType,
            videoUrl,
            apiCall.call_number,
            apiCall.metrics?.timestamp || new Date().toISOString(),
            apiCall.metrics?.api_latency_ms || null,
            apiCall.metrics?.prompt_tokens || null,
            apiCall.metrics?.completion_tokens || null,
            apiCall.metrics?.total_tokens || null,
            apiCall.metrics?.finish_reason || null,
            apiCall.metrics?.model_version || null,
            apiCall.metrics?.http_status || (apiCall.error ? 500 : 200),
            apiCall.error?.message || apiCall.metrics?.error_message || null,
            apiCall.metrics?.raw_usage_metadata ? JSON.stringify(apiCall.metrics.raw_usage_metadata) : null,
            req.tenant.institutionId
          ];
          
          return pgPool.query(metricsQuery, metricsValues);
        });
        
        try {
          await Promise.all(apiCallsInsertPromises);
          console.log('Successfully inserted API call metrics');
        } catch (metricsErr) {
          console.error('Error inserting API call metrics:', metricsErr);
          // Don't fail the entire request, just log the error
        }
      }

      // Insert user issues if any were captured
      if (evaluationData.issues && Array.isArray(evaluationData.issues) && evaluationData.issues.length > 0) {
        const issuesInsertPromises = evaluationData.issues.map(issue => {
          const issueQuery = `
            INSERT INTO tbl_user_issues (
              evaluation_id,
              user_email,
              issue_type,
              issue_description,
              error_code,
              stacktrace,
              institution_id,
              resolved,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
          `;
          
          const issueValues = [
            evaluationId,
            userEmail,
            issue.issue_type || 'unknown_error',
            issue.issue_description || 'Unknown error occurred',
            issue.error_code || null,
            issue.stacktrace || null,
            req.tenant.institutionId
          ];
          
          return pgPool.query(issueQuery, issueValues);
        });
        
        try {
          await Promise.all(issuesInsertPromises);
          console.log('Successfully inserted user issues');
        } catch (issuesErr) {
          console.error('Error inserting user issues:', issuesErr);
          // Don't fail the entire request, just log the error
        }
      }
      
      res.json({ 
        success: true, 
        id: evaluationId,
        message: 'Project evaluation stored successfully' 
      });
    } else if (videoType === 'other') {
      // For custom evaluation (other type)
      const customEvaluation = evaluationData.evaluation_result;
      
      console.log('Storing custom evaluation data:', JSON.stringify(customEvaluation, null, 2));
      
      // Extract data from the custom evaluation format
      let overallAssessment = '';
      let criteriaAnalysis = '';
      let feedbackText = '';
      let evaluationJson = '';
      
      if (customEvaluation) {
        try {
          // Handle completely flexible JSON structure
          const parsedCustom = customEvaluation.parsed || customEvaluation;
          
          // Extract the evaluation_result or use the entire structure
          const evaluationData = parsedCustom?.evaluation_result || parsedCustom;
          
          // Store the entire JSON structure
          evaluationJson = JSON.stringify(parsedCustom);
          
          // Try to extract common fields for database storage, but be flexible
          overallAssessment = evaluationData?.["Overall Assessment"] || 
                             evaluationData?.overallAssessment || 
                             evaluationData?.assessment || 
                             evaluationData?.result || 
                             evaluationData?.response ||
                             'Custom evaluation completed';
          
          criteriaAnalysis = evaluationData?.["Criteria Analysis"] || 
                            evaluationData?.analysis || 
                            evaluationData?.summary || 
                            evaluationData?.description || 
                            'See evaluation JSON for details';
          
          // Create a readable feedback text from the entire structure
          const createFeedbackText = (obj, prefix = '') => {
            let text = '';
            for (const [key, value] of Object.entries(obj)) {
              const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              
              if (Array.isArray(value)) {
                text += `${prefix}${formattedKey}:\n`;
                value.forEach((item, idx) => {
                  text += `${prefix}  ${idx + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
                });
                text += '\n';
              } else if (typeof value === 'object' && value !== null) {
                text += `${prefix}${formattedKey}:\n`;
                text += createFeedbackText(value, prefix + '  ');
              } else {
                text += `${prefix}${formattedKey}: ${value}\n`;
              }
            }
            return text;
          };
          
          feedbackText = createFeedbackText(parsedCustom);
          
        } catch (e) {
          console.warn('Failed to parse custom evaluation:', e);
          evaluationJson = JSON.stringify(customEvaluation);
          overallAssessment = 'Custom evaluation completed';
          criteriaAnalysis = 'Parsing error - see JSON';
          feedbackText = 'Custom feedback provided - see JSON for details';
        }
      }
      
      console.log('Final custom evaluation values to be stored:', {
        overallAssessment,
        criteriaAnalysis: criteriaAnalysis.substring(0, 100),
        feedbackText: feedbackText.substring(0, 100),
        customPrompt: customPrompt?.substring(0, 100)
      });
      
      // Insert custom evaluation data into PostgreSQL
      // We'll create a new table for custom evaluations
      const query = `
        INSERT INTO tbl_ailabs_ytfeedback_custom_evaluations (
          email,
          video_url,
          custom_prompt,
          custom_context,
          overall_assessment,
          criteria_analysis,
          custom_feedback,
          evaluation_json,
          actual_model_used,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        videoUrl,
        customPrompt || '',
        customContext || '',
        overallAssessment,
        criteriaAnalysis,
        feedbackText,
        evaluationJson,
        evaluationData.actual_model_used || null
      ];

      console.log('Executing custom evaluation database query');

      const result = await pgPool.query(query, values);
      const evaluationId = result.rows[0].id;
      await tagEvaluation({
        videoType: 'custom', id: evaluationId, institutionId: req.tenant.institutionId,
        phaseName: selectedPhase, videoTitle: selectedVideoTitle, model: evaluationData?.actual_model_used
      });
      
      console.log('Successfully inserted custom evaluation with ID:', evaluationId);

      // Insert API call metrics into tbl_llm_api_calls
      if (evaluationData.api_calls && Array.isArray(evaluationData.api_calls)) {
        const apiCallsInsertPromises = evaluationData.api_calls.map(apiCall => {
          const metricsQuery = `
            INSERT INTO tbl_llm_api_calls (
              evaluation_id,
              user_email,
              evaluation_type,
              video_type,
              video_url,
              api_call_number,
              request_timestamp,
              api_latency_ms,
              prompt_tokens,
              completion_tokens,
              total_tokens,
              finish_reason,
              model_version,
              http_status,
              error_message,
              raw_usage_metadata,
              institution_id,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          `;
          
          const metricsValues = [
            evaluationId,
            userEmail,
            apiCall.evaluation_type || 'custom',
            videoType,
            videoUrl,
            apiCall.call_number,
            apiCall.metrics?.timestamp || new Date().toISOString(),
            apiCall.metrics?.api_latency_ms || null,
            apiCall.metrics?.prompt_tokens || null,
            apiCall.metrics?.completion_tokens || null,
            apiCall.metrics?.total_tokens || null,
            apiCall.metrics?.finish_reason || null,
            apiCall.metrics?.model_version || null,
            apiCall.metrics?.http_status || (apiCall.error ? 500 : 200),
            apiCall.error?.message || apiCall.metrics?.error_message || null,
            apiCall.metrics?.raw_usage_metadata ? JSON.stringify(apiCall.metrics.raw_usage_metadata) : null,
            req.tenant.institutionId
          ];
          
          return pgPool.query(metricsQuery, metricsValues);
        });
        
        try {
          await Promise.all(apiCallsInsertPromises);
          console.log('Successfully inserted API call metrics');
        } catch (metricsErr) {
          console.error('Error inserting API call metrics:', metricsErr);
          // Don't fail the entire request, just log the error
        }
      }

      // Insert user issues if any were captured
      if (evaluationData.issues && Array.isArray(evaluationData.issues) && evaluationData.issues.length > 0) {
        const issuesInsertPromises = evaluationData.issues.map(issue => {
          const issueQuery = `
            INSERT INTO tbl_user_issues (
              evaluation_id,
              user_email,
              issue_type,
              issue_description,
              error_code,
              stacktrace,
              institution_id,
              resolved,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
          `;
          
          const issueValues = [
            evaluationId,
            userEmail,
            issue.issue_type || 'unknown_error',
            issue.issue_description || 'Unknown error occurred',
            issue.error_code || null,
            issue.stacktrace || null,
            req.tenant.institutionId
          ];
          
          return pgPool.query(issueQuery, issueValues);
        });
        
        try {
          await Promise.all(issuesInsertPromises);
          console.log('Successfully inserted user issues');
        } catch (issuesErr) {
          console.error('Error inserting user issues:', issuesErr);
          // Don't fail the entire request, just log the error
        }
      }
      
      res.json({ 
        success: true, 
        id: evaluationId,
        message: 'Custom evaluation stored successfully' 
      });
    } else {
      // Handle unexpected video types
      return res.status(400).json({ error: `Unsupported video type: ${videoType}` });
    }
  } catch (err) {
    console.error('Error storing evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// History, single evaluation, delete, manual evaluation, all evaluations (tenant-scoped)
registerEvaluationRoutes(app);

app.listen(PORT, () => {
  console.log(`Evaluation API listening on http://localhost:${PORT}`);
});
