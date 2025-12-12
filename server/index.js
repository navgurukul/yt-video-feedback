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

// Helper function to repair truncated JSON responses
function repairJSON(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Remove any trailing incomplete text after the last complete property
  let repaired = text.trim();
  
  // Try to fix common truncation issues
  // 1. Add missing closing braces
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
  }
  
  // 2. Remove incomplete property at the end (anything after last complete value)
  // Look for common patterns of incomplete JSON
  repaired = repaired.replace(/,\s*"[^"]*":\s*"[^"]*$/, ''); // incomplete property with string value
  repaired = repaired.replace(/,\s*"[^"]*":\s*$/, ''); // incomplete property without value
  
  // 3. Add missing closing quotes for strings
  const quotes = (repaired.match(/"/g) || []).length;
  if (quotes % 2 !== 0) {
    // Find the last quote and add a closing one before the last brace
    const lastBraceIndex = repaired.lastIndexOf('}');
    if (lastBraceIndex > 0) {
      repaired = repaired.substring(0, lastBraceIndex) + '"' + repaired.substring(lastBraceIndex);
    }
  }
  
  return repaired;
}

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
    "maxOutputTokens": 500,
    "responseMimeType": "application/json"
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

    console.log("****Request body for storing evaluation:", JSON.stringify(req.body, null, 2));
    
    if (!userId || !userEmail || !videoUrl) {
      return res.status(400).json({ error: 'Missing required fields: userId, userEmail, videoUrl' });
    }

    // Store evaluation data in separate tables based on video type
    if (videoType === 'concept') {
      console.log('ZZZZStoring concept evaluation data:', JSON.stringify(evaluationData, null, 2));
      
      // For concept explanation, we have two evaluations: accuracy and ability to explain
      const accuracyEvaluation = evaluationData.evaluation_result.accuracy;
      const abilityEvaluation = evaluationData.evaluation_result.abilityToExplain;
      
      // Extract accuracy values: "Yes" or "No" for accuracy, and detailed feedback
      let concept_explanation_accuracy = null;
      let concept_explanation_feedback = '';

      // Parse accuracy evaluation with proper null checks
      if (accuracyEvaluation) {
        // Check if it has the expected structure
        if (accuracyEvaluation.accuracy_evaluation) {
          concept_explanation_accuracy = accuracyEvaluation.accuracy_evaluation.concept_explanation_accuracy || null;
          concept_explanation_feedback = accuracyEvaluation.accuracy_evaluation.concept_explanation_feedback || 'no feedback provided';
        } 
        // If it doesn't have the nested structure, try to parse from text or raw response
        else if (accuracyEvaluation.text) {
          try {
            const repairedText = repairJSON(accuracyEvaluation.text);
            const parsed = JSON.parse(repairedText);
            if (parsed.accuracy_evaluation) {
              concept_explanation_accuracy = parsed.accuracy_evaluation.concept_explanation_accuracy || null;
              concept_explanation_feedback = parsed.accuracy_evaluation.concept_explanation_feedback || 'no feedback provided';
            }
          } catch (e) {
            console.error('Failed to parse accuracy evaluation text:', e);
            console.error('Attempted to parse:', accuracyEvaluation.text);
          }
        }
        // Try raw response structure
        else if (accuracyEvaluation.raw?.candidates?.[0]?.content?.parts?.[0]?.text) {
          try {
            const rawText = accuracyEvaluation.raw.candidates[0].content.parts[0].text;
            const repairedText = repairJSON(rawText);
            const parsed = JSON.parse(repairedText);
            if (parsed.accuracy_evaluation) {
              concept_explanation_accuracy = parsed.accuracy_evaluation.concept_explanation_accuracy || null;
              concept_explanation_feedback = parsed.accuracy_evaluation.concept_explanation_feedback || 'no feedback provided';
            }
          } catch (e) {
            console.error('Failed to parse accuracy evaluation raw response:', e);
          }
        }
      }

      let ability_to_explain_evaluation = '';
      let ability_to_explain_feedback = '';

      // Parse ability evaluation with proper null checks
      if (abilityEvaluation) {
        // Check if it has the expected structure
        if (abilityEvaluation.ability_evaluation) {
          ability_to_explain_evaluation = abilityEvaluation.ability_evaluation.ability_to_explain_evaluation || 'Could not determine';
          ability_to_explain_feedback = abilityEvaluation.ability_evaluation.ability_to_explain_feedback || 'No feedback provided';
        }
        // If it doesn't have the nested structure, try to parse from text or raw response
        else if (abilityEvaluation.text) {
          try {
            const repairedText = repairJSON(abilityEvaluation.text);
            const parsed = JSON.parse(repairedText);
            if (parsed.ability_evaluation) {
              ability_to_explain_evaluation = parsed.ability_evaluation.ability_to_explain_evaluation || 'Could not determine';
              ability_to_explain_feedback = parsed.ability_evaluation.ability_to_explain_feedback || 'No feedback provided';
            }
          } catch (e) {
            console.error('Failed to parse ability evaluation text:', e);
            console.error('Attempted to parse:', abilityEvaluation.text);
          }
        }
        // Try raw response structure
        else if (abilityEvaluation.raw?.candidates?.[0]?.content?.parts?.[0]?.text) {
          try {
            const rawText = abilityEvaluation.raw.candidates[0].content.parts[0].text;
            const repairedText = repairJSON(rawText);
            const parsed = JSON.parse(repairedText);
            if (parsed.ability_evaluation) {
              ability_to_explain_evaluation = parsed.ability_evaluation.ability_to_explain_evaluation || 'Could not determine';
              ability_to_explain_feedback = parsed.ability_evaluation.ability_to_explain_feedback || 'No feedback provided';
            }
          } catch (e) {
            console.error('Failed to parse ability evaluation raw response:', e);
          }
        }
      }

      console.log('Extracted values:', {
        concept_explanation_accuracy,
        concept_explanation_feedback,
        ability_to_explain_evaluation,
        ability_to_explain_feedback
      });
      
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
        concept_explanation_accuracy,
        concept_explanation_feedback,
        ability_to_explain_evaluation,
        ability_to_explain_feedback
      ];

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
