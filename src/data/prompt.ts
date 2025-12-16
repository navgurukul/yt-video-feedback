/**
 * @fileoverview AI evaluation prompts and structured output configurations
 * @module data/prompt
 * 
 * This modexport const AbilityToExplainPrompt = `
You are an expert evaluator. Your task is to assess a student's Concept Explanation Video using the expected content defined in videoDetails and the scoring criteria defined in the rubric.

IMPORTANT: Write all feedback in simple, easy-to-understand English (A1/A2 level). Use short sentences. Avoid difficult words. Be friendly and helpful.

Your output must be strict, accurate, and non-vague.
If explanations in the video is not related to the expected content from students defined in videoDetails, then clearly mention it in structured output.

Input Sections`;defines the prompts and response schemas for Google Gemini AI
 * to evaluate student video submissions. Supports three evaluation types:
 * 1. Concept Explanation Accuracy - Assesses factual correctness
 * 2. Ability to Explain - Evaluates communication clarity
 * 3. Project Evaluation - Comprehensive project assessment
 */

// import { Type } from '@google/genai';

const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
} as const;

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

IMPORTANT: Write all feedback in simple english, easy-to-understand English (Strict A1 level). Avoid difficult words. Be friendly and helpful, treat the user as a second person use words like you and i.

Do not give vague feedback. Provide clear, specific, detailed and accurate evaluation.

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
              required: ["What you did well.", "What could you do better.", "Suggestion for technical accuracy improvement."],
              properties: {
                "What you did well.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points highlighting major strengths and accomplishments from the video, where user explained topics very well with proper clarity & examples"
                },
                "What could you do better.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points mentioning partial or incorrect explanations with examples of what user explained and how they can explain those topics better"
                },
                "Suggestion for technical accuracy improvement.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 actionable suggestions for what user can improve only one step above (eg. beginner to intermediate) from technical POV and how to explain topics better"
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

IMPORTANT: Write all feedback in simple, easy-to-understand English (Strict A1 level). Avoid difficult words. Be friendly and helpful, treat the user as a second person use words like you and i.

If explanations in the video is not related to the expected content from students defined in videoDetails, then clearly mention it in structured ouptput
Input Sections`;

/**
 * Ability to Explain Evaluation Configuration
 * 
 * Defines the structured JSON output schema for communication assessment.
 * Returns ability level (Beginner/Intermediate/Advanced/Expert) and structured feedback.
 * 
 * @constant {Object}
 * @property {Object} thinkingConfig - AI thinking configuration
 * @property {string} responseMimeType - Response format (application/json)
 * @property {Object} responseSchema - JSON schema for response structure
 */
export const AbilityToExplainConfig = {
  thinkingConfig: {
    thinkingBudget: -1, // Unlimited thinking budget for thorough evaluation
  },
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
              required: ["What you did well.", "What could you do better.", "Suggestion for improving explanation."],
              properties: {
                "What you did well.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points highlighting communication strengths where user explained clearly with good examples and analogies"
                },
                "What could you do better.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points mentioning areas where explanation clarity, structure or delivery could be improved"
                },
                "Suggestion for improving explanation.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 actionable suggestions only one step above (eg. beginner to intermediate) for improving communication skills and deeper learning"
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
 * Project Evaluation Prompt
 * 
 * Instructs the AI to perform comprehensive project assessment by:
 * - Evaluating against multiple rubric parameters
 * - Checking coverage of required topics from VIDEO DETAILS
 * - Assigning weightage to each criterion
 * - Rating skill level for each parameter
 * - Providing structured feedback (strengths, weaknesses, improvements)
 * - Returning ONLY JSON output (no conversational text)
 * 
 * @constant {string}
 * 
 */
export const ProjectPrompt = `TASK: You are a supportive mentor evaluating a student's project explanation video. Your goal is to help them learn and improve.

Evaluate based on:
1. The **VIDEO DETAILS** section (expected content, key topics to cover)
2. The **RUBRIC** (grading criteria and levels)

IMPORTANT: Write all feedback in simple, easy-to-understand English (A1/A2 level). Use short sentences. Avoid difficult words. Be friendly and helpful like a mentor. Treat the user as a second person - use words like "you" and "your".

**CRITICAL EVALUATION REQUIREMENTS:**

1. **Check Coverage of Required Topics:**
   - The VIDEO DETAILS section lists "Key Topics to explain" that the student MUST cover
   - For EACH key topic, check if the student explained it in their video
   - If a key topic is NOT covered or poorly explained, you MUST mention it specifically in "What could you do better"
   - Be specific: name the exact topic that was missing (e.g., "You did not explain how navigation links connect your pages" or "You missed explaining the Forms and input elements")

2. **Identify and Correct Wrong Explanations (VERY IMPORTANT):**
   - If the student explained something INCORRECTLY, you MUST:
     * Quote what they said wrong (e.g., "You said '<div> is used for styling'...")
     * Explain why it's wrong in simple words
     * Give the CORRECT explanation like a mentor would
     * Provide a simple example to help them understand
   - Example format: "You said '<table> is for layout'. This is not correct. <table> is for showing data in rows and columns, like a grade sheet. For layout, we use CSS with Flexbox or Grid. Think of <table> like an Excel sheet - it's for data, not design."

3. **Evaluate Against Rubric Parameters:**
   - For each parameter in the rubric, assign a **weightage** (use the exact percentage from rubric) and a **level** (Beginner, Intermediate, Advanced, or Expert)
   - Match the student's explanation to the rubric level descriptions
   - Use specific examples from what the student said or showed in the video

4. **Provide Mentor-Style Detailed Feedback:**
   - **What you did well**: 3-5 specific points about what the student explained correctly, with examples from their video. Celebrate their wins!
   - **What could you do better**: 3-5 specific points including:
     * WRONG explanations with corrections and examples (use format: "You said X. This is not right because... The correct way is... For example...")
     * Topics from KEY TOPICS list that were missing or poorly explained
     * Concepts from the rubric that weren't demonstrated
     * Specific improvements with mentor-like guidance
   - **Suggestion for project improvement**: 3-5 actionable suggestions for the next level up. Be specific like a mentor teaching a student. Give examples of what to say or show.

5. **Be a Helpful Mentor:**
   - When correcting mistakes, be kind but clear
   - Always explain WHY something is wrong, not just that it's wrong
   - Give real examples they can use in their next video
   - Use analogies to make complex concepts simple (e.g., "Think of <nav> like a menu at a restaurant - it helps visitors find what they want")
   - Encourage them while pointing out areas to improve

6. **Reference Expected Content:**
   - Always compare what the student said against what they SHOULD have covered (from VIDEO DETAILS)
   - If the video is off-topic or doesn't match the expected project, clearly state this
   - Be specific about which requirements from the phase were met or missed

7. **Do NOT:**
   - Give vague feedback like "good job" or "needs improvement" without specifics
   - Include any conversational text outside the JSON structure
   - Ignore missing topics - every missing key topic must be mentioned
   - Skip over wrong explanations - ALWAYS correct them with examples
   - Be harsh or discouraging - be supportive like a good mentor

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
              required: ["What you did well.", "What could you do better.", "Suggestion for project improvement."],
              properties: {
                "What you did well.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points highlighting major strengths. Include EXACT examples from what the student said or showed in the video. Reference specific topics from VIDEO DETAILS that were explained well.",
                },
                "What could you do better.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points including: (1) WRONG explanations with corrections and examples - use format: 'You said X. This is not right because... The correct way is... For example...' (2) KEY TOPICS from VIDEO DETAILS that were NOT covered or poorly explained - name each missing topic explicitly, (3) Rubric criteria that weren't demonstrated, (4) Specific improvements with mentor-like guidance.",
                },
                "Suggestion for project improvement.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 actionable, specific suggestions to reach the next level. Reference the rubric level descriptions and VIDEO DETAILS requirements. Include concrete examples of what to explain or demonstrate.",
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

// Note: If you do not have an external 'Type' enum, you might need to define it or
// replace it with the literal strings if the SDK allows it.
// Example: type: 'OBJECT', type: 'ARRAY', type: 'STRING'