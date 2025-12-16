/**
 * API Controller: Evaluation Controller
 * Handles HTTP requests for evaluation operations
 */

import { JWTAuthMiddleware } from '../../infrastructure/auth/JWTAuthMiddleware.js';

export class EvaluationController {
  constructor(evaluateVideoUseCase, storeEvaluationUseCase, getEvaluationHistoryUseCase) {
    this.evaluateVideoUseCase = evaluateVideoUseCase;
    this.storeEvaluationUseCase = storeEvaluationUseCase;
    this.getEvaluationHistoryUseCase = getEvaluationHistoryUseCase;
  }

  /**
   * POST /api/evaluate
   * Evaluates a video using AI
   */
  async evaluate(req, res) {
    try {
      const requestData = {
        ...req.body,
        userEmail: JWTAuthMiddleware.getUserEmail(req),
        userId: JWTAuthMiddleware.getUserId(req)
      };

      // Validate required fields
      if (!requestData.videoUrl) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'videoUrl is required'
        });
      }

      if (!requestData.apiKey) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'apiKey is required'
        });
      }

      // Execute use case
      const result = await this.evaluateVideoUseCase.execute(requestData);

      if (!result.success) {
        return res.status(500).json({
          error: 'Evaluation Failed',
          message: result.error
        });
      }

      // Return evaluation result
      return res.json(result.data);
    } catch (error) {
      console.error('❌ Evaluation controller error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }

  /**
   * POST /api/store-evaluation
   * Stores evaluation results in database
   */
  async storeEvaluation(req, res) {
    try {
      const requestData = {
        ...req.body,
        userEmail: req.body.userEmail || JWTAuthMiddleware.getUserEmail(req),
        userId: req.body.userId || JWTAuthMiddleware.getUserId(req)
      };

      // Execute use case
      const result = await this.storeEvaluationUseCase.execute(requestData);

      if (!result.success) {
        return res.status(500).json({
          error: 'Storage Failed',
          message: result.error
        });
      }

      // Return success response
      return res.json(result.data);
    } catch (error) {
      console.error('❌ Store evaluation controller error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }

  /**
   * GET /api/concept-history
   * Gets concept evaluation history for a user
   */
  async getConceptHistory(req, res) {
    try {
      const userEmail = req.query.email || JWTAuthMiddleware.getUserEmail(req);

      if (!userEmail) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'email parameter is required'
        });
      }

      const result = await this.getEvaluationHistoryUseCase.execute({
        userEmail,
        type: 'concept',
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Fetch Failed',
          message: result.error
        });
      }

      return res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Get concept history controller error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }

  /**
   * GET /api/project-history
   * Gets project evaluation history for a user
   */
  async getProjectHistory(req, res) {
    try {
      const userEmail = req.query.email || JWTAuthMiddleware.getUserEmail(req);

      if (!userEmail) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'email parameter is required'
        });
      }

      const result = await this.getEvaluationHistoryUseCase.execute({
        userEmail,
        type: 'project',
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Fetch Failed',
          message: result.error
        });
      }

      return res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Get project history controller error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async health(req, res) {
    return res.json({
      status: 'healthy',
      service: 'evaluation-service',
      timestamp: new Date().toISOString()
    });
  }
}
