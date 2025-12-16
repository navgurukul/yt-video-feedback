/**
 * Use Case: Store Evaluation
 * Stores evaluation results in the database
 */

import { Evaluation } from '../domain/entities/Evaluation.js';

export class StoreEvaluationUseCase {
  constructor(evaluationRepository) {
    this.evaluationRepository = evaluationRepository;
  }

  /**
   * Executes the store evaluation use case
   * @param {Object} requestData - Request data from API
   * @returns {Promise<Object>} - Result with evaluation ID
   */
  async execute(requestData) {
    try {
      const {
        userId,
        userEmail,
        videoUrl,
        videoType,
        evaluationData,
        videoDetails,
        selectedPhase,
        selectedVideoTitle
      } = requestData;

      // Validate required fields
      if (!userEmail || !videoUrl) {
        throw new Error('Missing required fields: userEmail, videoUrl');
      }

      console.log('💾 Executing store evaluation use case:', {
        userEmail,
        videoUrl,
        videoType,
        selectedPhase,
        selectedVideoTitle
      });

      // Create evaluation entity
      const evaluation = new Evaluation({
        userId,
        userEmail,
        videoUrl,
        videoType,
        videoDetails,
        selectedPhase,
        selectedVideoTitle,
        evaluationResult: evaluationData.evaluation_result || evaluationData
      });

      // Validate evaluation
      if (!evaluation.isValid()) {
        throw new Error('Invalid evaluation data');
      }

      // Store based on evaluation type
      let evaluationId;
      if (evaluation.isConceptEvaluation()) {
        console.log('💾 Storing concept evaluation');
        evaluationId = await this.evaluationRepository.saveConceptEvaluation(evaluation);
      } else if (evaluation.isProjectEvaluation()) {
        console.log('💾 Storing project evaluation');
        evaluationId = await this.evaluationRepository.saveProjectEvaluation(evaluation);
      } else {
        throw new Error(`Invalid evaluation type: ${videoType}`);
      }

      console.log(`✅ Evaluation stored successfully with ID: ${evaluationId}`);

      return {
        success: true,
        data: {
          id: evaluationId,
          message: `${evaluation.videoType} evaluation stored successfully`
        }
      };
    } catch (error) {
      console.error('❌ Error in store evaluation use case:', error);
      return {
        success: false,
        error: error.message || 'Failed to store evaluation'
      };
    }
  }
}
