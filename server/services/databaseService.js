/**
 * @fileoverview Database operations service for evaluation storage and retrieval
 * @module server/services/databaseService
 */

import { pgPool } from '../config/database.js';

/**
 * Parses and extracts accuracy score and feedback from evaluation result
 * Supports both new structured format and legacy formats
 * 
 * @param {Object} accuracyEvaluation - Accuracy evaluation result object
 * @returns {Object} Extracted accuracy data
 * @returns {number|null} return.score - Accuracy score (0-100)
 * @returns {string} return.feedback - Structured feedback as JSON string or plain text
 */
const parseAccuracyEvaluation = (accuracyEvaluation) => {
  let accuracyScore = null;
  let accuracyFeedback = '';
  
  if (!accuracyEvaluation) {
    return { score: accuracyScore, feedback: accuracyFeedback };
  }

  try {
    const parsedAccuracy = accuracyEvaluation.parsed || accuracyEvaluation;
    
    // New structured format: "Accuracy Level" array
    if (parsedAccuracy?.["Accuracy Level"]?.length > 0) {
      const accuracyItem = parsedAccuracy["Accuracy Level"][0];
      const accuracyLevelString = accuracyItem["Accuracy Level"] || '';
      const feedbackObj = accuracyItem["Feedback"] || {};
      
      // Handle structured feedback (object with three fields)
      if (typeof feedbackObj === 'object' && feedbackObj !== null) {
        accuracyFeedback = JSON.stringify(feedbackObj);
      } else {
        accuracyFeedback = feedbackObj || '';
      }
      
      // Extract numeric percentage from accuracy level string
      const percentMatch = accuracyLevelString.match(/(\d+)\s*%/);
      const outOfMatch = accuracyLevelString.match(/(\d+)\s*(?:out of|\/)\s*100/);
      
      if (percentMatch) {
        accuracyScore = parseInt(percentMatch[1], 10);
      } else if (outOfMatch) {
        accuracyScore = parseInt(outOfMatch[1], 10);
      } else {
        const numericValue = parseFloat(accuracyLevelString);
        if (!isNaN(numericValue)) {
          accuracyScore = numericValue;
        }
      }
    }
    // Legacy format: criteria array
    else if (accuracyEvaluation.criteria?.length > 0) {
      const rawScore = accuracyEvaluation.criteria[0].score;
      accuracyScore = Math.max(1, Math.min(10, rawScore || 1));
      accuracyFeedback = accuracyEvaluation.criteria[0].feedback || '';
    }
    // Legacy format: overallScore
    else if (accuracyEvaluation.overallScore !== undefined) {
      const rawScore = accuracyEvaluation.overallScore;
      accuracyScore = Math.max(1, Math.min(10, rawScore || 1));
      accuracyFeedback = accuracyEvaluation.overallFeedback || '';
    }
  } catch (e) {
    console.warn('⚠ Failed to parse accuracy evaluation:', e);
  }

  return { score: accuracyScore, feedback: accuracyFeedback };
};

/**
 * Parses and extracts ability to explain evaluation level and feedback
 * Supports both new structured format and legacy formats
 * 
 * @param {Object} abilityEvaluation - Ability evaluation result object
 * @returns {Object} Extracted ability data
 * @returns {string} return.level - Evaluation level/description
 * @returns {string} return.feedback - Structured feedback as JSON string or plain text
 */
const parseAbilityEvaluation = (abilityEvaluation) => {
  let abilityEvaluationText = '';
  let abilityFeedback = '';
  
  if (!abilityEvaluation) {
    return { level: abilityEvaluationText, feedback: abilityFeedback };
  }

  try {
    const parsedAbility = abilityEvaluation.parsed || abilityEvaluation;
    
    // New structured format: "Ability to explain" array
    if (parsedAbility?.["Ability to explain"]?.length > 0) {
      const abilityItem = parsedAbility["Ability to explain"][0];
      abilityEvaluationText = abilityItem["Ability to explain"] || '';
      const feedbackObj = abilityItem["Structured Feedback"] || abilityItem["Feedback"] || {};
      
      // Handle structured feedback (object with three fields)
      if (typeof feedbackObj === 'object' && feedbackObj !== null) {
        abilityFeedback = JSON.stringify(feedbackObj);
      } else {
        abilityFeedback = feedbackObj || '';
      }
    }
    // Legacy format: criteria array
    else if (abilityEvaluation.criteria?.length > 0) {
      abilityEvaluationText = abilityEvaluation.criteria[0].name || '';
      abilityFeedback = abilityEvaluation.criteria[0].feedback || '';
    }
    // Legacy format: level property
    else if (abilityEvaluation.level) {
      abilityEvaluationText = abilityEvaluation.level;
      abilityFeedback = abilityEvaluation.overallFeedback || '';
    }
  } catch (e) {
    console.warn('⚠ Failed to parse ability evaluation:', e);
  }

  return { level: abilityEvaluationText, feedback: abilityFeedback };
};

/**
 * Stores concept evaluation data in the database
 * 
 * @param {Object} params - Concept evaluation parameters
 * @param {string} params.userEmail - User's email address
 * @param {string} params.selectedPhase - Project phase name
 * @param {string} params.selectedVideoTitle - Video title/page name
 * @param {string} params.videoUrl - Video URL
 * @param {Object} params.evaluationData - Complete evaluation data object
 * 
 * @returns {Promise<Object>} Database insertion result
 * @returns {boolean} return.success - Whether insertion succeeded
 * @returns {number} return.id - Database record ID
 * @returns {string} return.message - Success message
 */
export const storeConceptEvaluation = async ({
  userEmail,
  selectedPhase,
  selectedVideoTitle,
  videoUrl,
  evaluationData
}) => {
  const accuracyEvaluation = evaluationData.evaluation_result.accuracy;
  const abilityEvaluation = evaluationData.evaluation_result.abilityToExplain;
  
  // Parse evaluations
  const { score: accuracyScore, feedback: accuracyFeedback } = parseAccuracyEvaluation(accuracyEvaluation);
  const { level: abilityEvaluationText, feedback: abilityFeedback } = parseAbilityEvaluation(abilityEvaluation);
  
  console.log('→ Storing concept evaluation:', { accuracyScore, abilityEvaluationText });

  // Insert into database
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
    userEmail,
    selectedPhase || '',
    selectedVideoTitle || '',
    videoUrl,
    accuracyScore,
    accuracyFeedback,
    abilityEvaluationText,
    abilityFeedback
  ];

  const result = await pgPool.query(query, values);
  
  console.log('✓ Concept evaluation stored with ID:', result.rows[0].id);
  
  return {
    success: true,
    id: result.rows[0].id,
    message: 'Concept evaluation stored successfully'
  };
};

/**
 * Stores project evaluation data in the database
 * 
 * @param {Object} params - Project evaluation parameters
 * @param {string} params.userEmail - User's email address
 * @param {string} params.selectedPhase - Project phase name
 * @param {string} params.videoUrl - Video URL
 * @param {Object} params.evaluationData - Complete evaluation data object
 * 
 * @returns {Promise<Object>} Database insertion result
 * @returns {boolean} return.success - Whether insertion succeeded
 * @returns {number} return.id - Database record ID
 * @returns {string} return.message - Success message
 */
export const storeProjectEvaluation = async ({
  userEmail,
  selectedPhase,
  videoUrl,
  evaluationData
}) => {
  const projectEvaluation = evaluationData.evaluation_result;
  
  let evaluationText = '';
  let feedbackText = '';
  let evaluationJson = '';
  
  if (projectEvaluation) {
    // New structured format: parameters array
    if (projectEvaluation.parameters && Array.isArray(projectEvaluation.parameters)) {
      evaluationJson = JSON.stringify(projectEvaluation);
      
      // Create summary from parameters
      const parameterSummaries = projectEvaluation.parameters.map(param => 
        `${param.name} (${param.weightage}%): ${param.level}`
      ).join('; ');
      
      evaluationText = parameterSummaries;
      
      // Combine all feedback (supports both new and old formats)
      const allFeedback = projectEvaluation.parameters.map(param => {
        const fb = param.feedback || {};
        
        // New format: three specific fields
        if (fb["What could you do well?"] || fb["What can you do better?"] || fb["Next Suggested Deep Dive?"]) {
          return `${param.name}:\n  ✓ What could you do well?: ${fb["What could you do well?"] || 'N/A'}\n  ✗ What can you do better?: ${fb["What can you do better?"] || 'N/A'}\n  ⚠ Next Suggested Deep Dive?: ${fb["Next Suggested Deep Dive?"] || 'N/A'}`;
        }
        // Old format: good/bad/ugly
        else {
          return `${param.name}:\n  ✓ Good: ${fb.good || 'N/A'}\n  ✗ Bad: ${fb.bad || 'N/A'}\n  ⚠ Improvements: ${fb.ugly || 'N/A'}`;
        }
      }).join('\n\n');
      
      feedbackText = allFeedback;
    }
    // Legacy format
    else {
      evaluationJson = JSON.stringify(projectEvaluation);
      evaluationText = projectEvaluation.overallScore ? `Overall Score: ${projectEvaluation.overallScore}` : '';
      feedbackText = projectEvaluation.overallFeedback || '';
    }
  }
  
  console.log('→ Storing project evaluation');

  // Insert into database
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
    userEmail,
    selectedPhase,
    videoUrl,
    evaluationText,
    feedbackText,
    evaluationJson
  ];

  const result = await pgPool.query(query, values);
  
  console.log('✓ Project evaluation stored with ID:', result.rows[0].id);
  
  return {
    success: true,
    id: result.rows[0].id,
    message: 'Project evaluation stored successfully'
  };
};

/**
 * Fetches concept evaluation history for a user
 * 
 * @param {string} userEmail - User's email address
 * @returns {Promise<Object>} Query result with evaluation data array
 */
export const getConceptHistory = async (userEmail) => {
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
  `;
  
  const result = await pgPool.query(query, [userEmail]);
  console.log(`✓ Retrieved ${result.rows.length} concept evaluations for ${userEmail}`);
  
  return {
    success: true,
    data: result.rows
  };
};

/**
 * Fetches project evaluation history for a user
 * 
 * @param {string} userEmail - User's email address
 * @returns {Promise<Object>} Query result with evaluation data array
 */
export const getProjectHistory = async (userEmail) => {
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
  `;
  
  const result = await pgPool.query(query, [userEmail]);
  console.log(`✓ Retrieved ${result.rows.length} project evaluations for ${userEmail}`);
  
  return {
    success: true,
    data: result.rows
  };
};

/**
 * Fetches a single concept evaluation by ID
 * 
 * @param {number} id - Evaluation record ID
 * @returns {Promise<Object>} Query result with single evaluation data
 * @throws {Error} If evaluation not found
 */
export const getConceptEvaluationById = async (id) => {
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
    WHERE id = $1
  `;
  
  const result = await pgPool.query(query, [id]);
  
  if (result.rows.length === 0) {
    throw new Error('Concept evaluation not found');
  }
  
  return {
    success: true,
    data: result.rows[0]
  };
};

/**
 * Fetches a single project evaluation by ID
 * 
 * @param {number} id - Evaluation record ID
 * @returns {Promise<Object>} Query result with single evaluation data
 * @throws {Error} If evaluation not found
 */
export const getProjectEvaluationById = async (id) => {
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
    WHERE id = $1
  `;
  
  const result = await pgPool.query(query, [id]);
  
  if (result.rows.length === 0) {
    throw new Error('Project evaluation not found');
  }
  
  return {
    success: true,
    data: result.rows[0]
  };
};

/**
 * Deletes a concept evaluation by ID
 * 
 * @param {number} id - Evaluation record ID
 * @returns {Promise<Object>} Deletion result
 * @throws {Error} If evaluation not found
 */
export const deleteConceptEvaluation = async (id) => {
  const query = `
    DELETE FROM tbl_ailabs_ytfeedback_concept_evaluations
    WHERE id = $1
    RETURNING id
  `;
  
  const result = await pgPool.query(query, [id]);
  
  if (result.rows.length === 0) {
    throw new Error('Concept evaluation not found');
  }
  
  return {
    success: true,
    message: 'Concept evaluation deleted successfully'
  };
};

/**
 * Deletes a project evaluation by ID
 * 
 * @param {number} id - Evaluation record ID
 * @returns {Promise<Object>} Deletion result
 * @throws {Error} If evaluation not found
 */
export const deleteProjectEvaluation = async (id) => {
  const query = `
    DELETE FROM tbl_ailabs_ytfeedback_project_evaluation
    WHERE id = $1
    RETURNING id
  `;
  
  const result = await pgPool.query(query, [id]);
  
  if (result.rows.length === 0) {
    throw new Error('Project evaluation not found');
  }
  
  return {
    success: true,
    message: 'Project evaluation deleted successfully'
  };
};
