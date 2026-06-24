/**
 * Qwen2-VL-7B-Instruct Multimodal Video Analysis Service
 * 
 * This service integrates Hugging Face's Qwen2-VL-7B-Instruct model for analyzing
 * video content using both visual frames and transcript text.
 * 
 * Features:
 * - Multimodal input processing (images + text)
 * - Structured JSON output
 * - Production-grade error handling
 * - Timeout protection
 * - Retry logic for transient failures
 * 
 * @module qwen2vl-service
 */

import { HfInference } from '@huggingface/inference';

/**
 * Initialize Hugging Face client with API token
 * Token should be stored in HF_TOKEN environment variable
 */
const getHfClient = () => {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  
  if (!token) {
    throw new Error('HF_TOKEN environment variable is required for Qwen2-VL analysis');
  }
  
  return new HfInference(token);
};

/**
 * Format multimodal content for Qwen2-VL model
 * Combines video frames and transcript into proper message format
 * 
 * @param {Array<string>} frames - Array of image URLs or base64-encoded images
 * @param {string} transcript - Video transcript text
 * @param {string} prompt - Evaluation instruction prompt
 * @returns {Array} Formatted messages for the model
 */
const formatMultimodalContent = (frames, transcript, prompt) => {
  const content = [];
  
  // Add each frame as an image input
  if (frames && frames.length > 0) {
    frames.forEach((frame, index) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: frame,
          // Optional: Add frame metadata
          detail: 'auto' // Can be 'low', 'high', or 'auto'
        }
      });
    });
  }
  
  // Add transcript text
  if (transcript) {
    content.push({
      type: 'text',
      text: `**Video Transcript:**\n${transcript}\n\n`
    });
  }
  
  // Add evaluation prompt
  content.push({
    type: 'text',
    text: prompt
  });
  
  return content;
};

/**
 * Extract structured JSON from model response
 * Handles various response formats (plain JSON, markdown-wrapped, etc.)
 * 
 * @param {string} responseText - Raw model response text
 * @returns {Object} Parsed JSON object
 */
const extractJSON = (responseText) => {
  try {
    // Try direct JSON parse first
    return JSON.parse(responseText);
  } catch (error) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try to find JSON object in text
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    
    throw new Error('No valid JSON found in response');
  }
};

/**
 * Analyze video content using Qwen2-VL-7B-Instruct model
 * 
 * This function sends multimodal input (video frames + transcript) to the
 * Qwen2-VL model and returns structured analysis results.
 * 
 * @param {Object} options - Analysis configuration
 * @param {Array<string>} options.frames - Video frames (image URLs or base64)
 * @param {string} options.transcript - Video transcript text
 * @param {string} options.customPrompt - Optional custom evaluation prompt
 * @param {number} options.timeout - Request timeout in milliseconds (default: 60000)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 2)
 * 
 * @returns {Promise<Object>} Structured analysis results
 * 
 * @example
 * const result = await analyzeVideo({
 *   frames: ['https://example.com/frame1.jpg', 'data:image/jpeg;base64,...'],
 *   transcript: 'Welcome to this HTML tutorial...',
 *   customPrompt: 'Evaluate this educational video on HTML basics'
 * });
 */
export async function analyzeVideo({
  frames = [],
  transcript = '',
  customPrompt = null,
  timeout = 60000,
  maxRetries = 2
}) {
  
  // Validation
  if (!frames || frames.length === 0) {
    throw new Error('At least one video frame is required for analysis');
  }
  
  if (!transcript || transcript.trim() === '') {
    throw new Error('Video transcript is required for analysis');
  }
  
  // Default evaluation prompt
  const defaultPrompt = `**Evaluation Task:**

Analyze this YouTube educational video based on the provided video frames and transcript.

Provide a comprehensive evaluation in the following JSON format:

{
  "summary": "Brief overview of the video content (2-3 sentences)",
  "key_learning_points": [
    "Learning point 1",
    "Learning point 2",
    "Learning point 3"
  ],
  "content_quality_score": 8,
  "quality_analysis": {
    "visual_clarity": "Assessment of visual presentation",
    "explanation_quality": "Assessment of explanations",
    "pacing": "Assessment of video pacing",
    "engagement": "Assessment of viewer engagement"
  },
  "suggestions_for_improvement": [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
  ],
  "target_audience": "Identified target audience level",
  "estimated_comprehension_level": "Beginner/Intermediate/Advanced"
}

**Scoring Guidelines:**
- Content Quality Score: 1-10 scale
  - 1-3: Poor quality, significant issues
  - 4-6: Average quality, some improvements needed
  - 7-8: Good quality, minor improvements possible
  - 9-10: Excellent quality, minimal improvements needed

Provide your response as valid JSON only, without additional commentary.`;

  const prompt = customPrompt || defaultPrompt;
  
  console.log('🎬 Starting Qwen2-VL video analysis...');
  console.log(`📊 Input: ${frames.length} frames, ${transcript.length} characters transcript`);
  
  // Initialize HF client
  const hf = getHfClient();
  
  // Retry logic
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
      
      // Format multimodal content
      const content = formatMultimodalContent(frames, transcript, prompt);
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout exceeded')), timeout);
      });
      
      // API request with timeout
      const apiPromise = hf.chatCompletion({
        model: 'Qwen/Qwen2-VL-7B-Instruct',
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        max_tokens: 2048,
        temperature: 0.3, // Lower temperature for more consistent structured output
        stream: false
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      // Extract response text
      const responseText = response.choices?.[0]?.message?.content || '';
      
      if (!responseText) {
        throw new Error('Empty response from model');
      }
      
      console.log('✅ Model response received');
      console.log(`📝 Response length: ${responseText.length} characters`);
      
      // Extract and parse JSON
      const parsed = extractJSON(responseText);
      
      console.log('✅ JSON parsing successful');
      
      return {
        success: true,
        raw: responseText,
        parsed: parsed,
        metadata: {
          model: 'Qwen/Qwen2-VL-7B-Instruct',
          frames_analyzed: frames.length,
          transcript_length: transcript.length,
          attempt: attempt,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Don't retry on validation errors
      if (error.message.includes('required') || error.message.includes('validation')) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  console.error('❌ All retry attempts failed');
  throw new Error(`Qwen2-VL analysis failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Health check for Qwen2-VL service
 * Verifies API token and model availability
 * 
 * @returns {Promise<Object>} Health status
 */
export async function checkServiceHealth() {
  try {
    const hf = getHfClient();
    
    // Simple test request to verify token works
    const testResponse = await hf.chatCompletion({
      model: 'Qwen/Qwen2-VL-7B-Instruct',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    });
    
    return {
      status: 'healthy',
      model: 'Qwen/Qwen2-VL-7B-Instruct',
      token_configured: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      token_configured: !!process.env.HF_TOKEN,
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  analyzeVideo,
  checkServiceHealth
};
