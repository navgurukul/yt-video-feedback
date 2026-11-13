/**
 * AES-256-GCM encryption for secrets stored in the DB (institution Gemini keys).
 * ENCRYPTION_KEY (server env) can be any long random string; it is hashed to 32 bytes.
 * Stored format: v1:<iv b64>:<auth tag b64>:<ciphertext b64>
 */
import crypto from 'crypto';

function key() {
  const k = (process.env.ENCRYPTION_KEY || '').trim();
  if (k.length < 16) {
    throw Object.assign(new Error('ENCRYPTION_KEY is not set on the server (min 16 characters)'), { status: 500 });
  }
  return crypto.createHash('sha256').update(k).digest();
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(stored) {
  if (!stored) return null;
  const [v, iv, tag, data] = stored.split(':');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

/** Safe to show in the UI. */
export const maskSecret = (plain) => (plain ? `••••${String(plain).slice(-4)}` : null);
