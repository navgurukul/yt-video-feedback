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
import { analyzeVideo, checkServiceHealth } from './services/qwen2vl-service.js';

// Load environment variables from .env when running via node
const __filename_env = fileURLToPath(import.meta.url);
const __dirname_env = path.dirname(__filename_env);
dotenv.config({ path: path.join(__dirname_env, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || process.env.VITE_HUGGINGFACE_API_KEY;

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

if (HUGGINGFACE_API_KEY) {
  try {
    const masked = `${HUGGINGFACE_API_KEY.slice(0,4)}...${HUGGINGFACE_API_KEY.slice(-4)}`;
    console.log('HUGGINGFACE_API_KEY loaded from environment (masked):', masked);
  } catch (e) {
    console.log('HUGGINGFACE_API_KEY loaded (length):', HUGGINGFACE_API_KEY.length || 'unknown');
  }
} else {
  console.log('HUGGINGFACE_API_KEY not provided in environment');
}

app.post('/evaluate', async (req, res) => {
  try {
    const { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext, modelProvider } = req.body;

    if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });
    
    // Determine which model provider to use (default to gemini for backward compatibility)
    const provider = modelProvider || 'gemini';
    
    console.log('\n=== NEW EVALUATION REQUEST ===');
    console.log('📹 Video URL:', videoUrl);
    console.log('🤖 Model Provider:', provider);
    console.log('📋 Evaluation Type:', evaluationType);
    
    if (provider === 'huggingface') {
      // Use Hugging Face API with Gemma model (text-only)
      console.log('🔄 Routing to Hugging Face Gemma (text-only analysis)...');
      return await evaluateWithHuggingFace(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext });
    } else if (provider === 'qwen') {
      // Use Qwen2.5-7B model (Direct Inference API - broader model support)
      console.log('🔄 Routing to Qwen2.5-7B (Direct Inference API)...');
      return await evaluateWithQwen(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext });
    } else if (provider === 'llama') {
      // Use Meta Llama 3.1 70B model (text-only via Hugging Face)
      console.log('🔄 Routing to Mistral 7B (compact and efficient)...');
      return await evaluateWithLlama(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext });
    } else {
      // Use existing Gemini API (default)
      console.log('🔄 Routing to Gemini Flash 2.5 (native video analysis)...');
      return await evaluateWithGemini(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext });
    }
  } catch (err) {
    console.error('evaluate error', err);
    res.status(500).json({ error: String(err) });
  }
});

// Hugging Face evaluation function
async function evaluateWithHuggingFace(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext }) {
  try {
    // For HuggingFace, always use the HuggingFace API key from environment
    // The apiKey from the request body is a Gemini key and should NOT be used here
    const effectiveApiKey = HUGGINGFACE_API_KEY;
    
    if (!effectiveApiKey) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in server environment. Add it to server/.env' });
    }

    // Build the rubric content
    const rubricContent = (rubric && Object.keys(rubric).length > 0) 
      ? `RUBRIC:\n${JSON.stringify(rubric)}`
      : '';

    // Build custom prompt section if provided
    const customPromptContent = customPrompt 
      ? `CUSTOM_PROMPT:
${customPrompt}

`
      : '';

    const promptText = promptbegining + `
${customPromptContent}VIDEO DETAILS:
${videoDetails}

${rubricContent}

NOTE: This is a YouTube video. Please analyze the video content and provide a detailed evaluation based on the criteria above. Return your response as a valid JSON object matching the expected schema.`;

    console.log(`--- Calling Hugging Face API with Gemma model to evaluate video (${evaluationType} evaluation) ---`);

    // Debug: diagnose API key issues
    const keySource = apiKey ? 'request body' : (HUGGINGFACE_API_KEY ? 'environment variable' : 'NONE');
    console.log('--- HF API Key Diagnostics ---');
    console.log('  Key source:', keySource);
    console.log('  Key type:', typeof effectiveApiKey);
    console.log('  Key length:', effectiveApiKey ? effectiveApiKey.length : 0);
    console.log('  Key is empty string:', effectiveApiKey === '');
    console.log('  Key is undefined:', effectiveApiKey === undefined);
    console.log('  Key starts with "hf_":', effectiveApiKey ? effectiveApiKey.startsWith('hf_') : false);
    console.log('  Key has leading/trailing whitespace:', effectiveApiKey ? (effectiveApiKey !== effectiveApiKey.trim()) : false);
    console.log('  Key has newlines:', effectiveApiKey ? /[\r\n]/.test(effectiveApiKey) : false);
    console.log('  Key masked:', effectiveApiKey ? `${effectiveApiKey.slice(0,4)}...${effectiveApiKey.slice(-4)}` : 'N/A');
    console.log('  Authorization header:', `Bearer ${effectiveApiKey ? effectiveApiKey.trim().slice(0,6) + '...' : 'MISSING'}`);
    console.log('--- End Diagnostics ---');

    // Trim whitespace/newlines from key just in case
    const cleanApiKey = effectiveApiKey.trim();

    // Note: Hugging Face doesn't support video input directly
    // We'll use a text-only approach and provide the YouTube URL as context
    // Using HuggingFace Inference Providers OpenAI-compatible chat completions endpoint
    const hfResponse = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it',
          messages: [
            {
              role: 'user',
              content: `${promptText}\n\nYouTube Video URL: ${videoUrl}\n\nPlease provide a structured JSON response based on the evaluation criteria.`
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.95,
          stream: false
        }),
      }
    );

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      console.error('Hugging Face API error:', errorText);
      
      let statusCode = hfResponse.status;
      let errorMessage = 'Hugging Face API error';
      
      if (statusCode === 401) {
        errorMessage = 'Invalid Hugging Face API key';
      } else if (statusCode === 429) {
        errorMessage = 'Hugging Face API quota exceeded';
      } else if (statusCode === 503) {
        errorMessage = 'Hugging Face model is loading. Please try again in a few moments.';
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage, 
        message: errorText,
        details: 'Hugging Face API error'
      });
    }

    const hfData = await hfResponse.json();
    let fullResponse = '';
    
    // Handle different response formats from Hugging Face
    // Standard text-generation format
    if (Array.isArray(hfData) && hfData.length > 0) {
      fullResponse = hfData[0].generated_text || '';
    } else if (hfData.generated_text) {
      fullResponse = hfData.generated_text;
    } 
    // Chat completions format
    else if (hfData.choices && Array.isArray(hfData.choices) && hfData.choices.length > 0) {
      fullResponse = hfData.choices[0].message?.content || '';
    }
    else {
      fullResponse = JSON.stringify(hfData);
    }

    console.log('--- Hugging Face response received ---');

    // Parse the JSON response
    let parsed = null;
    try {
      parsed = JSON.parse(fullResponse);
    } catch (err) {
      console.warn('Failed to parse JSON from response:', err);
      // Try to extract JSON from the text
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse extracted JSON:', e);
          // Return a basic structure if parsing fails
          parsed = {
            note: "Unable to parse structured response from model",
            raw_response: fullResponse
          };
        }
      }
    }

    return res.json({ 
      raw: fullResponse, 
      text: fullResponse, 
      parsed 
    });
  } catch (error) {
    console.error('Hugging Face evaluation error:', error);
    return res.status(502).json({ 
      error: 'Hugging Face API error', 
      message: error.message,
      details: error.code || 'Unknown error'
    });
  }
}

// Qwen evaluation function - Using Direct Inference API
async function evaluateWithQwen(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext }) {
  try {
    // For Qwen, use the Hugging Face API key from environment
    const effectiveApiKey = HUGGINGFACE_API_KEY;
    
    if (!effectiveApiKey) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in server environment. Add it to server/.env' });
    }

    // Build the rubric content
    const rubricContent = (rubric && Object.keys(rubric).length > 0) 
      ? `RUBRIC:\n${JSON.stringify(rubric)}`
      : '';

    // Build custom prompt section if provided
    const customPromptContent = customPrompt 
      ? `CUSTOM_PROMPT:
${customPrompt}

`
      : '';

    const promptText = promptbegining + `
${customPromptContent}VIDEO DETAILS:
${videoDetails}

${rubricContent}

YouTube Video URL: ${videoUrl}

IMPORTANT: Return ONLY a valid JSON object matching the rubric structure. Do not include any markdown formatting, code blocks, or explanatory text before or after the JSON.`;

    console.log(`--- Calling Hugging Face Direct Inference API with Qwen2.5-7B model ---`);
    console.log('🤖 Qwen2.5-7B-Instruct: Using Direct Inference API (broader model support)');

    // Trim whitespace from key
    const cleanApiKey = effectiveApiKey.trim();

    // Use Direct Inference API endpoint (not router)
    // This endpoint supports many more models including Qwen
    const modelName = 'Qwen/Qwen2.5-7B-Instruct';
    
    const qwenResponse = await fetch(
      `https://api-inference.huggingface.co/models/${modelName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: promptText,
          parameters: {
            max_new_tokens: 2000,
            temperature: 0.7,
            top_p: 0.95,
            return_full_text: false,
            do_sample: true
          },
          options: {
            wait_for_model: true,  // Wait if model is loading
            use_cache: false       // Get fresh results
          }
        }),
      }
    );

    if (!qwenResponse.ok) {
      const errorText = await qwenResponse.text();
      console.error('Qwen API error:', errorText);
      
      let statusCode = qwenResponse.status;
      let errorMessage = 'Qwen API error';
      let details = errorText;
      
      try {
        const errorJson = JSON.parse(errorText);
        details = errorJson.error || errorText;
      } catch (e) {
        // Keep original text
      }
      
      if (statusCode === 401) {
        errorMessage = 'Invalid Hugging Face API key';
      } else if (statusCode === 429) {
        errorMessage = 'Hugging Face API quota exceeded';
      } else if (statusCode === 503) {
        errorMessage = 'Qwen model is loading. Please wait 30-60 seconds and try again.';
      } else if (statusCode === 400) {
        errorMessage = 'Invalid request format for Qwen';
      } else if (statusCode === 500) {
        errorMessage = 'Hugging Face server error';
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage, 
        message: details,
        details: 'Qwen Direct Inference API error',
        model: modelName
      });
    }

    const qwenData = await qwenResponse.json();
    console.log('📦 Response structure:', typeof qwenData, Array.isArray(qwenData));
    
    let fullResponse = '';
    
    // Handle Direct Inference API response format
    if (Array.isArray(qwenData) && qwenData.length > 0) {
      // Standard format: [{ generated_text: "..." }]
      fullResponse = qwenData[0].generated_text || qwenData[0].text || '';
    } else if (qwenData.generated_text) {
      // Alternative format: { generated_text: "..." }
      fullResponse = qwenData.generated_text;
    } else if (typeof qwenData === 'string') {
      // Direct string response
      fullResponse = qwenData;
    } else {
      // Fallback: stringify the response
      fullResponse = JSON.stringify(qwenData);
    }

    console.log('✅ Qwen2.5-7B response received');
    console.log('📝 Response length:', fullResponse.length, 'characters');
    console.log('📝 Response preview:', fullResponse.substring(0, 200) + '...');

    // Enhanced JSON extraction for Qwen
    let parsed = null;
    try {
      // Try direct parse first
      parsed = JSON.parse(fullResponse);
      console.log('✅ Direct JSON parse successful');
    } catch (err) {
      console.warn('⚠️ Direct JSON parse failed, attempting extraction...');
      
      // Remove markdown code blocks
      let cleaned = fullResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Extract first complete JSON object with nested brace handling
      const jsonMatch = cleaned.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/);
      
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ JSON extracted successfully from response');
        } catch (extractError) {
          console.error('❌ JSON extraction failed:', extractError.message);
          parsed = {
            note: "Unable to parse structured response from Qwen",
            raw_response: fullResponse.substring(0, 500),
            error: extractError.message
          };
        }
      } else {
        console.error('❌ No valid JSON found in response');
        parsed = {
          note: "No valid JSON found in Qwen response",
          raw_response: fullResponse.substring(0, 500)
        };
      }
    }

    return res.json({ 
      raw: fullResponse, 
      text: fullResponse, 
      parsed 
    });
  } catch (error) {
    console.error('Qwen evaluation error:', error);
    return res.status(502).json({ 
      error: 'Qwen API error', 
      message: error.message,
      details: error.code || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Meta Llama evaluation function
async function evaluateWithLlama(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext }) {
  try {
    // For Llama, use the Hugging Face API key from environment
    const effectiveApiKey = HUGGINGFACE_API_KEY;
    
    if (!effectiveApiKey) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in server environment. Add it to server/.env' });
    }

    // Build the rubric content
    const rubricContent = (rubric && Object.keys(rubric).length > 0) 
      ? `RUBRIC:\n${JSON.stringify(rubric)}`
      : '';

    // Build custom prompt section if provided
    const customPromptContent = customPrompt 
      ? `CUSTOM_PROMPT:
${customPrompt}

`
      : '';

    const promptText = promptbegining + `
${customPromptContent}VIDEO DETAILS:
${videoDetails}

${rubricContent}

IMPORTANT: Return ONLY a valid JSON object matching the rubric structure. Do not include any markdown formatting, code blocks, or explanatory text before or after the JSON.`;

    console.log(`--- Calling Hugging Face API with Mistral 7B model to evaluate video (${evaluationType} evaluation) ---`);
    console.log('🔮 Mistral 7B Instruct: Fast and efficient reasoning');

    // Trim whitespace from key
    const cleanApiKey = effectiveApiKey.trim();

    // Use the same router endpoint (chat completions format)
    const llamaResponse = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistralai/Mistral-7B-Instruct-v0.3',
          messages: [
            {
              role: 'user',
              content: `${promptText}\n\nYouTube Video URL: ${videoUrl}\n\nNote: Analyze based on the video URL and context provided. Return a structured JSON response matching the evaluation criteria.`
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.95,
          stream: false
        }),
      }
    );

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text();
      console.error('Llama API error:', errorText);
      
      let statusCode = llamaResponse.status;
      let errorMessage = 'Llama API error';
      
      if (statusCode === 401) {
        errorMessage = 'Invalid Hugging Face API key';
      } else if (statusCode === 429) {
        errorMessage = 'Hugging Face API quota exceeded';
      } else if (statusCode === 503) {
        errorMessage = 'Llama model is loading. Please try again in 30-60 seconds.';
      } else if (statusCode === 400) {
        errorMessage = 'Invalid request format for Llama';
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage, 
        message: errorText,
        details: 'Mistral API error'
      });
    }

    const llamaData = await llamaResponse.json();
    let fullResponse = '';
    
    // Handle chat completions format
    if (llamaData.choices && Array.isArray(llamaData.choices) && llamaData.choices.length > 0) {
      fullResponse = llamaData.choices[0].message?.content || '';
    } else if (Array.isArray(llamaData) && llamaData.length > 0) {
      fullResponse = llamaData[0].generated_text || llamaData[0].text || '';
    } else if (llamaData.generated_text) {
      fullResponse = llamaData.generated_text;
    } else if (llamaData.text) {
      fullResponse = llamaData.text;
    } else {
      fullResponse = JSON.stringify(llamaData);
    }

    console.log('--- Mistral 7B response received ---');
    console.log('📝 Response preview:', fullResponse.substring(0, 200) + '...');

    // Enhanced JSON extraction
    let parsed = null;
    try {
      parsed = JSON.parse(fullResponse);
      console.log('✅ Direct JSON parse successful');
    } catch (err) {
      console.warn('⚠️ Direct JSON parse failed, attempting extraction...');
      
      // Remove markdown code blocks
      let cleaned = fullResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Extract first complete JSON object
      const jsonMatch = cleaned.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/);
      
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ JSON extracted successfully from response');
        } catch (extractError) {
          console.error('❌ JSON extraction failed:', extractError.message);
          parsed = {
            note: "Unable to parse structured response from Mistral",
            raw_response: fullResponse.substring(0, 500)
          };
        }
      } else {
        console.error('❌ No valid JSON found in response');
        parsed = {
          note: "No valid JSON found in Mistral response",
          raw_response: fullResponse.substring(0, 500)
        };
      }
    }

    return res.json({ 
      raw: fullResponse, 
      text: fullResponse, 
      parsed 
    });
  } catch (error) {
    console.error('Mistral evaluation error:', error);
    return res.status(502).json({ 
      error: 'Mistral API error', 
      message: error.message,
      details: error.code || 'Unknown error'
    });
  }
}

// Gemini evaluation function (existing logic)
async function evaluateWithGemini(req, res, { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig, apiKey, customPrompt, customContext }) {
  try {
    // Use API key from request body if provided, otherwise fall back to environment variable
    const effectiveApiKey = apiKey || GEMINI_KEY;
    
    if (!effectiveApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured and not provided in request' });

    // Initialize Google GenAI client with the effective API key
    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    const model = 'gemini-2.5-flash';
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

    try {
      // Call the streaming API using @google/genai SDK

      const response = await ai.models.generateContentStream({
        model,
        config: apiConfig,
        contents,
      });

      // Collect the streaming response chunks
      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      console.log('--- Stream finished ---');
      //console.log('Full response received:', fullResponse);

      // Parse the JSON response
      let parsed = null;
      try {
        parsed = JSON.parse(fullResponse);
        //console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
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

      return res.json({ 
        raw: fullResponse, 
        text: fullResponse, 
        parsed 
      });
    } catch (error) {
      console.error('An error occurred during the API call:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        code: error.code
      });
      
      // Determine appropriate status code based on error type
      let statusCode = 502; // Default to Bad Gateway
      let errorMessage = 'Upstream model API error';
      
      const errorString = error.message || String(error);
      
      if (errorString.includes('API key not valid') || errorString.includes('API_KEY_INVALID')) {
        statusCode = 401; // Unauthorized
        errorMessage = 'Invalid API key';
      } else if (errorString.includes('quota') || errorString.includes('QUOTA_EXCEEDED')) {
        statusCode = 429; // Too Many Requests
        errorMessage = 'API quota exceeded';
      } else if (errorString.includes('Bad Request') || error.status === 400) {
        statusCode = 400; // Bad Request
        errorMessage = 'Invalid request to AI model';
      } else if (errorString.includes('fetch failed') || errorString.includes('ECONNREFUSED') || errorString.includes('ETIMEDOUT')) {
        statusCode = 503; // Service Unavailable
        errorMessage = 'Unable to connect to AI service';
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage, 
        message: errorString,
        details: error.code || 'Unknown error'
      });
    }
  } catch (err) {
    console.error('Gemini evaluation error', err);
    return res.status(500).json({ error: String(err) });
  }
}

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
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        selectedPhase,
        videoUrl,
        evaluationText,
        feedbackText,
        evaluationJson
      ];

      //console.log('Executing project evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      
      console.log('Successfully inserted project evaluation with ID:', result.rows[0].id);
      
      res.json({ 
        success: true, 
        id: result.rows[0].id,
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
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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
        evaluationJson
      ];

      console.log('Executing custom evaluation database query');

      const result = await pgPool.query(query, values);
      
      console.log('Successfully inserted custom evaluation with ID:', result.rows[0].id);
      
      res.json({ 
        success: true, 
        id: result.rows[0].id,
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

// Fetch concept evaluations history
app.get('/concept-history', async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    console.log('Concept history request for email:', userEmail);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const query = `
      SELECT 
        id,
        email,
        project_name,
        page_name,
        video_url,
        concept_explanation_accuracy,
        concept_explanation_feedback,
        ability_to_explain_evaluation,
        ability_to_explain_feedback,
        created_at
      FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE email = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pgPool.query(query, [userEmail]);
    console.log('Concept history found:', result.rows.length, 'records');
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (err) {
    console.error('Error fetching concept history:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch project evaluations history
app.get('/project-history', async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    console.log('Project history request for email:', userEmail);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const query = `
      SELECT 
        id,
        email,
        project_name,
        video_url,
        project_explanation_evaluation,
        project_explanation_feedback,
        project_explanation_evaluationjson,
        created_at
      FROM tbl_ailabs_ytfeedback_project_evaluation
      WHERE email = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pgPool.query(query, [userEmail]);
    console.log('Project history found:', result.rows.length, 'records');
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (err) {
    console.error('Error fetching project history:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch single concept evaluation by ID
app.get('/concept-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        email,
        project_name,
        page_name,
        video_url,
        concept_explanation_accuracy,
        concept_explanation_feedback,
        ability_to_explain_evaluation,
        ability_to_explain_feedback,
        created_at
      FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE id = $1
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concept evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error fetching concept evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch single project evaluation by ID
app.get('/project-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        email,
        project_name,
        video_url,
        project_explanation_evaluation,
        project_explanation_feedback,
        project_explanation_evaluationjson,
        created_at
      FROM tbl_ailabs_ytfeedback_project_evaluation
      WHERE id = $1
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error fetching project evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Delete concept evaluation
app.delete('/concept-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      DELETE FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concept evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Concept evaluation deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting concept evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Delete project evaluation
app.delete('/project-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      DELETE FROM tbl_ailabs_ytfeedback_project_evaluation
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Project evaluation deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting project evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch custom evaluations history
app.get('/custom-history', async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    console.log('Custom history request for email:', userEmail);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const query = `
      SELECT 
        id,
        email,
        video_url,
        custom_prompt,
        custom_context,
        overall_assessment,
        criteria_analysis,
        custom_feedback,
        evaluation_json,
        created_at
      FROM tbl_ailabs_ytfeedback_custom_evaluations
      WHERE email = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pgPool.query(query, [userEmail]);
    console.log('Custom history found:', result.rows.length, 'records');
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (err) {
    console.error('Error fetching custom history:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch single custom evaluation by ID
app.get('/custom-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        email,
        video_url,
        custom_prompt,
        custom_context,
        overall_assessment,
        criteria_analysis,
        custom_feedback,
        evaluation_json,
        created_at
      FROM tbl_ailabs_ytfeedback_custom_evaluations
      WHERE id = $1
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error fetching custom evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Delete custom evaluation
app.delete('/custom-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      DELETE FROM tbl_ailabs_ytfeedback_custom_evaluations
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Custom evaluation deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting custom evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Health endpoint for readiness checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fetch ALL evaluations (admin view - all students)
app.get('/all-evaluations', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('All evaluations request:', { page, limit, type, search, sortBy, sortOrder });
    
    let conceptQuery = '';
    let projectQuery = '';
    let conceptParams = [];
    let projectParams = [];
    
    // Build search condition
    const searchCondition = search 
      ? `WHERE email ILIKE $1 OR project_name ILIKE $1 OR page_name ILIKE $1` 
      : '';
    const projectSearchCondition = search 
      ? `WHERE email ILIKE $1 OR project_name ILIKE $1` 
      : '';
    const customSearchCondition = search 
      ? `WHERE email ILIKE $1 OR custom_prompt ILIKE $1` 
      : '';
    
    if (search) {
      conceptParams = [`%${search}%`];
      projectParams = [`%${search}%`];
    }
    
    // Fetch concept evaluations if type is 'all' or 'concept'
    let conceptRecords = [];
    if (!type || type === 'all' || type === 'concept') {
      conceptQuery = `
        SELECT 
          id,
          email,
          project_name,
          page_name,
          video_url,
          concept_explanation_accuracy,
          concept_explanation_feedback,
          ability_to_explain_evaluation,
          ability_to_explain_feedback,
          created_at,
          'concept' as type
        FROM tbl_ailabs_ytfeedback_concept_evaluations
        ${searchCondition}
        ORDER BY created_at DESC
      `;
      const conceptResult = await pgPool.query(conceptQuery, conceptParams);
      conceptRecords = conceptResult.rows;
    }
    
    // Fetch project evaluations if type is 'all' or 'project'
    let projectRecords = [];
    if (!type || type === 'all' || type === 'project') {
      projectQuery = `
        SELECT 
          id,
          email,
          project_name,
          NULL as page_name,
          video_url,
          project_explanation_evaluation,
          project_explanation_feedback,
          project_explanation_evaluationjson,
          created_at,
          'project' as type
        FROM tbl_ailabs_ytfeedback_project_evaluation
        ${projectSearchCondition}
        ORDER BY created_at DESC
      `;
      const projectResult = await pgPool.query(projectQuery, projectParams);
      projectRecords = projectResult.rows;
    }
    
    // Fetch custom evaluations if type is 'all' or 'custom'
    let customRecords = [];
    if (!type || type === 'all' || type === 'custom') {
      const customQuery = `
        SELECT 
          id,
          email,
          NULL as project_name,
          NULL as page_name,
          video_url,
          custom_prompt,
          overall_assessment,
          custom_feedback,
          evaluation_json,
          created_at,
          'custom' as type
        FROM tbl_ailabs_ytfeedback_custom_evaluations
        ${customSearchCondition}
        ORDER BY created_at DESC
      `;
      const customParams = search ? [`%${search}%`] : [];
      const customResult = await pgPool.query(customQuery, customParams);
      customRecords = customResult.rows;
    }
    
    // Combine and sort all records
    let allRecords = [...conceptRecords, ...projectRecords, ...customRecords];
    
    // Sort combined records
    allRecords.sort((a, b) => {
      if (sortBy === 'email') {
        return sortOrder === 'asc' 
          ? a.email.localeCompare(b.email)
          : b.email.localeCompare(a.email);
      } else if (sortBy === 'project_name') {
        return sortOrder === 'asc' 
          ? (a.project_name || '').localeCompare(b.project_name || '')
          : (b.project_name || '').localeCompare(a.project_name || '');
      } else {
        // Default: sort by created_at
        return sortOrder === 'asc' 
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    
    // Get total count before pagination
    const totalCount = allRecords.length;
    
    // Apply pagination
    const paginatedRecords = allRecords.slice(offset, offset + parseInt(limit));
    
    // Get unique emails count (unique students)
    const uniqueEmails = new Set(allRecords.map(r => r.email));
    
    console.log('All evaluations found:', totalCount, 'records from', uniqueEmails.size, 'students');
    
    res.json({ 
      success: true, 
      data: paginatedRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      },
      stats: {
        totalEvaluations: totalCount,
        uniqueStudents: uniqueEmails.size,
        conceptCount: conceptRecords.length,
        projectCount: projectRecords.length,
        customCount: customRecords.length
      }
    });
  } catch (err) {
    console.error('Error fetching all evaluations:', err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Test Variance Endpoint
 * 
 * Tests consistency of Gemini API evaluations by running the same video
 * through multiple evaluation iterations and comparing results.
 * 
 * POST /test-variance
 * Body: {
 *   videoUrl: string,
 *   evaluationType: "accuracy" | "ability" | "project" | "custom",
 *   videoDetails: string,
 *   promptbegining: string (optional, for accuracy/ability),
 *   rubric: object (optional, for project),
 *   structuredreturnedconfig: object,
 *   customPrompt: string (optional, for custom),
 *   customContext: string (optional, for custom),
 *   iterations: number (default 3),
 *   apiKey: string (optional)
 * }
 * 
 * Returns: {
 *   success: boolean,
 *   iterations: number,
 *   responses: array of parsed responses,
 *   variance_analysis: {
 *     identical_count: number,
 *     variance_percentage: number,
 *     differing_fields: array of field names with differences,
 *     consistency_score: number (0-100)
 *   },
 *   recommendations: array of strings
 * }
 */
app.post('/test-variance', async (req, res) => {
  try {
    const {
      videoUrl,
      evaluationType = "accuracy",
      videoDetails,
      promptbegining,
      rubric,
      structuredreturnedconfig,
      customPrompt,
      customContext,
      iterations = 3,
      apiKey
    } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing videoUrl' });
    }

    if (iterations < 2 || iterations > 10) {
      return res.status(400).json({ error: 'Iterations must be between 2 and 10' });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 VARIANCE TEST STARTED`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Video URL: ${videoUrl}`);
    console.log(`Evaluation Type: ${evaluationType}`);
    console.log(`Iterations: ${iterations}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

    // Prepare payload for /evaluate endpoint
    const evaluatePayload = {
      videoUrl,
      evaluationType,
      videoDetails,
      promptbegining,
      rubric,
      structuredreturnedconfig,
      customPrompt,
      customContext,
      apiKey
    };

    // Array to store all responses
    const responses = [];
    const startTime = Date.now();

    // Run evaluations sequentially
    for (let i = 0; i < iterations; i++) {
      console.log(`\n🔄 Running iteration ${i + 1}/${iterations}...`);
      const iterationStart = Date.now();

      try {
        // Call evaluation logic directly instead of HTTP fetch
        const effectiveApiKey = apiKey || GEMINI_KEY;
        
        if (!effectiveApiKey) {
          throw new Error('GEMINI_API_KEY not configured and not provided in request');
        }

        // Initialize Google GenAI client
        const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
        const model = 'gemini-2.5-flash';
        
        // Handle different config formats
        let apiConfig;
        if (structuredreturnedconfig.generationConfig) {
          apiConfig = structuredreturnedconfig.generationConfig;
        } else {
          apiConfig = structuredreturnedconfig;
        }

        // Build prompt
        const rubricContent = (rubric && Object.keys(rubric).length > 0) 
          ? `RUBRIC:\n${JSON.stringify(rubric)}`
          : '';

        const customPromptContent = customPrompt 
          ? `CUSTOM_PROMPT:\n${customPrompt}\n\n`
          : '';

        const promptText = promptbegining + `
          ${customPromptContent}VIDEO DETAILS:
          ${videoDetails}

          ${rubricContent}`;

        const contents = [
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

        // Call Gemini API
        const response = await ai.models.generateContentStream({
          model,
          config: apiConfig,
          contents,
        });

        // Collect the streaming response
        let fullResponse = '';
        for await (const chunk of response) {
          if (chunk.text) {
            fullResponse += chunk.text;
          }
        }

        // Parse JSON response
        let parsed = null;
        try {
          parsed = JSON.parse(fullResponse);
        } catch (err) {
          // Try to extract JSON from the text
          const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.error('Failed to parse extracted JSON:', e);
            }
          }
        }

        const iterationTime = Date.now() - iterationStart;

        responses.push({
          iteration: i + 1,
          parsed: parsed,
          raw: fullResponse,
          time_ms: iterationTime,
          success: true
        });

        console.log(`✅ Iteration ${i + 1} completed in ${iterationTime}ms`);
      } catch (err) {
        const iterationTime = Date.now() - iterationStart;
        console.error(`❌ Iteration ${i + 1} threw error:`, err.message);
        responses.push({
          iteration: i + 1,
          error: err.message,
          time_ms: iterationTime
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${totalTime}ms`);
    console.log(`📊 Average iteration time: ${Math.round(totalTime / iterations)}ms\n`);

    // Filter successful responses for comparison
    const successfulResponses = responses.filter(r => r.success && r.parsed);
    
    if (successfulResponses.length < 2) {
      return res.json({
        success: false,
        error: 'Not enough successful responses to analyze variance',
        iterations,
        responses,
        successful_count: successfulResponses.length
      });
    }

    console.log(`${'='.repeat(80)}`);
    console.log(`📊 VARIANCE ANALYSIS`);
    console.log(`${'='.repeat(80)}`);

    // Perform variance analysis
    const varianceAnalysis = analyzeVariance(successfulResponses, evaluationType);
    
    console.log(`\n🔍 Results:`);
    console.log(`   Identical Responses: ${varianceAnalysis.identical_count}/${successfulResponses.length}`);
    console.log(`   Variance: ${varianceAnalysis.variance_percentage.toFixed(2)}%`);
    console.log(`   Consistency Score: ${varianceAnalysis.consistency_score.toFixed(2)}/100`);
    
    if (varianceAnalysis.differing_fields.length > 0) {
      console.log(`\n⚠️  Fields with differences:`);
      varianceAnalysis.differing_fields.forEach(field => {
        console.log(`   - ${field}`);
      });
    } else {
      console.log(`\n✅ All fields are identical across iterations!`);
    }

    // Generate recommendations
    const recommendations = generateRecommendations(varianceAnalysis, evaluationType);
    
    if (recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 VARIANCE TEST COMPLETED`);
    console.log(`${'='.repeat(80)}\n`);

    res.json({
      success: true,
      iterations,
      responses,
      successful_count: successfulResponses.length,
      failed_count: responses.length - successfulResponses.length,
      total_time_ms: totalTime,
      avg_iteration_time_ms: Math.round(totalTime / iterations),
      variance_analysis: varianceAnalysis,
      recommendations
    });

  } catch (err) {
    console.error('❌ Test variance endpoint error:', err);
    res.status(500).json({ 
      success: false,
      error: String(err) 
    });
  }
});

/**
 * Analyze variance between multiple evaluation responses
 * 
 * @param {Array} responses - Array of successful response objects
 * @param {string} evaluationType - Type of evaluation being tested
 * @returns {Object} Variance analysis results
 */
function analyzeVariance(responses, evaluationType) {
  const parsed = responses.map(r => r.parsed);
  const firstResponse = parsed[0];
  
  let identicalCount = 0;
  const differingFields = new Set();
  const fieldComparisons = {};

  // Compare each response with the first one
  for (let i = 1; i < parsed.length; i++) {
    const comparison = deepCompare(firstResponse, parsed[i], '', evaluationType);
    
    if (comparison.identical) {
      identicalCount++;
    }
    
    comparison.differences.forEach(diff => {
      differingFields.add(diff);
      if (!fieldComparisons[diff]) {
        fieldComparisons[diff] = [];
      }
      fieldComparisons[diff].push(i);
    });
  }

  // Calculate metrics
  const totalComparisons = parsed.length - 1;
  const variancePercentage = ((totalComparisons - identicalCount) / totalComparisons) * 100;
  const consistencyScore = 100 - variancePercentage;

  return {
    identical_count: identicalCount,
    total_comparisons: totalComparisons,
    variance_percentage: variancePercentage,
    consistency_score: consistencyScore,
    differing_fields: Array.from(differingFields),
    field_comparison_details: fieldComparisons
  };
}

/**
 * Deep comparison of two objects to detect differences
 * 
 * @param {any} obj1 - First object
 * @param {any} obj2 - Second object
 * @param {string} path - Current path in object tree
 * @param {string} evaluationType - Type of evaluation
 * @returns {Object} Comparison result with differences array
 */
function deepCompare(obj1, obj2, path = '', evaluationType) {
  const differences = [];
  
  // Handle null/undefined cases
  if (obj1 === null || obj1 === undefined || obj2 === null || obj2 === undefined) {
    if (obj1 !== obj2) {
      differences.push(path || 'root');
    }
    return { identical: differences.length === 0, differences };
  }

  // Handle primitive types
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    if (obj1 !== obj2) {
      // For strings, check if they're semantically similar (ignore minor wording differences)
      if (typeof obj1 === 'string' && typeof obj2 === 'string') {
        const similarity = calculateStringSimilarity(obj1, obj2);
        if (similarity < 0.95) { // 95% similarity threshold
          differences.push(path || 'value');
        }
      } else {
        differences.push(path || 'value');
      }
    }
    return { identical: differences.length === 0, differences };
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      differences.push(`${path}.length`);
    }
    
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = `${path}[${i}]`;
      const itemComparison = deepCompare(obj1[i], obj2[i], itemPath, evaluationType);
      differences.push(...itemComparison.differences);
    }
    
    return { identical: differences.length === 0, differences };
  }

  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  const allKeys = new Set([...keys1, ...keys2]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj1)) {
      differences.push(`${newPath} (missing in first)`);
      continue;
    }
    
    if (!(key in obj2)) {
      differences.push(`${newPath} (missing in second)`);
      continue;
    }

    const keyComparison = deepCompare(obj1[key], obj2[key], newPath, evaluationType);
    differences.push(...keyComparison.differences);
  }

  return { identical: differences.length === 0, differences };
}

/**
 * Calculate string similarity using Levenshtein distance
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateStringSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Generate recommendations based on variance analysis
 * 
 * @param {Object} analysis - Variance analysis results
 * @param {string} evaluationType - Type of evaluation
 * @returns {Array<string>} Array of recommendation strings
 */
function generateRecommendations(analysis, evaluationType) {
  const recommendations = [];

  if (analysis.consistency_score >= 95) {
    recommendations.push('✅ Excellent consistency! Current configuration (temperature: 0, topK: 1, topP: 1.0, candidateCount: 1, seed: 42) is working well.');
    recommendations.push('Consider implementing response caching for identical inputs to guarantee 100% consistency and reduce API costs.');
  } else if (analysis.consistency_score >= 80) {
    recommendations.push('⚠️ Good consistency, but some variance detected. Review differing fields to identify patterns.');
    recommendations.push('Consider switching from streaming (generateContentStream) to non-streaming (generateContent) API calls.');
    recommendations.push('Verify that all config parameters (topP, candidateCount) are being passed correctly to the Gemini API.');
  } else if (analysis.consistency_score >= 60) {
    recommendations.push('⚠️ Moderate variance detected. Prompt engineering improvements needed.');
    recommendations.push('Add more explicit scoring formulas and checklists in prompts to reduce interpretation variance.');
    recommendations.push('Consider using example-based few-shot prompting to demonstrate expected output format.');
    recommendations.push('Test with non-streaming API calls (generateContent instead of generateContentStream).');
  } else {
    recommendations.push('❌ High variance detected. Urgent action needed:');
    recommendations.push('1. Verify Gemini API configuration is being applied correctly (check server logs).');
    recommendations.push('2. Simplify prompts with more deterministic instructions (checklists, formulas, exact thresholds).');
    recommendations.push('3. Switch to non-streaming API calls.');
    recommendations.push('4. Consider using a different model version or API endpoint.');
    recommendations.push('5. Implement response validation and retry logic with stricter constraints.');
  }

  // Specific recommendations based on differing fields
  if (analysis.differing_fields.length > 0) {
    const feedbackFields = analysis.differing_fields.filter(f => 
      f.includes('feedback') || f.includes('Feedback')
    );
    
    if (feedbackFields.length > 0) {
      recommendations.push('📝 Feedback text is varying. Consider using more structured feedback templates in prompts.');
    }

    const scoreFields = analysis.differing_fields.filter(f => 
      f.includes('Level') || f.includes('level') || f.includes('Accuracy')
    );
    
    if (scoreFields.length > 0) {
      recommendations.push('🎯 Scoring levels are inconsistent. Strengthen level determination criteria in prompts with exact thresholds.');
    }
  }

  return recommendations;
}

/**
 * POST /analyze-video
 * 
 * Multimodal video analysis using Qwen2-VL-7B-Instruct
 * Processes video frames and transcript to provide comprehensive evaluation
 * 
 * Request Body:
 * {
 *   "frames": ["https://...", "data:image/jpeg;base64,..."],  // Array of image URLs or base64
 *   "transcript": "Video transcript text...",                  // Required transcript
 *   "customPrompt": "Optional custom evaluation prompt",       // Optional
 *   "timeout": 60000,                                          // Optional, default 60s
 *   "maxRetries": 2                                            // Optional, default 2
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "raw": "Full model response text",
 *   "parsed": {
 *     "summary": "...",
 *     "key_learning_points": [...],
 *     "content_quality_score": 8,
 *     "quality_analysis": {...},
 *     "suggestions_for_improvement": [...],
 *     "target_audience": "...",
 *     "estimated_comprehension_level": "..."
 *   },
 *   "metadata": {
 *     "model": "Qwen/Qwen2-VL-7B-Instruct",
 *     "frames_analyzed": 5,
 *     "transcript_length": 1234,
 *     "attempt": 1,
 *     "timestamp": "2026-02-16T..."
 *   }
 * }
 */
app.post('/analyze-video', async (req, res) => {
  try {
    console.log('\n=== QWEN2-VL VIDEO ANALYSIS REQUEST ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const { frames, transcript, customPrompt, timeout, maxRetries } = req.body;
    
    // Input validation
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      console.error('❌ Validation failed: Missing or invalid frames array');
      return res.status(400).json({ 
        error: 'Missing or invalid frames array',
        details: 'Request must include "frames" array with at least one image URL or base64 string'
      });
    }
    
    if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
      console.error('❌ Validation failed: Missing or invalid transcript');
      return res.status(400).json({ 
        error: 'Missing or invalid transcript',
        details: 'Request must include "transcript" as a non-empty string'
      });
    }
    
    // Log request details
    console.log(`📊 Frames: ${frames.length}`);
    console.log(`📝 Transcript length: ${transcript.length} characters`);
    if (customPrompt) {
      console.log('✏️ Custom prompt provided');
    }
    if (timeout) {
      console.log(`⏱️ Custom timeout: ${timeout}ms`);
    }
    if (maxRetries) {
      console.log(`🔄 Max retries: ${maxRetries}`);
    }
    
    // Validate frame format (basic check for URLs or base64)
    const invalidFrames = frames.filter(frame => {
      if (typeof frame !== 'string') return true;
      
      // Check if it's a valid URL
      try {
        new URL(frame);
        return false;
      } catch {
        // Check if it's base64
        return !frame.startsWith('data:image/');
      }
    });
    
    if (invalidFrames.length > 0) {
      console.error('❌ Validation failed: Invalid frame format detected');
      return res.status(400).json({ 
        error: 'Invalid frame format',
        details: 'Each frame must be a valid image URL or base64-encoded data URI (data:image/...)',
        invalid_count: invalidFrames.length
      });
    }
    
    // Call analysis service
    console.log('🚀 Calling Qwen2-VL analysis service...');
    const result = await analyzeVideo({
      frames,
      transcript,
      customPrompt,
      timeout,
      maxRetries
    });
    
    console.log('✅ Analysis completed successfully');
    console.log(`📈 Quality Score: ${result.parsed?.content_quality_score || 'N/A'}/10`);
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Analysis error:', error);
    
    // Handle specific error types
    if (error.message.includes('HF_TOKEN')) {
      return res.status(500).json({ 
        error: 'Configuration error',
        details: 'Hugging Face API token not configured. Set HF_TOKEN environment variable.',
        message: error.message
      });
    }
    
    if (error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timeout',
        details: 'Analysis took too long to complete. Try reducing frame count or extending timeout.',
        message: error.message
      });
    }
    
    if (error.message.includes('retry') || error.message.includes('attempts')) {
      return res.status(502).json({ 
        error: 'Service temporarily unavailable',
        details: 'Analysis failed after multiple retry attempts. Please try again later.',
        message: error.message
      });
    }
    
    // Generic error response
    return res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message,
      details: 'An unexpected error occurred during video analysis'
    });
  }
});

/**
 * GET /qwen2vl-health
 * 
 * Health check endpoint for Qwen2-VL service
 * Verifies API token configuration and model availability
 * 
 * Response:
 * {
 *   "status": "healthy" | "unhealthy",
 *   "model": "Qwen/Qwen2-VL-7B-Instruct",
 *   "token_configured": true,
 *   "timestamp": "2026-02-16T..."
 * }
 */
app.get('/qwen2vl-health', async (req, res) => {
  try {
    console.log('🏥 Qwen2-VL health check requested');
    const health = await checkServiceHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    console.log(`${health.status === 'healthy' ? '✅' : '❌'} Health status: ${health.status}`);
    
    return res.status(statusCode).json(health);
  } catch (error) {
    console.error('❌ Health check error:', error);
    return res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      token_configured: !!process.env.HF_TOKEN,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`Evaluation API listening on http://localhost:${PORT}`);
});
