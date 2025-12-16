/**
 * API Routes: Evaluation Routes
 * Defines Express routes for evaluation endpoints
 */

import express from 'express';

export function createEvaluationRoutes(controller, jwtMiddleware) {
  const router = express.Router();

  /**
   * POST /evaluate
   * Evaluates a video using AI
   * Optional JWT authentication (can also use API key from body)
   */
  router.post('/evaluate', 
    jwtMiddleware.verify(true), // Optional JWT
    (req, res) => controller.evaluate(req, res)
  );

  /**
   * POST /store-evaluation
   * Stores evaluation results
   * Optional JWT authentication
   */
  router.post('/store-evaluation',
    jwtMiddleware.verify(true), // Optional JWT
    (req, res) => controller.storeEvaluation(req, res)
  );

  /**
   * GET /concept-history
   * Gets concept evaluation history
   * Optional JWT authentication (can also use email query param)
   */
  router.get('/concept-history',
    jwtMiddleware.verify(true), // Optional JWT
    (req, res) => controller.getConceptHistory(req, res)
  );

  /**
   * GET /project-history
   * Gets project evaluation history
   * Optional JWT authentication (can also use email query param)
   */
  router.get('/project-history',
    jwtMiddleware.verify(true), // Optional JWT
    (req, res) => controller.getProjectHistory(req, res)
  );

  /**
   * GET /health
   * Health check endpoint
   * No authentication required
   */
  router.get('/health', (req, res) => controller.health(req, res));

  return router;
}
