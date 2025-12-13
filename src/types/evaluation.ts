/**
 * @fileoverview Centralized type definitions for evaluation data structures
 * @module types/evaluation
 */

/**
 * Structured feedback format for evaluations
 * Contains three specific fields for comprehensive feedback
 */
export interface StructuredFeedback {
  "What could you do well?"?: string;
  "What can you do better?"?: string;
  "Next Suggested Deep Dive?"?: string;
}

/**
 * Legacy feedback format
 * Used for backward compatibility with older evaluations
 */
export interface LegacyFeedback {
  good?: string;
  bad?: string;
  ugly?: string;
}

/**
 * Accuracy evaluation item structure
 * Represents a single accuracy assessment with level and feedback
 */
export interface AccuracyEvaluationItem {
  "Accuracy Level": string;
  Feedback: StructuredFeedback;
}

/**
 * Ability to explain evaluation item structure
 * Represents a single ability assessment with level and feedback
 */
export interface AbilityEvaluationItem {
  "Ability to explain": string;
  "Structured Feedback"?: StructuredFeedback;
  Feedback?: StructuredFeedback;
}

/**
 * Project evaluation parameter structure
 * Represents a single criterion in project evaluation
 */
export interface ProjectParameter {
  name: string;
  weightage: number;
  level: string;
  feedback: StructuredFeedback | LegacyFeedback;
}

/**
 * Complete concept evaluation result structure
 * Contains both accuracy and ability to explain assessments
 */
export interface ConceptEvaluationResult {
  accuracy: {
    parsed?: {
      "Accuracy Level": AccuracyEvaluationItem[];
    };
    criteria?: Array<{
      score: number;
      feedback: string;
    }>;
    overallScore?: number;
    overallFeedback?: string;
  };
  abilityToExplain: {
    parsed?: {
      "Ability to explain": AbilityEvaluationItem[];
    };
    criteria?: Array<{
      name: string;
      feedback: string;
    }>;
    level?: string;
    overallFeedback?: string;
  };
}

/**
 * Complete project evaluation result structure
 * Contains array of evaluated parameters
 */
export interface ProjectEvaluationResult {
  parameters: ProjectParameter[];
}

/**
 * Evaluation data wrapper sent to backend
 */
export interface EvaluationData {
  evaluation_result: ConceptEvaluationResult | ProjectEvaluationResult;
}

/**
 * Video analysis history item for UI display
 * Represents a stored evaluation record
 */
export interface VideoAnalysis {
  id: number;
  videoUrl: string;
  videoType: 'concept' | 'project';
  projectType: string;
  createdAt: string;
  evaluation?: any;
  project_name?: string;
  page_name?: string;
}

/**
 * Normalized evaluation structure for consistent UI rendering
 * Flattens different evaluation formats into a uniform structure
 */
export interface NormalizedEvaluation {
  accuracyScore?: number | string;
  accuracyFeedback?: string | StructuredFeedback;
  abilityLevel?: string;
  abilityFeedback?: string | StructuredFeedback;
  criteria?: Array<{
    name: string;
    score?: number;
    level?: string;
    feedback: string | StructuredFeedback;
    weight?: number;
  }>;
  overallScore?: number;
  overallFeedback?: string;
}
