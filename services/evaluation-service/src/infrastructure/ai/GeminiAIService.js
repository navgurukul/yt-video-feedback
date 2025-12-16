/**
 * Infrastructure Adapter: Gemini AI Service
 * Implements the IAIService interface using Google Gemini AI
 */

import { GoogleGenAI } from '@google/genai';
import { IAIService } from '../../domain/repositories/IAIService.js';

export class GeminiAIService extends IAIService {
  constructor() {
    super();
    this.model = 'gemini-2.5-flash';
  }

  /**
   * Evaluates a video using Gemini AI
   * @param {EvaluationRequest} request - The evaluation request
   * @returns {Promise<Object>} - The evaluation result
   */
  async evaluateVideo(request) {
    try {
      console.log(`🤖 Calling Gemini API (${request.evaluationType} evaluation, streaming)`);

      // Initialize Gemini client with API key
      const ai = new GoogleGenAI({ apiKey: request.apiKey });
      
      // Build contents and config from request
      const contents = request.buildContents();
      const config = request.getApiConfig();

      // Call the streaming API
      const response = await ai.models.generateContentStream({
        model: this.model,
        config,
        contents,
      });

      // Collect the streaming response chunks
      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      console.log('🤖 Gemini stream finished');

      // Parse the JSON response
      let parsed = null;
      try {
        parsed = JSON.parse(fullResponse);
      } catch (err) {
        console.warn('⚠️ Failed to parse JSON from response, attempting extraction:', err.message);
        // Try to extract JSON from the text
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully extracted and parsed JSON');
          } catch (e) {
            console.error('❌ Failed to parse extracted JSON:', e.message);
          }
        }
      }

      return {
        raw: fullResponse,
        text: fullResponse,
        parsed
      };
    } catch (error) {
      console.error('❌ Gemini API error:', error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('API key')) {
        throw new Error('Invalid or missing Gemini API key');
      }
      
      if (error.message && error.message.includes('quota')) {
        throw new Error('Gemini API quota exceeded');
      }

      if (error.message && error.message.includes('not found')) {
        throw new Error('Video not found or inaccessible');
      }

      throw new Error(`Gemini API error: ${error.message || String(error)}`);
    }
  }

  /**
   * Tests the Gemini API connection
   * @param {string} apiKey - API key to test
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection(apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      // Try to list models as a simple test
      await ai.models.list();
      return true;
    } catch (error) {
      console.error('❌ Gemini connection test failed:', error);
      return false;
    }
  }

  /**
   * Gets available Gemini models
   * @returns {Promise<Array<string>>} - List of model names
   */
  async getAvailableModels() {
    try {
      // This would require a valid API key, return default for now
      return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    } catch (error) {
      console.error('❌ Failed to get available models:', error);
      return ['gemini-2.5-flash'];
    }
  }
}
