/**
 * Use Case: Get Evaluation History
 * Retrieves evaluation history for a user
 */

export class GetEvaluationHistoryUseCase {
  constructor(evaluationRepository) {
    this.evaluationRepository = evaluationRepository;
  }

  /**
   * Executes the get evaluation history use case
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - Result with evaluation history
   */
  async execute(params) {
    try {
      const {
        userEmail,
        type, // 'concept' or 'project'
        limit = 50,
        offset = 0
      } = params;

      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      if (!type || !['concept', 'project'].includes(type)) {
        throw new Error('type must be either "concept" or "project"');
      }

      console.log('📚 Executing get evaluation history use case:', {
        userEmail,
        type,
        limit,
        offset
      });

      let history;
      if (type === 'concept') {
        history = await this.evaluationRepository.getConceptHistory(
          userEmail,
          limit,
          offset
        );
      } else {
        history = await this.evaluationRepository.getProjectHistory(
          userEmail,
          limit,
          offset
        );
      }

      console.log(`✅ Retrieved ${history.length} ${type} evaluations`);

      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error('❌ Error in get evaluation history use case:', error);
      return {
        success: false,
        error: error.message || 'Failed to retrieve evaluation history'
      };
    }
  }
}
