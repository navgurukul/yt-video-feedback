/**
 * Domain Entity: Evaluation
 * Represents a video evaluation in the system
 */

export class Evaluation {
  constructor({
    id = null,
    userId,
    userEmail,
    videoUrl,
    videoType, // 'concept' or 'project'
    videoDetails,
    selectedPhase,
    selectedVideoTitle,
    evaluationResult,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.userId = userId;
    this.userEmail = userEmail;
    this.videoUrl = videoUrl;
    this.videoType = videoType;
    this.videoDetails = videoDetails;
    this.selectedPhase = selectedPhase;
    this.selectedVideoTitle = selectedVideoTitle;
    this.evaluationResult = evaluationResult;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Validates the evaluation entity
   * @returns {boolean}
   */
  isValid() {
    return (
      this.userEmail &&
      this.videoUrl &&
      this.videoType &&
      ['concept', 'project'].includes(this.videoType)
    );
  }

  /**
   * Checks if this is a concept evaluation
   * @returns {boolean}
   */
  isConceptEvaluation() {
    return this.videoType === 'concept';
  }

  /**
   * Checks if this is a project evaluation
   * @returns {boolean}
   */
  isProjectEvaluation() {
    return this.videoType === 'project';
  }

  /**
   * Gets the accuracy score for concept evaluations
   * @returns {number|null}
   */
  getAccuracyScore() {
    if (!this.isConceptEvaluation() || !this.evaluationResult) {
      return null;
    }

    const accuracy = this.evaluationResult.accuracy;
    if (!accuracy || !accuracy.parsed) {
      return null;
    }

    const accuracyLevel = accuracy.parsed["Accuracy Level"];
    if (!Array.isArray(accuracyLevel) || accuracyLevel.length === 0) {
      return null;
    }

    const accuracyLevelString = accuracyLevel[0]["Accuracy Level"] || '';
    
    // Extract numeric score from string
    const percentMatch = accuracyLevelString.match(/(\d+)\s*%/);
    const outOfMatch = accuracyLevelString.match(/(\d+)\s*(?:out of|\/)\s*100/);
    
    if (percentMatch) {
      return parseInt(percentMatch[1], 10);
    } else if (outOfMatch) {
      return parseInt(outOfMatch[1], 10);
    }
    
    const numericValue = parseFloat(accuracyLevelString);
    return !isNaN(numericValue) ? numericValue : null;
  }

  /**
   * Gets the ability to explain level for concept evaluations
   * @returns {string|null}
   */
  getAbilityLevel() {
    if (!this.isConceptEvaluation() || !this.evaluationResult) {
      return null;
    }

    const ability = this.evaluationResult.abilityToExplain;
    if (!ability || !ability.parsed) {
      return null;
    }

    const abilityArray = ability.parsed["Ability to explain"];
    if (!Array.isArray(abilityArray) || abilityArray.length === 0) {
      return null;
    }

    return abilityArray[0]["Ability to explain"] || null;
  }

  /**
   * Gets parameters for project evaluations
   * @returns {Array|null}
   */
  getProjectParameters() {
    if (!this.isProjectEvaluation() || !this.evaluationResult) {
      return null;
    }

    return this.evaluationResult.parameters || null;
  }

  /**
   * Converts to database format for concept evaluations
   * @returns {Object}
   */
  toConceptDbFormat() {
    if (!this.isConceptEvaluation()) {
      throw new Error('Cannot convert project evaluation to concept format');
    }

    const accuracy = this.evaluationResult.accuracy;
    const ability = this.evaluationResult.abilityToExplain;

    let accuracyScore = null;
    let accuracyFeedback = '';
    let abilityLevel = '';
    let abilityFeedback = '';

    // Extract accuracy data
    if (accuracy && accuracy.parsed) {
      const accuracyLevel = accuracy.parsed["Accuracy Level"];
      if (Array.isArray(accuracyLevel) && accuracyLevel.length > 0) {
        accuracyScore = this.getAccuracyScore();
        const feedbackObj = accuracyLevel[0]["Feedback"] || {};
        accuracyFeedback = typeof feedbackObj === 'object' 
          ? JSON.stringify(feedbackObj) 
          : feedbackObj || '';
      }
    }

    // Extract ability data
    if (ability && ability.parsed) {
      const abilityArray = ability.parsed["Ability to explain"];
      if (Array.isArray(abilityArray) && abilityArray.length > 0) {
        abilityLevel = abilityArray[0]["Ability to explain"] || '';
        const feedbackObj = abilityArray[0]["Structured Feedback"] || abilityArray[0]["Feedback"] || {};
        abilityFeedback = typeof feedbackObj === 'object'
          ? JSON.stringify(feedbackObj)
          : feedbackObj || '';
      }
    }

    return {
      email: this.userEmail,
      project_name: this.selectedPhase || '',
      page_name: this.selectedVideoTitle || '',
      video_url: this.videoUrl,
      concept_explanation_accuracy: accuracyScore,
      concept_explanation_feedback: accuracyFeedback,
      ability_to_explain_evaluation: abilityLevel,
      ability_to_explain_feedback: abilityFeedback
    };
  }

  /**
   * Converts to database format for project evaluations
   * @returns {Object}
   */
  toProjectDbFormat() {
    if (!this.isProjectEvaluation()) {
      throw new Error('Cannot convert concept evaluation to project format');
    }

    let evaluationText = '';
    let feedbackText = '';
    let evaluationJson = '';

    if (this.evaluationResult && this.evaluationResult.parameters) {
      evaluationJson = JSON.stringify(this.evaluationResult);

      // Create summary text
      const parameterSummaries = this.evaluationResult.parameters.map(param => {
        return `${param.name} (${param.weightage}%): ${param.level}`;
      }).join('; ');
      
      evaluationText = parameterSummaries;

      // Combine all feedback
      const allFeedback = this.evaluationResult.parameters.map(param => {
        const fb = param.feedback || {};
        
        if (fb["What could you do well?"] || fb["What can you do better?"] || fb["Next Suggested Deep Dive?"]) {
          return `${param.name}:\n  ✓ What could you do well?: ${fb["What could you do well?"] || 'N/A'}\n  ✗ What can you do better?: ${fb["What can you do better?"] || 'N/A'}\n  ⚠ Next Suggested Deep Dive?: ${fb["Next Suggested Deep Dive?"] || 'N/A'}`;
        } else {
          return `${param.name}:\n  ✓ Good: ${fb.good || 'N/A'}\n  ✗ Bad: ${fb.bad || 'N/A'}\n  ⚠ Improvements: ${fb.ugly || 'N/A'}`;
        }
      }).join('\n\n');
      
      feedbackText = allFeedback;
    }

    return {
      email: this.userEmail,
      project_name: this.selectedPhase,
      video_url: this.videoUrl,
      project_explanation_evaluation: evaluationText,
      project_explanation_feedback: feedbackText,
      project_explanation_evaluationjson: evaluationJson
    };
  }

  /**
   * Creates an Evaluation from concept database row
   * @param {Object} row - Database row
   * @returns {Evaluation}
   */
  static fromConceptDbRow(row) {
    // Parse feedback if it's JSON string
    let accuracyFeedback = row.concept_explanation_feedback;
    let abilityFeedback = row.ability_to_explain_feedback;

    try {
      accuracyFeedback = JSON.parse(row.concept_explanation_feedback);
    } catch (e) {
      // Keep as string if not valid JSON
    }

    try {
      abilityFeedback = JSON.parse(row.ability_to_explain_feedback);
    } catch (e) {
      // Keep as string if not valid JSON
    }

    return new Evaluation({
      id: row.id,
      userEmail: row.email,
      videoUrl: row.video_url,
      videoType: 'concept',
      selectedPhase: row.project_name,
      selectedVideoTitle: row.page_name,
      evaluationResult: {
        accuracy: {
          score: row.concept_explanation_accuracy,
          feedback: accuracyFeedback
        },
        abilityToExplain: {
          level: row.ability_to_explain_evaluation,
          feedback: abilityFeedback
        }
      },
      createdAt: row.created_at
    });
  }

  /**
   * Creates an Evaluation from project database row
   * @param {Object} row - Database row
   * @returns {Evaluation}
   */
  static fromProjectDbRow(row) {
    let evaluationJson = null;
    try {
      evaluationJson = JSON.parse(row.project_explanation_evaluationjson);
    } catch (e) {
      // Keep as null if not valid JSON
    }

    return new Evaluation({
      id: row.id,
      userEmail: row.email,
      videoUrl: row.video_url,
      videoType: 'project',
      selectedPhase: row.project_name,
      evaluationResult: evaluationJson,
      createdAt: row.created_at
    });
  }
}
