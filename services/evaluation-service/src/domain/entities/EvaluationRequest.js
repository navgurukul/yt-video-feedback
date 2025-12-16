/**
 * Domain Entity: Evaluation Request
 * Represents a request to evaluate a video
 */

export class EvaluationRequest {
  constructor({
    videoUrl,
    videoDetails,
    promptBeginning,
    rubric,
    evaluationType,
    structuredReturnedConfig,
    apiKey,
    userEmail,
    userId = null,
    selectedPhase = null,
    selectedVideoTitle = null
  }) {
    this.videoUrl = videoUrl;
    this.videoDetails = videoDetails;
    this.promptBeginning = promptBeginning;
    this.rubric = rubric;
    this.evaluationType = evaluationType; // 'concept' or 'project'
    this.structuredReturnedConfig = structuredReturnedConfig;
    this.apiKey = apiKey;
    this.userEmail = userEmail;
    this.userId = userId;
    this.selectedPhase = selectedPhase;
    this.selectedVideoTitle = selectedVideoTitle;
  }

  /**
   * Validates the evaluation request
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];

    if (!this.videoUrl) {
      errors.push('videoUrl is required');
    }

    if (!this.apiKey) {
      errors.push('apiKey is required');
    }

    if (!this.evaluationType) {
      errors.push('evaluationType is required');
    }

    if (!['concept', 'project'].includes(this.evaluationType)) {
      errors.push('evaluationType must be either "concept" or "project"');
    }

    if (!this.structuredReturnedConfig) {
      errors.push('structuredReturnedConfig is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Builds the full prompt for AI evaluation
   * @returns {string}
   */
  buildPrompt() {
    const rubricContent = (this.rubric && Object.keys(this.rubric).length > 0)
      ? `RUBRIC:\n${JSON.stringify(this.rubric)}`
      : '';

    return `${this.promptBeginning}
          VIDEO DETAILS:
          ${this.videoDetails}

          ${rubricContent}`;
  }

  /**
   * Gets the API configuration for Gemini
   * @returns {Object}
   */
  getApiConfig() {
    // Handle different config formats
    if (this.structuredReturnedConfig.generationConfig) {
      return this.structuredReturnedConfig.generationConfig;
    }
    return this.structuredReturnedConfig;
  }

  /**
   * Builds the content array for Gemini API
   * @returns {Array}
   */
  buildContents() {
    const promptText = this.buildPrompt();

    return [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              fileUri: this.videoUrl,
              mimeType: 'video/*',
            }
          },
          {
            text: promptText
          }
        ],
      },
    ];
  }

  /**
   * Converts to plain object for logging
   * @returns {Object}
   */
  toLogObject() {
    return {
      videoUrl: this.videoUrl,
      evaluationType: this.evaluationType,
      userEmail: this.userEmail,
      selectedPhase: this.selectedPhase,
      selectedVideoTitle: this.selectedVideoTitle,
      hasApiKey: !!this.apiKey,
      hasRubric: !!this.rubric,
      hasConfig: !!this.structuredReturnedConfig
    };
  }
}
