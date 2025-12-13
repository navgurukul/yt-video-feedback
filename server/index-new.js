/**
 * @fileoverview Main Express server application
 * @module server/index
 * 
 * This is the entry point for the video evaluation API server.
 * Handles AI-powered video evaluation using Google Gemini and PostgreSQL storage.
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';

// Load environment variables
dotenv.config();

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

/**
 * Server port configuration
 * @constant {number}
 */
const PORT = process.env.PORT || 3001;

// Middleware configuration
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Mount API routes
app.use('/', apiRoutes);

/**
 * Start the Express server
 * Listens on configured port and logs startup message
 */
app.listen(PORT, () => {
  console.log('=================================');
  console.log('  Video Evaluation API Server');
  console.log('=================================');
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log('=================================');
});

export default app;
