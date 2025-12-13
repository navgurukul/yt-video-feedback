/**
 * @fileoverview Gemini AI evaluation service for video analysis
 * @module server/services/geminiService
 */

import { createGeminiClient, GEMINI_MODEL } from '../config/gemini.js';

/**
 * Evaluates a video using Google Gemini AI with streaming response
 * 
 * @param {Object} params - Evaluation parameters
 * @param {string} params.videoUrl - URI of the uploaded video file
 * @param {string} params.videoDetails - Detailed context about the video content
 * @param {string} params.promptBeginning - Evaluation prompt instructions
 * @param {Object} params.rubric - Scoring rubric (optional)
 * @param {Object} params.structuredReturnConfig - Response format configuration
 * 
 * @returns {Promise<Object>} Evaluation results containing raw and parsed response
 * @returns {string} return.raw - Raw text response from AI
 * @returns {string} return.text - Cleaned text response
 * @returns {Object|null} return.parsed - Parsed JSON object from response
 * 
 * @throws {Error} If API call fails or response is invalid
 */
export const evaluateVideoWithGemini = async ({
  videoUrl,
  videoDetails,
  promptBeginning,
  rubric,
  structuredReturnConfig
}) => {
  const ai = createGeminiClient();
  
  // Build rubric section if provided
  const rubricContent = (rubric && Object.keys(rubric).length > 0) 
    ? `RUBRIC:\n${JSON.stringify(rubric)}`
    : '';

  // Construct complete prompt
  const promptText = `${promptBeginning}
    VIDEO DETAILS:
    ${videoDetails}

    ${rubricContent}`;

  // Handle different config formats (generationConfig wrapper vs direct config)
  const apiConfig = structuredReturnConfig.generationConfig 
    ? structuredReturnConfig.generationConfig 
    : structuredReturnConfig;

  // Prepare request contents
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

  console.log('→ Calling Gemini API for video evaluation (streaming mode)');

  try {
    // Call streaming API
    const response = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      config: apiConfig,
      contents,
    });

    // Collect streaming response chunks
    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    console.log('✓ Stream finished, response received');

    // Parse JSON response
    let parsed = null;
    try {
      parsed = JSON.parse(fullResponse);
    } catch (err) {
      console.warn('⚠ Failed to parse JSON, attempting extraction...');
      // Try to extract JSON from markdown code blocks or other text
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('✗ Failed to parse extracted JSON:', e);
        }
      }
    }

    return { 
      raw: fullResponse, 
      text: fullResponse, 
      parsed 
    };
  } catch (error) {
    console.error('✗ Gemini API error:', error);
    throw new Error(`Upstream model API error: ${error.message || String(error)}`);
  }
};
