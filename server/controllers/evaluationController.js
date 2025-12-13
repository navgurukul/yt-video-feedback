/**
 * @fileoverview Controller for video evaluation endpoint
 * @module server/controllers/evaluationController
 */

import { evaluateVideoWithGemini } from '../services/geminiService.js';
import { GEMINI_KEY } from '../config/gemini.js';

/**
 * Handles video evaluation requests
 * Validates input and delegates to Gemini AI service
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.videoUrl - Video file URI
 * @param {string} req.body.videoDetails - Video context details
 * @param {string} req.body.promptbegining - Evaluation prompt
 * @param {Object} req.body.rubric - Scoring rubric (optional)
 * @param {string} req.body.evaluationType - Type of evaluation being performed
 * @param {Object} req.body.structuredreturnedconfig - Response format config
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with evaluation results
 */
export const evaluateVideo = async (req, res) => {
  try {
    const { 
      videoUrl, 
      videoDetails, 
      promptbegining, 
      rubric, 
      evaluationType, 
      structuredreturnedconfig 
    } = req.body;

    // Validate required fields
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing videoUrl' });
    }
    
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    // Call Gemini service
    const result = await evaluateVideoWithGemini({
      videoUrl,
      videoDetails,
      promptBeginning: promptbegining,
      rubric,
      structuredReturnConfig: structuredreturnedconfig
    });

    return res.json(result);
  } catch (err) {
    console.error('✗ Evaluation controller error:', err);
    
    // Handle upstream API errors
    if (err.message?.includes('Upstream model API error')) {
      return res.status(502).json({ 
        error: 'Upstream model API error', 
        message: err.message
      });
    }
    
    return res.status(500).json({ error: String(err) });
  }
};
