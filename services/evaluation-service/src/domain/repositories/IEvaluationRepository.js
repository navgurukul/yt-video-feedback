/**
 * Repository Interface: Evaluation Repository
 * Defines the contract for evaluation data persistence
 * Following Hexagonal Architecture, this is a port that will be implemented by an adapter
 */

export class IEvaluationRepository {
  /**
   * Saves a concept evaluation
   * @param {Evaluation} evaluation - The evaluation entity to save
   * @returns {Promise<number>} - The ID of the saved evaluation
   */
  async saveConceptEvaluation(evaluation) {
    throw new Error('Method not implemented');
  }

  /**
   * Saves a project evaluation
   * @param {Evaluation} evaluation - The evaluation entity to save
   * @returns {Promise<number>} - The ID of the saved evaluation
   */
  async saveProjectEvaluation(evaluation) {
    throw new Error('Method not implemented');
  }

  /**
   * Gets concept evaluation history for a user
   * @param {string} userEmail - User's email address
   * @param {number} limit - Maximum number of results to return
   * @param {number} offset - Number of results to skip
   * @returns {Promise<Array<Evaluation>>} - Array of concept evaluations
   */
  async getConceptHistory(userEmail, limit = 50, offset = 0) {
    throw new Error('Method not implemented');
  }

  /**
   * Gets project evaluation history for a user
   * @param {string} userEmail - User's email address
   * @param {number} limit - Maximum number of results to return
   * @param {number} offset - Number of results to skip
   * @returns {Promise<Array<Evaluation>>} - Array of project evaluations
   */
  async getProjectHistory(userEmail, limit = 50, offset = 0) {
    throw new Error('Method not implemented');
  }

  /**
   * Gets a single evaluation by ID and type
   * @param {number} id - Evaluation ID
   * @param {string} type - Evaluation type ('concept' or 'project')
   * @returns {Promise<Evaluation|null>} - The evaluation or null if not found
   */
  async getEvaluationById(id, type) {
    throw new Error('Method not implemented');
  }

  /**
   * Deletes an evaluation by ID and type
   * @param {number} id - Evaluation ID
   * @param {string} type - Evaluation type ('concept' or 'project')
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async deleteEvaluation(id, type) {
    throw new Error('Method not implemented');
  }

  /**
   * Gets evaluation statistics for a user
   * @param {string} userEmail - User's email address
   * @returns {Promise<Object>} - Statistics object with counts and averages
   */
  async getEvaluationStats(userEmail) {
    throw new Error('Method not implemented');
  }
}
