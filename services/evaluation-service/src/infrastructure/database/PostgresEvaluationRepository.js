/**
 * Infrastructure Adapter: PostgreSQL Evaluation Repository
 * Implements the IEvaluationRepository interface using PostgreSQL
 */

import pkg from 'pg';
const { Pool } = pkg;
import { IEvaluationRepository } from '../../domain/repositories/IEvaluationRepository.js';
import { Evaluation } from '../../domain/entities/Evaluation.js';

export class PostgresEvaluationRepository extends IEvaluationRepository {
  constructor(dbConfig) {
    super();
    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port || 5432,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      ssl: dbConfig.ssl === 'true' || dbConfig.ssl === true 
        ? { rejectUnauthorized: false } 
        : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10
    });

    // Test connection
    this.pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('❌ PostgreSQL connection error:', err.message);
      } else {
        console.log('✅ Connected to PostgreSQL database');
      }
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle client:', err);
    });
  }

  /**
   * Saves a concept evaluation
   * @param {Evaluation} evaluation - The evaluation entity
   * @returns {Promise<number>} - The ID of the saved evaluation
   */
  async saveConceptEvaluation(evaluation) {
    const dbData = evaluation.toConceptDbFormat();

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
      dbData.email,
      dbData.project_name,
      dbData.page_name,
      dbData.video_url,
      dbData.concept_explanation_accuracy,
      dbData.concept_explanation_feedback,
      dbData.ability_to_explain_evaluation,
      dbData.ability_to_explain_feedback
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving concept evaluation:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Saves a project evaluation
   * @param {Evaluation} evaluation - The evaluation entity
   * @returns {Promise<number>} - The ID of the saved evaluation
   */
  async saveProjectEvaluation(evaluation) {
    const dbData = evaluation.toProjectDbFormat();

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
      dbData.email,
      dbData.project_name,
      dbData.video_url,
      dbData.project_explanation_evaluation,
      dbData.project_explanation_feedback,
      dbData.project_explanation_evaluationjson
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving project evaluation:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Gets concept evaluation history for a user
   * @param {string} userEmail - User's email
   * @param {number} limit - Maximum results
   * @param {number} offset - Results to skip
   * @returns {Promise<Array<Evaluation>>}
   */
  async getConceptHistory(userEmail, limit = 50, offset = 0) {
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
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.pool.query(query, [userEmail, limit, offset]);
      return result.rows.map(row => Evaluation.fromConceptDbRow(row));
    } catch (error) {
      console.error('❌ Error fetching concept history:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Gets project evaluation history for a user
   * @param {string} userEmail - User's email
   * @param {number} limit - Maximum results
   * @param {number} offset - Results to skip
   * @returns {Promise<Array<Evaluation>>}
   */
  async getProjectHistory(userEmail, limit = 50, offset = 0) {
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
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await this.pool.query(query, [userEmail, limit, offset]);
      return result.rows.map(row => Evaluation.fromProjectDbRow(row));
    } catch (error) {
      console.error('❌ Error fetching project history:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Gets a single evaluation by ID and type
   * @param {number} id - Evaluation ID
   * @param {string} type - 'concept' or 'project'
   * @returns {Promise<Evaluation|null>}
   */
  async getEvaluationById(id, type) {
    let query, mapper;

    if (type === 'concept') {
      query = `
        SELECT * FROM tbl_ailabs_ytfeedback_concept_evaluations
        WHERE id = $1
      `;
      mapper = Evaluation.fromConceptDbRow;
    } else if (type === 'project') {
      query = `
        SELECT * FROM tbl_ailabs_ytfeedback_project_evaluation
        WHERE id = $1
      `;
      mapper = Evaluation.fromProjectDbRow;
    } else {
      throw new Error('Invalid evaluation type');
    }

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows.length > 0 ? mapper(result.rows[0]) : null;
    } catch (error) {
      console.error('❌ Error fetching evaluation:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Deletes an evaluation
   * @param {number} id - Evaluation ID
   * @param {string} type - 'concept' or 'project'
   * @returns {Promise<boolean>}
   */
  async deleteEvaluation(id, type) {
    const table = type === 'concept'
      ? 'tbl_ailabs_ytfeedback_concept_evaluations'
      : 'tbl_ailabs_ytfeedback_project_evaluation';

    const query = `DELETE FROM ${table} WHERE id = $1`;

    try {
      const result = await this.pool.query(query, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('❌ Error deleting evaluation:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Gets evaluation statistics for a user
   * @param {string} userEmail - User's email
   * @returns {Promise<Object>}
   */
  async getEvaluationStats(userEmail) {
    try {
      const conceptQuery = `
        SELECT 
          COUNT(*) as total_count,
          AVG(concept_explanation_accuracy) as avg_accuracy
        FROM tbl_ailabs_ytfeedback_concept_evaluations
        WHERE email = $1
      `;

      const projectQuery = `
        SELECT COUNT(*) as total_count
        FROM tbl_ailabs_ytfeedback_project_evaluation
        WHERE email = $1
      `;

      const [conceptResult, projectResult] = await Promise.all([
        this.pool.query(conceptQuery, [userEmail]),
        this.pool.query(projectQuery, [userEmail])
      ]);

      return {
        concept: {
          total: parseInt(conceptResult.rows[0].total_count),
          avgAccuracy: parseFloat(conceptResult.rows[0].avg_accuracy) || 0
        },
        project: {
          total: parseInt(projectResult.rows[0].total_count)
        },
        totalEvaluations: 
          parseInt(conceptResult.rows[0].total_count) +
          parseInt(projectResult.rows[0].total_count)
      };
    } catch (error) {
      console.error('❌ Error fetching evaluation stats:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Closes the database connection pool
   */
  async close() {
    await this.pool.end();
  }
}
