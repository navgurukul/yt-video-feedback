/**
 * @fileoverview AI evaluation prompts and structured output configurations
 * @module data/prompt
 * 
 * This module defines the prompts and response schemas for Google Gemini AI
 * to evaluate student video submissions. Supports three evaluation types:
 * 1. Concept Explanation Accuracy - Assesses factual correctness
 * 2. Ability to Explain - Evaluates communication clarity
 * 3. Project Evaluation - Comprehensive project assessment
 * 
 * CONSISTENCY IMPROVEMENTS:
 * - Deterministic scoring with explicit checklists
 * - Clear level thresholds based on observable evidence
 * - Video content validation to catch off-topic submissions
 * - Structured evaluation workflow to reduce variance
 */

const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
} as const;

/**
 * Accuracy Evaluation Prompt
 * 
 * Instructs the AI to assess concept explanation accuracy using a
 * deterministic scoring formula based on observable evidence.
 * 
 * @constant {string}
 */
export const AccuracyPrompt = `You are a STRICT and DETERMINISTIC evaluator LLM. Your task is to assess a student's concept-explanation video based ONLY on the requirements provided in the videoDetails section.

**CRITICAL: CONSISTENCY RULES (FOLLOW EXACTLY)**
1. You MUST evaluate ONLY what is spoken/shown in the video - never assume or infer content
2. Use this EXACT scoring formula:
   - Count total required concepts from VIDEO_DETAILS (call this TOTAL)
   - Count concepts CORRECTLY explained with proper understanding (call this CORRECT)
   - Count concepts with PARTIAL explanation (call this PARTIAL - worth 0.5 each)
   - Accuracy = ((CORRECT + (PARTIAL * 0.5)) / TOTAL) * 100
3. A concept is CORRECT only if: student explains WHAT it is, WHY it's used, and gives an example or shows it
4. A concept is PARTIAL if: student mentions it but explanation is incomplete or missing context
5. A concept is MISSING if: not mentioned at all or completely wrong

**SCORING THRESHOLDS (USE EXACTLY):**
- 90-100%: Expert level - all concepts covered accurately with examples
- 70-89%: Advanced level - most concepts covered, minor gaps
- 50-69%: Intermediate level - core concepts covered but significant gaps
- 0-49%: Beginner level - major concepts missing or incorrect

**VIDEO CONTENT VALIDATION (CRITICAL):**
- FIRST, verify the video content matches the expected topic in VIDEO_DETAILS
- If the video is about a DIFFERENT topic than expected, accuracy should be 0-20%
- If the video is off-topic, irrelevant, or shows unrelated content, clearly state: "Video content does not match expected topic. Expected: [topic from VIDEO_DETAILS]. Shown: [what video actually contains]"
- Do NOT give passing scores (>50%) to videos that don't demonstrate the required concepts

**EVALUATION WORKFLOW:**
1. First, LIST all required concepts from VIDEO_DETAILS (be explicit)
2. Watch/analyze the video content
3. For EACH required concept, mark: ✓ Correct (1.0), ◐ Partial (0.5), ✗ Missing/Wrong (0)
4. Calculate accuracy using the formula: ((CORRECT + PARTIAL*0.5) / TOTAL) * 100
5. Round to nearest whole number
6. If video is off-topic, explain what was expected vs what was shown

IMPORTANT: Write all feedback in simple, easy-to-understand English (A1 level). Avoid difficult words. Be friendly and helpful, treat the user as a second person - use words like "you" and "I".

Do not give vague feedback. Provide clear, specific, detailed and accurate evaluation.

Input Sections`;

/**
 * Accuracy Evaluation Configuration
 * 
 * Defines the structured JSON output schema for accuracy assessment.
 * Includes concept breakdown for transparency in scoring.
 * 
 * @constant {Object}
 */
export const AccuracyConfig = {
  thinkingConfig: {
    thinkingBudget: -1,
  },
  temperature: 0,
  topK: 1,
  seed: 42,
  responseMimeType: 'application/json',
  responseSchema: {
    type: Type.OBJECT,
    required: ["Accuracy Level"],
    properties: {
      "Accuracy Level": {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ["Accuracy Level", "Concepts Breakdown", "Feedback"],
          properties: {
            "Accuracy Level": {
              type: Type.STRING,
              description: "Accuracy percentage (0-100%) calculated using formula: ((CORRECT + PARTIAL*0.5) / TOTAL) * 100. Must be a number followed by %",
            },
            "Concepts Breakdown": {
              type: Type.STRING,
              description: "Brief summary showing: 'X/Y concepts correct, Z partial. Topics covered: [list]. Missing: [list].' This ensures transparent scoring.",
            },
            "Feedback": {
              type: Type.OBJECT,
              required: ["What you did well.", "What could you do better.", "Suggestion for technical accuracy improvement."],
              properties: {
                "What you did well.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points highlighting major strengths from the video, where the student explained topics with proper clarity and examples. Quote specific things they said correctly."
                },
                "What could you do better.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points mentioning: (1) Missing concepts from VIDEO_DETAILS that were not explained, (2) Partial or incorrect explanations with what was wrong and correct information, (3) If video was off-topic, state what was expected vs shown."
                },
                "Suggestion for technical accuracy improvement.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 actionable suggestions to improve ONE level up (e.g., beginner→intermediate). Include specific topics to study and how to explain them better."
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
 * Instructs the AI to assess communication quality using a
 * deterministic checklist-based approach for consistent scoring.
 * 
 * @constant {string}
 */
export const AbilityToExplainPrompt = `You are a STRICT and DETERMINISTIC evaluator. Your task is to assess a student's Concept Explanation Video using the expected content defined in videoDetails and the scoring criteria defined in the rubric.

**CRITICAL: DETERMINISTIC SCORING (FOLLOW THIS CHECKLIST EXACTLY)**

Your evaluation MUST be based on OBSERVABLE evidence only. Use this scoring system:

**STEP 1: VIDEO VALIDATION (DO THIS FIRST)**
□ Does the video content match the expected topic in videoDetails?
□ Is the student explaining the correct concept?
→ If NO to either: Assign BEGINNER level and explain mismatch in feedback

**STEP 2: COUNT OBSERVABLE EVIDENCE**
For each criteria below, mark YES (1 point) or NO (0 points):

Structure & Clarity:
□ Has clear introduction stating the topic (YES/NO)
□ Explanation follows logical order (YES/NO)
□ Has conclusion or summary (YES/NO)

Examples & Analogies:
□ Provides at least ONE concrete example (YES/NO)
□ Uses at least ONE analogy or comparison (YES/NO)
□ Examples are relevant and helpful (YES/NO)

Depth of Understanding:
□ Explains WHAT the concept is (YES/NO)
□ Explains WHY it's used/important (YES/NO)
□ Explains HOW it works (YES/NO)
□ Mentions real-world applications (YES/NO)

Accuracy:
□ No major factual errors (YES/NO)
□ Technical terms used correctly (YES/NO)

**STEP 3: DETERMINE LEVEL (USE EXACTLY)**
- 0-4 points: BEGINNER - Basic or incorrect understanding
- 5-7 points: INTERMEDIATE - Decent explanation with gaps
- 8-10 points: ADVANCED - Clear, accurate, well-structured
- 11-12 points: EXPERT (Feynman Level) - Exceptional clarity, multiple examples, teaches at any level

**ADDITIONAL RULES:**
- If video is off-topic or doesn't match videoDetails → BEGINNER (max)
- If major factual errors present → Cannot be above INTERMEDIATE
- If no examples given → Cannot be above INTERMEDIATE
- EXPERT requires: multiple examples, clear analogies, zero errors, logical flow

IMPORTANT: Write all feedback in simple, easy-to-understand English (A1 level). Avoid difficult words. Be friendly and helpful, treat the user as a second person - use words like "you" and "I".

Your output must be strict, accurate, and non-vague.
If explanations in the video are not related to the expected content in videoDetails, clearly state this in the feedback.

Input Sections`;

/**
 * Ability to Explain Evaluation Configuration
 * 
 * Defines the structured JSON output schema for communication assessment.
 * Includes evidence summary for transparent scoring.
 * 
 * @constant {Object}
 */
export const AbilityToExplainConfig = {
  thinkingConfig: {
    thinkingBudget: -1,
  },
  temperature: 0,
  topK: 1,
  seed: 42,
  responseMimeType: 'application/json',
  responseSchema: {
    type: Type.OBJECT,
    required: ["Ability to explain"],
    properties: {
      "Ability to explain": {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ["Ability to explain", "Evidence Score", "Structured Feedback"],
          properties: {
            "Ability to explain": {
              type: Type.STRING,
              description: "MUST be exactly one of: 'Beginner', 'Intermediate', 'Advanced', or 'Expert (Feynman Level)'. Determined by checklist score: 0-4=Beginner, 5-7=Intermediate, 8-10=Advanced, 11-12=Expert.",
            },
            "Evidence Score": {
              type: Type.STRING,
              description: "Summary of checklist evaluation, e.g., 'Score: 7/12. Structure: 2/3, Examples: 2/3, Depth: 2/4, Accuracy: 1/2'. This ensures consistent scoring.",
            },
            "Structured Feedback": {
              type: Type.OBJECT,
              required: ["What you did well.", "What could you do better.", "Suggestion for improving explanation."],
              properties: {
                "What you did well.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points highlighting communication strengths. Quote specific examples or analogies the student used that were effective."
                },
                "What could you do better.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 specific points including: checklist items that scored NO, areas where clarity/structure could improve, missing examples or analogies, if off-topic explain what was expected."
                },
                "Suggestion for improving explanation.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of 3-5 actionable suggestions to move ONE level up. Be specific about what techniques to use (e.g., 'Try using an analogy like comparing X to Y')."
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
 * Instructs the AI to perform comprehensive project assessment with
 * deterministic scoring against rubric parameters.
 * 
 * @constant {string}
 */
export const ProjectPrompt = `TASK: You are a STRICT and DETERMINISTIC evaluator assessing a student's project explanation video. Your goal is to provide consistent, fair, and helpful feedback.

**EVALUATION FRAMEWORK:**
1. The **VIDEO DETAILS** section (expected content, key topics to cover)
2. The **RUBRIC** (grading criteria and levels)

**CRITICAL: DETERMINISTIC EVALUATION PROCESS**

**STEP 1: VIDEO VALIDATION (DO THIS FIRST)**
□ Does the video show/explain the expected project from VIDEO DETAILS?
□ Is this the correct project type (Phase1 HTML / Phase2 CSS)?
→ If video doesn't match: Assign BEGINNER for all parameters and explain mismatch

**STEP 2: TOPIC COVERAGE CHECK**
Create a checklist from "Key Topics to explain" in VIDEO DETAILS:
□ For each topic: Covered ✓ / Partial ◐ / Missing ✗
→ Calculate coverage percentage: (Covered + Partial*0.5) / Total * 100%

**STEP 3: LEVEL DETERMINATION (PER RUBRIC PARAMETER)**
For each parameter in the rubric:

BEGINNER - Assign if ANY are true:
□ Topic not addressed or completely wrong
□ Major misconceptions present
□ Less than 40% of related concepts explained
□ Video doesn't match expected content

INTERMEDIATE - Assign if:
□ Basic understanding demonstrated
□ 40-69% of related concepts explained
□ Some gaps or minor errors present
□ Limited examples given

ADVANCED - Assign if:
□ Clear, accurate explanation
□ 70-89% of related concepts explained
□ Good examples and demonstrations
□ Minor gaps only

EXPERT - Assign ONLY if ALL are true:
□ 90-100% of concepts explained accurately
□ Multiple relevant examples
□ Deep understanding with nuances
□ Could teach others effectively

**STEP 4: IDENTIFY AND CORRECT WRONG EXPLANATIONS**
If the student said something INCORRECT, you MUST:
1. Quote what they said: "You said '[exact quote]'..."
2. Explain why it's wrong in simple words
3. Give the CORRECT explanation
4. Provide a simple example

Example format: "You said '<table> is for layout'. This is not correct. <table> is for showing data in rows and columns, like a grade sheet. For layout, we use CSS with Flexbox or Grid."

**FEEDBACK REQUIREMENTS:**
- **What you did well**: 3-5 SPECIFIC points with examples from the video
- **What could you do better**: 3-5 SPECIFIC points including:
  * WRONG explanations with corrections
  * Missing topics from KEY TOPICS list (name each one)
  * Rubric criteria not demonstrated
- **Suggestions**: 3-5 actionable items to reach NEXT level

**RULES:**
- Use EXACT weightages from the rubric
- Be consistent: same video = same evaluation
- If off-topic: all parameters = BEGINNER
- Quote specific things the student said/showed
- Don't give vague feedback like "good job" without specifics

IMPORTANT: Write all feedback in simple English (A1/A2 level). Be friendly like a mentor. Use "you" and "your".

Input Sections`;

/**
 * Project Evaluation Configuration
 * 
 * Defines the structured JSON output schema for project assessment.
 * Includes coverage tracking for transparency.
 * 
 * @constant {Object}
 */
export const projectconfig = {
  thinkingConfig: {
    thinkingBudget: -1,
  },
  temperature: 0,
  topK: 1,
  seed: 42,
  responseMimeType: 'application/json',
  responseSchema: {
    type: Type.OBJECT,
    required: ["video_validation", "topic_coverage", "parameters"],
    properties: {
      video_validation: {
        type: Type.OBJECT,
        required: ["matches_expected", "expected_content", "actual_content"],
        properties: {
          matches_expected: {
            type: Type.STRING,
            description: "YES if video matches VIDEO DETAILS, NO if off-topic or wrong project",
          },
          expected_content: {
            type: Type.STRING,
            description: "What the video SHOULD show based on VIDEO DETAILS",
          },
          actual_content: {
            type: Type.STRING,
            description: "Brief description of what the video ACTUALLY shows",
          },
        },
      },
      topic_coverage: {
        type: Type.STRING,
        description: "Summary: 'X/Y topics covered. Covered: [list]. Missing: [list].' Include percentage.",
      },
      parameters: {
        type: Type.ARRAY,
        description: "Evaluation for each rubric parameter",
        items: {
          type: Type.OBJECT,
          required: ["name", "weightage", "level", "level_justification", "feedback"],
          properties: {
            name: {
              type: Type.STRING,
              description: "Parameter name from rubric",
            },
            weightage: {
              type: Type.NUMBER,
              description: "Exact weightage percentage from rubric",
            },
            level: {
              type: Type.STRING,
              description: "MUST be exactly: 'Beginner', 'Intermediate', 'Advanced', or 'Expert'",
            },
            level_justification: {
              type: Type.STRING,
              description: "Brief explanation of why this level was assigned based on the checklist criteria",
            },
            feedback: {
              type: Type.OBJECT,
              required: ["What you did well.", "What could you do better.", "Suggestion for project improvement."],
              properties: {
                "What you did well.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3-5 specific points with EXACT examples from video. Quote what student said/showed correctly.",
                },
                "What could you do better.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3-5 specific points: (1) WRONG explanations with corrections - quote and correct, (2) Missing topics from KEY TOPICS, (3) Rubric criteria not met, (4) Specific improvements needed.",
                },
                "Suggestion for project improvement.": {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3-5 actionable suggestions to reach NEXT level. Reference rubric descriptions. Give specific examples of what to explain or demonstrate.",
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
 * Custom Evaluation Prompt
 * 
 * Instructs the AI to assess videos based on user-provided custom criteria.
 * The user's custom prompt is injected into this template.
 * 
 * @constant {string}
 */
export const CustomPrompt = `You are a FLEXIBLE and INTELLIGENT evaluator LLM. Your task is to assess a student's video based on the CUSTOM EVALUATION CRITERIA provided by the user.

**CRITICAL: FLEXIBILITY RULES (FOLLOW EXACTLY)**
1. You MUST evaluate ONLY what is spoken/shown in the video - never assume or infer content
2. Focus specifically on the custom criteria provided in the VIDEO DETAILS section
3. **OUTPUT FORMAT**: If the user specifies a particular output format, structure, or fields in their custom evaluation criteria, follow it EXACTLY
4. If no specific output format is mentioned, create a logical JSON structure based on what they want evaluated
5. If additional context is provided, use it to better understand the evaluation requirements and output expectations

**EVALUATION WORKFLOW:**
1. First, read the "Custom Evaluation Criteria" from VIDEO DETAILS to understand:
   - WHAT to evaluate (the criteria/aspects)
   - HOW to structure the output (if specified)
   - WHAT format the user expects (if mentioned)
2. If "Additional Context" is provided, use it to better understand the requirements, background, and expected output
3. Watch/analyze the video content carefully
4. Assess the video against each criterion mentioned in the custom evaluation criteria
5. Structure your response according to the user's specified format OR create an appropriate structure if none specified
6. If the video doesn't address the custom criteria, clearly explain what was missing

**OUTPUT FORMAT FLEXIBILITY:**
You must return a JSON object with "evaluation_result" as the main key. Inside "evaluation_result", structure the content exactly as the user requests:

- If user asks for specific fields (e.g., "score", "rating", "level", "grade"), include those exact fields
- If user asks for specific categories (e.g., "technical skills", "presentation", "content"), organize by those categories  
- If user asks for specific format (e.g., "list of points", "detailed analysis", "rubric-style"), follow that format
- If user asks for numerical scores, ratings, or percentages, provide them as requested
- If user asks for specific feedback structure, follow it exactly
- If no specific format is mentioned, create a clear, logical structure based on their evaluation criteria

**EXAMPLES OF FLEXIBLE OUTPUT:**
- User wants "score out of 10 for each criteria" → Return evaluation_result with technical_skills: 8, presentation: 7, content: 9
- User wants "detailed analysis with recommendations" → Return evaluation_result with analysis and recommendations fields
- User wants "simple pass/fail with reasons" → Return evaluation_result with result: "PASS" and reasons array
- User wants "rubric-style evaluation" → Return evaluation_result with criteria array containing name, score, feedback objects
- User wants "bullet points of observations" → Return evaluation_result with observations array

**VIDEO CONTENT VALIDATION:**
- Verify the video content is relevant to the custom evaluation criteria
- If the video is completely unrelated to what the user asked to evaluate, clearly state this
- Focus your evaluation on the specific aspects the user mentioned in their custom criteria
- Use any additional context provided to better understand the evaluation scope

IMPORTANT: 
- Write all feedback in simple, easy-to-understand English (A1 level). Avoid difficult words. 
- Be friendly and helpful, treat the user as a second person - use words like "you" and "I".
- Do not give vague feedback. Provide clear, specific, detailed and accurate evaluation.
- MOST IMPORTANT: Follow the user's requested output format exactly if they specify one.

Input Sections`;

/**
 * Custom Evaluation Configuration
 * 
 * Flexible JSON output schema for custom assessment.
 * Provides a minimal structure that can be adapted to user requirements.
 * 
 * @constant {Object}
 */
export const CustomConfig = {
  thinkingConfig: {
    thinkingBudget: -1,
  },
  temperature: 0,
  topK: 1,
  seed: 42,
  responseMimeType: 'application/json',
  responseSchema: {
    type: Type.OBJECT,
    description: "Flexible JSON object that should match the output format specified by the user in their custom evaluation prompt. If no specific format is requested, use this default structure.",
    properties: {
      "evaluation_result": {
        type: Type.OBJECT,
        description: "Main evaluation result object. Structure this according to the user's specified format in their custom prompt. If no specific format is mentioned, include relevant evaluation fields based on their criteria.",
        properties: {
          "response": {
            type: Type.STRING,
            description: "Flexible response field that can contain any evaluation content as requested by the user. This can be structured data, analysis, scores, feedback, or any format the user specified in their prompt."
          }
        }
      }
    }
  },
} as const;
