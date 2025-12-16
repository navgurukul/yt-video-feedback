/**
 * Repository Interface: AI Service
 * Defines the contract for AI evaluation operations
 * Following Hexagonal Architecture, this is a port that will be implemented by an adapter
 */

export class IAIService {
  /**
   * Evaluates a video using AI
   * @param {EvaluationRequest} request - The evaluation request with all necessary details
   * @returns {Promise<Object>} - The evaluation result from AI
   *   {
   *     raw: string,        // Raw response text
   *     text: string,       // Processed text
   *     parsed: Object|null // Parsed JSON object if applicable
   *   }
   */
  async evaluateVideo(request) {
    throw new Error('Method not implemented');
  }

  /**
   * Tests the AI service connection
   * @param {string} apiKey - API key to test
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection(apiKey) {
    throw new Error('Method not implemented');
  }

  /**
   * Gets the available AI models
   * @returns {Promise<Array<string>>} - List of available model names
   */
  async getAvailableModels() {
    throw new Error('Method not implemented');
  }
}
