/**
 * Use Case: Evaluate Video
 * Orchestrates the video evaluation process using AI
 */

import { EvaluationRequest } from '../domain/entities/EvaluationRequest.js';
import { Evaluation } from '../domain/entities/Evaluation.js';

export class EvaluateVideoUseCase {
  constructor(aiService, evaluationRepository) {
    this.aiService = aiService;
    this.evaluationRepository = evaluationRepository;
  }

  /**
   * Executes the evaluate video use case
   * @param {Object} requestData - Request data from API
   * @returns {Promise<Object>} - Evaluation result
   */
  async execute(requestData) {
    try {
      // Create evaluation request entity
      const evaluationRequest = new EvaluationRequest({
        videoUrl: requestData.videoUrl,
        videoDetails: requestData.videoDetails,
        promptBeginning: requestData.promptbegining || requestData.promptBeginning,
        rubric: requestData.rubric,
        evaluationType: requestData.evaluationType,
        structuredReturnedConfig: requestData.structuredreturnedconfig || requestData.structuredReturnedConfig,
        apiKey: requestData.apiKey,
        userEmail: requestData.userEmail,
        userId: requestData.userId,
        selectedPhase: requestData.selectedPhase,
        selectedVideoTitle: requestData.selectedVideoTitle
      });

      // Validate request
      const validation = evaluationRequest.validate();
      if (!validation.valid) {
        throw new Error(`Invalid evaluation request: ${validation.errors.join(', ')}`);
      }

      console.log('🎯 Executing evaluate video use case:', evaluationRequest.toLogObject());

      // Call AI service to evaluate video
      const aiResult = await this.aiService.evaluateVideo(evaluationRequest);

      console.log('✅ AI evaluation completed');

      return {
        success: true,
        data: aiResult
      };
    } catch (error) {
      console.error('❌ Error in evaluate video use case:', error);
      return {
        success: false,
        error: error.message || 'Failed to evaluate video'
      };
    }
  }
}
