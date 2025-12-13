/**
 * @fileoverview Controller for database storage and retrieval operations
 * @module server/controllers/databaseController
 */

import * as dbService from '../services/databaseService.js';

/**
 * Handles storing evaluation results in the database
 * Routes to appropriate service based on video type
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.userId - User ID
 * @param {string} req.body.userEmail - User's email address
 * @param {string} req.body.videoUrl - Video URL
 * @param {string} req.body.videoType - Type of video ('concept' or 'project')
 * @param {Object} req.body.evaluationData - Complete evaluation data
 * @param {string} req.body.selectedPhase - Project phase name
 * @param {string} req.body.selectedVideoTitle - Video title/page name
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with storage result
 */
export const storeEvaluation = async (req, res) => {
  try {
    const { 
      userId, 
      userEmail, 
      videoUrl, 
      videoType, 
      evaluationData,
      selectedPhase,
      selectedVideoTitle 
    } = req.body;

    console.log('→ Received evaluation storage request:', { 
      userId, 
      userEmail, 
      videoUrl, 
      videoType,
      selectedPhase, 
      selectedVideoTitle 
    });

    // Validate required fields
    if (!userId || !userEmail || !videoUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, userEmail, videoUrl' 
      });
    }

    let result;

    // Route to appropriate storage service based on video type
    if (videoType === 'concept') {
      result = await dbService.storeConceptEvaluation({
        userEmail,
        selectedPhase,
        selectedVideoTitle,
        videoUrl,
        evaluationData
      });
    } else {
      result = await dbService.storeProjectEvaluation({
        userEmail,
        selectedPhase,
        videoUrl,
        evaluationData
      });
    }

    res.json(result);
  } catch (err) {
    console.error('✗ Store evaluation error:', err);
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Fetches concept evaluation history for a user
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.email - User's email address
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with history data
 */
export const getConceptHistory = async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const result = await dbService.getConceptHistory(userEmail);
    res.json(result);
  } catch (err) {
    console.error('✗ Get concept history error:', err);
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Fetches project evaluation history for a user
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.email - User's email address
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with history data
 */
export const getProjectHistory = async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const result = await dbService.getProjectHistory(userEmail);
    res.json(result);
  } catch (err) {
    console.error('✗ Get project history error:', err);
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Fetches a single concept evaluation by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Evaluation record ID
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with evaluation data
 */
export const getConceptEvaluationById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbService.getConceptEvaluationById(id);
    res.json(result);
  } catch (err) {
    console.error('✗ Get concept evaluation error:', err);
    
    if (err.message === 'Concept evaluation not found') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Fetches a single project evaluation by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Evaluation record ID
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with evaluation data
 */
export const getProjectEvaluationById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbService.getProjectEvaluationById(id);
    res.json(result);
  } catch (err) {
    console.error('✗ Get project evaluation error:', err);
    
    if (err.message === 'Project evaluation not found') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Deletes a concept evaluation by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Evaluation record ID
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with deletion result
 */
export const deleteConceptEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbService.deleteConceptEvaluation(id);
    res.json(result);
  } catch (err) {
    console.error('✗ Delete concept evaluation error:', err);
    
    if (err.message === 'Concept evaluation not found') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Deletes a project evaluation by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Evaluation record ID
 * 
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with deletion result
 */
export const deleteProjectEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbService.deleteProjectEvaluation(id);
    res.json(result);
  } catch (err) {
    console.error('✗ Delete project evaluation error:', err);
    
    if (err.message === 'Project evaluation not found') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: String(err) });
  }
};
