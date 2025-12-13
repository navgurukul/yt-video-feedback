/**
 * @fileoverview API routes configuration
 * @module server/routes/api
 */

import express from 'express';
import * as evaluationController from '../controllers/evaluationController.js';
import * as databaseController from '../controllers/databaseController.js';

const router = express.Router();

/**
 * @route POST /evaluate
 * @description Evaluate a video using Gemini AI
 * @access Public
 */
router.post('/evaluate', evaluationController.evaluateVideo);

/**
 * @route POST /store-evaluation
 * @description Store evaluation results in database
 * @access Public
 */
router.post('/store-evaluation', databaseController.storeEvaluation);

/**
 * @route GET /concept-history
 * @description Get concept evaluation history for a user
 * @query {string} email - User's email address
 * @access Public
 */
router.get('/concept-history', databaseController.getConceptHistory);

/**
 * @route GET /project-history
 * @description Get project evaluation history for a user
 * @query {string} email - User's email address
 * @access Public
 */
router.get('/project-history', databaseController.getProjectHistory);

/**
 * @route GET /concept-evaluation/:id
 * @description Get a single concept evaluation by ID
 * @param {string} id - Evaluation record ID
 * @access Public
 */
router.get('/concept-evaluation/:id', databaseController.getConceptEvaluationById);

/**
 * @route GET /project-evaluation/:id
 * @description Get a single project evaluation by ID
 * @param {string} id - Evaluation record ID
 * @access Public
 */
router.get('/project-evaluation/:id', databaseController.getProjectEvaluationById);

/**
 * @route DELETE /concept-evaluation/:id
 * @description Delete a concept evaluation by ID
 * @param {string} id - Evaluation record ID
 * @access Public
 */
router.delete('/concept-evaluation/:id', databaseController.deleteConceptEvaluation);

/**
 * @route DELETE /project-evaluation/:id
 * @description Delete a project evaluation by ID
 * @param {string} id - Evaluation record ID
 * @access Public
 */
router.delete('/project-evaluation/:id', databaseController.deleteProjectEvaluation);

/**
 * @route GET /health
 * @description Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default router;
