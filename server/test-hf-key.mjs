import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const key = process.env.HUGGINGFACE_API_KEY;
console.log('Key loaded:', !!key);
console.log('Key length:', key ? key.length : 0);
console.log('Masked:', key ? `${key.slice(0,4)}...${key.slice(-4)}` : 'N/A');

if (!key) { console.error('No key!'); process.exit(1); }

const models = [
  'google/gemma-2-2b-it',
  'google/gemma-3-4b-it',
  'meta-llama/Llama-3.2-1B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'Qwen/Qwen2.5-1.5B-Instruct',
];

for (const model of models) {
  console.log(`\n--- Testing: ${model} ---`);
  try {
    const resp = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say hello.' }],
        max_tokens: 10,
      }),
    });
    const body = await resp.text();
    console.log(`  Status: ${resp.status} ${resp.statusText}`);
    console.log(`  Response: ${body.slice(0, 250)}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}
