/**
 * @fileoverview Google Gemini AI configuration and API client setup
 * @module server/config/gemini
 */

import { GoogleGenAI } from '@google/genai';

/**
 * Gemini API key loaded from environment variables
 * Supports both GEMINI_API_KEY and VITE_GEMINI_API_KEY for flexibility
 * @type {string}
 */
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

/**
 * Gemini AI model identifier
 * @constant {string}
 */
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Log API key status on startup (masked for security)
 * Helps with debugging environment configuration issues
 */
if (GEMINI_KEY) {
  try {
    const masked = `${GEMINI_KEY.slice(0, 4)}...${GEMINI_KEY.slice(-4)}`;
    console.log('✓ GEMINI_KEY loaded from environment (masked):', masked);
  } catch (e) {
    console.log('✓ GEMINI_KEY loaded (length):', GEMINI_KEY.length || 'unknown');
  }
} else {
  console.warn('⚠ GEMINI_KEY not provided in environment');
}

/**
 * Creates and returns a Google GenAI client instance
 * @returns {GoogleGenAI} Initialized Google GenAI client
 * @throws {Error} If GEMINI_KEY is not configured
 */
const createGeminiClient = () => {
  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY not configured in environment');
  }
  return new GoogleGenAI({ apiKey: GEMINI_KEY });
};

export { createGeminiClient, GEMINI_KEY, GEMINI_MODEL };
