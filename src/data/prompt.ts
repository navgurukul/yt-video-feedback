/**
 * @fileoverview AI evaluation prompts and structured output configurations
 * @module data/prompt
 * 
 * This module defines the prompts and response schemas for Google Gemini AI
 * to evaluate student video submissions. Supports three evaluation types:
 * 1. Concept Explanation Accuracy - Assesses factual correctness
 * 2. Ability to Explain - Evaluates communication clarity
 * 3. Project Evaluation - Comprehensive project assessment
 */

import { Type } from '@google/genai';

/**
 * Accuracy Evaluation Prompt
 * 
 * Instructs the AI to assess concept explanation accuracy by:
 * - Verifying coverage of required concepts
 * - Identifying missing or incorrect information
 * - Detecting irrelevant content
 * - Providing clear, specific feedback
 * 
 * @constant {string}
 */
export const AccuracyPrompt = `You are an evaluator LLM. Your task is to assess a student's concept-explanation video based strictly on the requirements provided in the videoDetails section.
Do not give vague feedback. Provide clear, specific, and accurate evaluation.

Evaluation Instructions
You must analyze the student's explanation strictly against the expected concepts listed in VIDEO_DETAILS.
Your responsibilities:
Check whether each required concept was covered accurately.
Identify any missing concepts.
Identify incorrect or misunderstood explanations.
Identify irrelevant or off-topic content.
Provide a clear verdict on how well the student understood the topic

Input Sections`;

/**
 * Accuracy Evaluation Configuration
 * 
 * Defines the structured JSON output schema for accuracy assessment.
 * Returns accuracy percentage and three-part structured feedback.
 * 
 * @constant {Object}
 * @property {Object} thinkingConfig - AI thinking configuration
 * @property {number} thinkingConfig.thinkingBudget - Thinking budget (-1 for unlimited)
 * @property {string} responseMimeType - Response format (application/json)
 * @property {Object} responseSchema - JSON schema for response structure
 */
export const AccuracyConfig = {
  thinkingConfig: {
    thinkingBudget: -1, // Unlimited thinking budget for thorough evaluation
  },
  responseMimeType: 'application/json',
  responseSchema: {
    type: Type.OBJECT,
    required: ["Accuracy Level"],
    properties: {
      "Accuracy Level": {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ["Accuracy Level", "Feedback"],
          properties: {
            "Accuracy Level": {
              type: Type.STRING,
              description: "Accuracy calculated based on context in percentage out of 100",
            },
            "Feedback": {
              type: Type.OBJECT,
              required: ["What could you do well?", "What can you do better?", "Next Suggested Deep Dive?"],
              properties: {
                "What could you do well?": {
                  type: Type.STRING,
                },
                "What can you do better?": {
                  type: Type.STRING,
                },
                "Next Suggested Deep Dive?": {
                  type: Type.STRING,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Ability to Explain Evaluation Prompt
 * 
 * Instructs the AI to assess communication quality by:
 * - Evaluating explanation clarity and structure
 * - Assessing against rubric criteria
 * - Identifying off-topic content
 * - Rating explanation level (Beginner to Expert/Feynman)
 * 
 * @constant {string}
 */
export const AbilityToExplainPrompt = `
You are an expert evaluator. Your task is to assess a student’s Concept Explanation Video using the expected content defined in videoDetails and the scoring criteria defined in the rubric. Your output must be strict, accurate, and non-vague.
If explanations in the video is not related to the expected content from students defined in videoDetails, then clearly mention it in structured ouptput
Input Sections`;

/**
 * Ability to Explain Evaluation Configuration
 * 
 * Defines the structured JSON output schema for communication assessment.
 * Uses generationConfig wrapper for compatibility with Gemini API.
 * Returns ability level (Beginner/Intermediate/Advanced/Expert) and structured feedback.
 * 
 * @constant {Object}
 * @property {Object} generationConfig - Generation configuration wrapper
 * @property {string} generationConfig.responseMimeType - Response format
 * @property {Object} generationConfig.responseSchema - JSON schema for response
 */
export const AbilityToExplainConfig = {
  generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        required: ["Ability to explain"],
        properties: {
          "Ability to explain": {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["Ability to explain", "Structured Feedback"],
              properties: {
                "Ability to explain": {
                  type: Type.STRING,
                  description: "Level: Beginner, Intermediate, Advanced, or Expert (Feynman Level), based on the explanation points in the rubric",
                },
                "Structured Feedback": {
                  type: Type.OBJECT,
                  required: ["What could you do well?", "What can you do better?", "Next Suggested Deep Dive?"],
                  properties: {
                    "What could you do well?": {
                      type: Type.STRING,
                    },
                    "What can you do better?": {
                      type: Type.STRING,
                    },
                    "Next Suggested Deep Dive?": {
                      type: Type.STRING,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
};

/**
 * Project Evaluation Prompt
 * 
 * Instructs the AI to perform comprehensive project assessment by:
 * - Evaluating against multiple rubric parameters
 * - Assigning weightage to each criterion
 * - Rating skill level for each parameter
 * - Providing structured feedback (strengths, weaknesses, improvements)
 * - Returning ONLY JSON output (no conversational text)
 * 
 * @constant {string}
 */
export const ProjectPrompt = `TASK: Evaluate the student's project explanation video provided in this request based *strictly* on the grading rubric's structure
**INSTRUCTIONS:**
1. Analyze the video as per the given rubric parameters.
2. For each parameter in the required JSON schema, assign a **weightage** (a number as per given in rubric reflecting the relative importance of this parameter) and a **level** (a categorical rating like "Beginner", "Intermediate", "Advanced", or "Expert").
3. For each parameter in the required JSON schema, in the feedback object, provide specific, detailed commentary for the video:
   * What could you do well?: Describe 1-2 major **strengths** and accomplishments from the video.
   * What can you do better?: Identify 1-2 key areas where the student **missed major requirements** or made significant errors.
   * Next Suggested Deep Dive?: Suggest 1-2 actionable, high-impact improvements for **future projects** or presentations.
4. Crucially, **do not include any conversational text, preamble, or explanation** outside of the structured JSON output.

Input Sections`;

/**
 * Project Evaluation Configuration
 * 
 * Defines the structured JSON output schema for project assessment.
 * Returns array of parameters with weightage, level, and three-part feedback.
 * 
 * @constant {Object}
 * @property {Object} thinkingConfig - AI thinking configuration
 * @property {string} responseMimeType - Response format (application/json)
 * @property {Object} responseSchema - JSON schema defining parameters array
 */
export const projectconfig = {
  thinkingConfig: {
    thinkingBudget: -1, // Unlimited thinking budget for comprehensive evaluation
  },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ["parameters"],
          properties: {
            parameters: {
              type: Type.ARRAY,
              description: "An array of evaluation parameters based on the rubric.",
              items: {
                type: Type.OBJECT,
                required: ["name", "weightage", "level", "feedback"],
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "The name of the evaluation parameter from the rubric.",
                  },
                  weightage: {
                    type: Type.NUMBER,
                    description: "The weightage percentage for this parameter as a number.",
                  },
                  level: {
                    type: Type.STRING,
                    description: "The assessed level: 'Beginner', 'Intermediate', 'Advanced', or 'Expert'.",
                  },
                  feedback: {
                    type: Type.OBJECT,
                    required: ["What could you do well?", "What can you do better?", "Next Suggested Deep Dive?"],
                    properties: {
                      "What could you do well?": {
                        type: Type.STRING,
                        description: "1-2 major strengths and accomplishments from the video.",
                      },
                      "What can you do better?": {
                        type: Type.STRING,
                        description: "1-2 key areas where the student missed major requirements or made significant errors.",
                      },
                      "Next Suggested Deep Dive?": {
                        type: Type.STRING,
                        description: "1-2 actionable, high-impact improvements for future projects.",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

// Note: If you do not have an external 'Type' enum, you might need to define it or
// replace it with the literal strings if the SDK allows it.
// Example: type: 'OBJECT', type: 'ARRAY', type: 'STRING'