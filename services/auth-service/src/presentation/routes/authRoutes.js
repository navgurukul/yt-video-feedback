const express = require('express');

/**
 * Authentication Routes
 */
function createAuthRoutes(authController) {
  const router = express.Router();

  // Health check
  router.get('/health', (req, res) => authController.healthCheck(req, res));

  // Authentication endpoints
  router.post('/login', (req, res) => authController.login(req, res));
  router.post('/api-key', (req, res) => authController.setApiKey(req, res));
  router.post('/verify-token', (req, res) => authController.verifyTokenEndpoint(req, res));
  router.get('/api-key/:email', (req, res) => authController.getApiKey(req, res));

  return router;
}

module.exports = createAuthRoutes;
