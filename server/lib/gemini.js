/**
 * Gemini helpers shared by /evaluate and the admin "test prompt" endpoint.
 */
import { GoogleGenAI } from '@google/genai';
import { pgPool } from '../db.js';
import { decryptSecret } from './crypto.js';
import { buildConceptVideoDetails, buildProjectVideoDetails, composePrompt } from './prompt-builder.js';

export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

const ENV_KEY = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || null;

/** Institution key (decrypted) → key sent by the user → server env key. */
export async function resolveGeminiKey(institutionId, userKey) {
  if (institutionId) {
    const r = await pgPool.query(`SELECT gemini_api_key_encrypted FROM institutions WHERE id = $1`, [institutionId]);
    const stored = r.rows[0]?.gemini_api_key_encrypted;
    if (stored) {
      try { return { key: decryptSecret(stored), source: 'institution' }; } catch (e) {
        console.error('[gemini] could not decrypt institution key:', e.message);
      }
    }
  }
  if (userKey) return { key: userKey, source: 'user' };
  if (ENV_KEY()) return { key: ENV_KEY(), source: 'server' };
  return { key: null, source: null };
}

/** Loads a video assignment (scoped to the institution) with its rubrics and prompts. */
export async function loadAssignment(videoAssignmentId, institutionId) {
  const r = await pgPool.query(
    `SELECT va.*, ph.name AS phase_name, ph.program_id
       FROM video_assignments va
       JOIN phases ph ON ph.id = va.phase_id
       JOIN programs p ON p.id = ph.program_id
      WHERE va.id::text = $1 AND p.institution_id = $2`, [String(videoAssignmentId), institutionId]);
  return r.rows[0] || null;
}

export function videoDetailsFor(va) {
  return va.video_type === 'concept'
    ? buildConceptVideoDetails({ title: va.title, whatToCover: va.what_to_cover || '', questionsToAnswer: va.questions_to_answer || [] })
    : buildProjectVideoDetails({ title: va.title, description: va.description || '', whatToCover: va.what_to_cover || '', keyTopics: va.key_topics || [] });
}

/** One non-streaming call, used for dry runs. Returns { text, parsed, model, usage }. */
export async function runPrompt({ apiKey, model, videoUrl, promptText, generationConfig }) {
  const ai = new GoogleGenAI({ apiKey });
  const config = generationConfig?.generationConfig || generationConfig;
  const response = await ai.models.generateContent({
    model: model || GEMINI_MODELS[0],
    config,
    contents: [{ role: 'user', parts: [{ fileData: { fileUri: videoUrl, mimeType: 'video/*' } }, { text: promptText }] }],
  });
  const text = response.text || '';
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* returned as text */ }
  return { text, parsed, model: model || GEMINI_MODELS[0], usage: response.usageMetadata || null };
}

export { composePrompt };
