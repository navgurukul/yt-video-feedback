import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables from .env when running via node
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000, // 5 second connection timeout
  idleTimeoutMillis: 30000, // 30 second idle timeout
  max: 10 // Maximum number of clients in the pool
};

// Create PostgreSQL client pool for better connection management
const { Pool } = pkg;
const pgPool = new Pool(pgConfig);

// Test database connection
pgPool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('PostgreSQL connection error:', err);
  } else {
    console.log('Connected to PostgreSQL database');
  }
});

// Handle pool errors
pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

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
    const { videoUrl, videoDetails, promptbegining, rubric, returnformat } = req.body;

    if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });

    // Build prompt

    const rubricContent = (rubric && Object.keys(rubric).length > 0) 
        ? `RUBRIC:
    ${JSON.stringify(rubric)}`
        : '';

    const prompt = `${promptbegining}

    VIDEO DETAILS:
    ${videoDetails}

    RESPONSE FORMAT 
    ${returnformat}
    ${rubricContent}`;

// Call Generative Language REST API using the correct Gemini endpoint
// Updated to use the current Gemini API endpoint for gemini-2.5-flash model
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

   const body ={
  "contents": [{
    "parts": [{
      "file_data": {
        "file_uri": videoUrl,
        "mime_type": "video/mp4" 
      }
    },
    {
      "text": prompt
    }]
  }],
  "generationConfig": {
    "temperature": 0.0,
    "maxOutputTokens": 1000
  }
}
    // - OAuth2 access tokens typically start with "ya29." (or are JWT-like) and must be sent as a Bearer token.
    let authMode = 'none';
    const headers = { 'Content-Type': 'application/json' };
    let endpointUrl = endpoint;

    // the Generative Language API with proper project-scoped credentials.    
  
      if (GEMINI_KEY.startsWith('AIza')) {
        // API key style
        endpointUrl = endpoint + (endpoint.includes('?') ? '&' : '?') + `key=${encodeURIComponent(GEMINI_KEY)}`;
        authMode = 'apiKey';
      } else if (GEMINI_KEY.startsWith('ya29.') || GEMINI_KEY.split('.').length > 2) {
        // Likely an OAuth2 access token or JWT-like token
        headers['Authorization'] = `Bearer ${GEMINI_KEY}`;
        authMode = 'bearer';
      } else {
        // Fallback: try Bearer header first (covers other token forms)
        headers['Authorization'] = `Bearer ${GEMINI_KEY}`;
        authMode = 'bearer-fallback';
      }

   // console.log('Calling Gemini endpoint with auth mode:', authMode);
  // console.log('Outgoing request ->', { endpoint: endpointUrl, headers, bodyPreview: JSON.stringify(body).slice(0, 2000) });

    let r = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    // Read raw text to avoid json parse errors on empty responses
    const rawText = await r.text();

    console.log("r.status", r.status);

    if (!r.ok) {
      // Handle specific Gemini API error codes
      let errorMessage = '';
      let errorType = '';
      
      switch (r.status) {
        case 400:
          errorType = 'Bad Request';
          errorMessage = 'Invalid request parameters or malformed JSON. Check the request format and data.';
          console.error(`Gemini API Error ${r.status} (${errorType}): ${errorMessage}`, rawText);
          break;
        case 401:
        case 403:
          errorType = r.status === 401 ? 'Unauthorized' : 'Forbidden';
          errorMessage = r.status === 403 ? 
            'Access restricted due to policy violations or insufficient permissions.' : 
            'Invalid or missing API key. Please check your authentication credentials.';
          console.error(`Gemini API Error ${r.status} (${errorType}): ${errorMessage}`, rawText);
          break;
        case 429:
          errorType = 'Too Many Requests';
          errorMessage = 'Quota or rate limit exceeded. Consider implementing retry mechanisms with exponential backoff.';
          console.error(`Gemini API Error ${r.status} (${errorType}): ${errorMessage}`, rawText);
          break;
        case 500:
          errorType = 'Internal Server Error';
          errorMessage = 'Server-side error. The API encountered an unexpected condition.';
          console.error(`Gemini API Error ${r.status} (${errorType}): ${errorMessage}`, rawText);
          break;
        case 503:
          errorType = 'Service Unavailable';
          errorMessage = 'Service temporarily unavailable. Retry after a delay.';
          console.error(`Gemini API Error ${r.status} (${errorType}): ${errorMessage}`, rawText);
          break;
        default:
          errorType = 'Unknown Error';
          errorMessage = `Unexpected error occurred with status ${r.status}.`;
          console.error(`Gemini API Error ${r.status} (${errorType}): ${errorMessage}`, rawText);
      }
      
      return res.status(502).json({ 
        error: 'Upstream model API error', 
        status: r.status, 
        statusText: errorType,
        message: errorMessage,
        body: rawText 
      });
    }

    let json = null;
    try {
      if (rawText && rawText.trim()) json = JSON.parse(rawText);
    } catch (e) {
      // upstream returned non-JSON; we'll keep rawText and attempt to extract content below
      console.warn('Upstream returned non-JSON response; falling back to raw text');
    }

    // Log the full response for debugging
    //console.log('***Full Gemini API response:', JSON.stringify(json, null, 2));

    // Extract generated text from structured json if present, otherwise use raw text
    let genText = null;
    if (json) {
      // Updated extraction logic for the new Gemini API response format
      if (json?.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
        genText = json.candidates[0].content.parts[0].text;
      }
      if (!genText && json?.candidates && json.candidates[0]?.output) genText = json.candidates[0].output;
      if (!genText && json?.output?.[0]?.content) genText = json.output[0].content;
      if (!genText && json?.result) genText = JSON.stringify(json.result);
    }
    if (!genText) genText = rawText;

    // Log the extracted text for debugging
    console.log('Extracted text:', genText);

    // Attempt to parse JSON from generated text
    let parsed = null;
    try {
      // First try to extract JSON from markdown code blocks
      let jsonText = genText;
      const codeBlockMatch = genText && genText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }
      
      // Then try to find JSON object in the text
      const jsonMatch = jsonText && jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
      console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
    } catch (err) {
      console.warn('Failed to parse JSON from generated text; returning raw text');
    }

    return res.json({ raw: json ?? rawText, text: genText, parsed });
  } catch (err) {
    console.error('evaluate error', err);
    res.status(500).json({ error: String(err) });
  }
});

// New endpoint to store evaluation results in PostgreSQL
app.post('/store-evaluation', async (req, res) => {
  try {
    const { userId, userEmail, videoUrl, videoType, evaluationData, videoDetails, projectType, pageName } = req.body;

    console.log('Received request to store evaluation:', { userId, userEmail, videoUrl, videoDetails, projectType, pageName });
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Evaluation data:', JSON.stringify(evaluationData, null, 2));
    
    // Log the structure of evaluation_result specifically
    if (evaluationData && evaluationData.evaluation_result) {
      console.log('Evaluation result structure:', JSON.stringify(evaluationData.evaluation_result, null, 2));
      
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
      
      // Calculate accuracy score and feedback
      // Prefer numeric scores when provided; otherwise store textual feedback and use null for numeric score
      let accuracyScore = null;
      let accuracyFeedback = '';
      
      // Extract accuracy score and feedback from the evaluation result
      if (accuracyEvaluation) {
        console.log('Processing accuracy evaluation:', JSON.stringify(accuracyEvaluation, null, 2));
        try {
          // Try to get score from the first criterion
          if (accuracyEvaluation.criteria && accuracyEvaluation.criteria.length > 0) {
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
          // Handle text-based evaluations
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
          // Extract the level from the evaluation (Beginner, Intermediate, Advanced, Expert)
          if (abilityEvaluation.criteria && abilityEvaluation.criteria.length > 0) {
            // The level is in the "name" field of the first criterion
            abilityEvaluationText = abilityEvaluation.criteria[0].name || '';
            abilityFeedback = abilityEvaluation.criteria[0].feedback || '';
          } else if (abilityEvaluation.level) {
            // Fallback to level property if available
            abilityEvaluationText = abilityEvaluation.level;
            abilityFeedback = abilityEvaluation.overallFeedback || '';
          } 
          // Handle text-based evaluations
          else if (abilityEvaluation.text) {
            console.log('Processing text-based ability evaluation');
            // Try to extract JSON from markdown code block
            const codeBlockMatch = abilityEvaluation.text.match(/```json\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              const jsonText = codeBlockMatch[1];
              console.log('Extracted JSON text from ability evaluation:', jsonText);
              const parsedJson = JSON.parse(jsonText);
              console.log('Parsed JSON from ability evaluation:', JSON.stringify(parsedJson, null, 2));
              
              // Look for evaluation object (based on the actual structure you provided)
              if (parsedJson.evaluation) {
                const evalObj = parsedJson.evaluation;
                if (evalObj.level) {
                  abilityEvaluationText = evalObj.level;
                }
                if (evalObj.feedback) {
                  abilityFeedback = evalObj.feedback;
                }
                console.log('Extracted ability from evaluation object:', { abilityEvaluationText, abilityFeedback });
              }
              // Fallback to looking for level and feedback directly
              else {
                if (parsedJson.level) {
                  abilityEvaluationText = parsedJson.level;
                }
                if (parsedJson.feedback) {
                  abilityFeedback = parsedJson.feedback;
                }
                // Also support nested shapes
                if (!abilityEvaluationText && parsedJson.evaluation && parsedJson.evaluation.level) {
                  abilityEvaluationText = parsedJson.evaluation.level;
                }
                if (!abilityFeedback && parsedJson.evaluation && parsedJson.evaluation.feedback) {
                  abilityFeedback = parsedJson.evaluation.feedback;
                }
                console.log('Extracted ability directly from JSON:', { abilityEvaluationText, abilityFeedback });
              }
            } else {
              // Some responses may not wrap JSON in ```json blocks. Try to extract any JSON object from text.
              const jsonMatch = abilityEvaluation.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsedJson = JSON.parse(jsonMatch[0]);
                  if (parsedJson.level) abilityEvaluationText = parsedJson.level;
                  if (parsedJson.feedback) abilityFeedback = parsedJson.feedback;
                  if (!abilityEvaluationText && parsedJson.evaluation && parsedJson.evaluation.level) abilityEvaluationText = parsedJson.evaluation.level;
                  if (!abilityFeedback && parsedJson.evaluation && parsedJson.evaluation.feedback) abilityFeedback = parsedJson.evaluation.feedback;
                  console.log('Extracted ability from inline JSON:', { abilityEvaluationText, abilityFeedback });
                } catch (e) {
                  console.warn('Failed to parse inline JSON from abilityEvaluation.text', e);
                }
              }
            }
          } else {
            // If we can't extract the level, store the raw JSON but log a warning
            abilityEvaluationText = JSON.stringify(abilityEvaluation);
            abilityFeedback = abilityEvaluation.overallFeedback || '';
            console.warn('Could not extract ability level from evaluation, storing raw JSON:', abilityEvaluationText);
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
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        projectType || '',
        pageName || '',
        videoUrl,
        accuracyScore,
        accuracyFeedback,
        abilityEvaluationText,
        abilityFeedback
      ];

      console.log('Final concept evaluation values to be stored:', {
        accuracyScore,
        accuracyFeedback,
        abilityEvaluationText,
        abilityFeedback
      });
      console.log('Executing concept evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      
      console.log('Successfully inserted concept evaluation with ID:', result.rows[0].id);
      
      res.json({ 
        success: true, 
        id: result.rows[0].id,
        message: 'Concept evaluation stored successfully' 
      });
    } else {
      // For project explanation
      const projectEvaluation = evaluationData.evaluation_result;
      
      // Convert evaluation to text and extract feedback
      let evaluationText = '';
      let feedbackText = '';
      let evaluationJson = '';
      
      if (projectEvaluation) {
        evaluationJson = JSON.stringify(projectEvaluation);
        evaluationText = projectEvaluation.overallScore ? `Overall Score: ${projectEvaluation.overallScore}` : '';
        feedbackText = projectEvaluation.overallFeedback || '';
      }
      
      // Insert project evaluation data into PostgreSQL
      const query = `
        INSERT INTO tbl_ailabs_ytfeedback_project_evaluation (
          email,
          project_name,
          video_url,
          project_explanation_evaluation,
          project_explanation_feedback,
          project_explanation_evaluationjson,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        projectType || '',
        videoUrl,
        evaluationText,
        feedbackText,
        evaluationJson
      ];

      console.log('Executing project evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      
      console.log('Successfully inserted project evaluation with ID:', result.rows[0].id);
      
      res.json({ 
        success: true, 
        id: result.rows[0].id,
        message: 'Project evaluation stored successfully' 
      });
    }
  } catch (err) {
    console.error('Error storing evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Health endpoint for readiness checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Evaluation API listening on http://localhost:${PORT}`);
});
