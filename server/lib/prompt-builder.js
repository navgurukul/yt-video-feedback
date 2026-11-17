// Pure functions that reproduce, character for character, how the app builds
// the Gemini prompt today (VideoAnalyzer.tsx getVideoDetails + server/index.js /evaluate).
// The server will reuse these when it starts building prompts from the DB.

export function buildConceptVideoDetails({ title, whatToCover, questionsToAnswer }) {
  let details = `Video Title: ${title}\n\n`;
  details += `What to cover:\n${whatToCover}\n\n`;
  details += `Ensure these are answered:\n`;
  questionsToAnswer.forEach((q, i) => { details += `${i + 1}. ${q}\n`; });
  return details;
}

export function buildProjectVideoDetails({ title, description, whatToCover, keyTopics }) {
  let details = `Project Video Title: ${title}\n\n`;
  details += `Description: ${description}\n\n`;
  details += `What to cover:\n${whatToCover}\n\n`;
  details += `Key Topics to explain:\n`;
  keyTopics.forEach((t, i) => { details += `${i + 1}. ${t}\n`; });
  return details;
}

// Mirrors server/index.js exactly, including its indentation.
export function composePrompt({ promptbegining, videoDetails, rubric, customPrompt }) {
  const rubricContent = (rubric && Object.keys(rubric).length > 0)
    ? `RUBRIC:\n${JSON.stringify(rubric)}`
    : '';
  const customPromptContent = customPrompt
    ? `CUSTOM_PROMPT:
${customPrompt}

`
    : '';
  return promptbegining + `
          ${customPromptContent}VIDEO DETAILS:
          ${videoDetails}

          ${rubricContent}`;
}

// Mirrors VideoAnalyzer.tsx getVideoDetails() for videoType "other" (custom evaluation).
export function buildCustomVideoDetails({ customPrompt, customContext }) {
  let details = `Custom Evaluation Criteria:\n${customPrompt}`;
  if (customContext && customContext.trim()) {
    details += `\n\nAdditional Context:\n${customContext}`;
  }
  return details;
}
