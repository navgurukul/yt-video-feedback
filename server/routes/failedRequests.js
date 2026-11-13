/**
 * Failed-request recovery (from master: "save failed requests and retry later"),
 * adapted to the multi-tenant API:
 *  - the owner is the signed-in user (token), never an email parameter
 *  - rows carry institution_id and are only visible to their owner in that institution
 *  - a retry replays the saved request through this server's own /evaluate and
 *    /store-evaluation with the caller's login, so the same checks and
 *    server-side prompts apply
 */
import { pgPool } from '../db.js';
import { GEMINI_MODELS, resolveGeminiKey } from '../lib/gemini.js';

export async function ensureFailedRequestsTable() {
  try {
    await pgPool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS public.tbl_failed_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        video_url TEXT NOT NULL,
        video_type TEXT NOT NULL,
        selected_phase TEXT,
        selected_video_title TEXT,
        video_details TEXT,
        promptbegining TEXT,
        rubric JSONB,
        structuredreturnedconfig JSONB,
        custom_prompt TEXT,
        custom_context TEXT,
        request_payload JSONB,
        error_type TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`);
    await pgPool.query(`ALTER TABLE public.tbl_failed_requests ADD COLUMN IF NOT EXISTS institution_id UUID`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_failed_requests_user_email ON public.tbl_failed_requests (user_email, created_at DESC);`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_failed_requests_user_id ON public.tbl_failed_requests (user_id);`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_failed_requests_institution ON public.tbl_failed_requests (institution_id, user_email);`);
    console.log('failed_requests table ready');
  } catch (error) {
    // e.g. DB_TARGET=prod-readonly: the table is then used read-only
    console.error('Could not ensure failed_requests table:', error.message);
  }
}

function normalizeFailedRequestData(body = {}) {
  const payload = body.request_payload && typeof body.request_payload === 'object' ? body.request_payload : {};
  return {
    videoUrl: body.videoUrl || body.video_url || payload.videoUrl || payload.video_url || '',
    videoType: body.videoType || body.video_type || payload.videoType || payload.video_type || 'project',
    selectedPhase: body.selectedPhase ?? body.selected_phase ?? payload.selectedPhase ?? payload.selected_phase ?? null,
    selectedVideoTitle: body.selectedVideoTitle ?? body.selected_video_title ?? payload.selectedVideoTitle ?? payload.selected_video_title ?? null,
    videoDetails: body.videoDetails ?? body.video_details ?? payload.videoDetails ?? payload.video_details ?? null,
    promptbegining: body.promptbegining ?? payload.promptbegining ?? null,
    rubric: body.rubric ?? payload.rubric ?? null,
    structuredreturnedconfig: body.structuredreturnedconfig ?? payload.structuredreturnedconfig ?? null,
    customPrompt: body.customPrompt ?? body.custom_prompt ?? payload.customPrompt ?? payload.custom_prompt ?? null,
    customContext: body.customContext ?? body.custom_context ?? payload.customContext ?? payload.custom_context ?? null,
    errorType: body.errorType || body.error_type || 'UNKNOWN_ERROR',
    errorMessage: body.errorMessage || body.error_message || 'Evaluation failed',
    requestPayload: body.request_payload || payload,
  };
}

const sanitizeRequestPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const sanitized = { ...payload };
  delete sanitized.apiKey;
  delete sanitized.api_key;
  delete sanitized.geminiApiKey;
  delete sanitized.gemini_api_key;
  return Object.keys(sanitized).length ? sanitized : null;
};

const toJson = (v) => (v === undefined || v === null || v === '' ? null : JSON.stringify(v));
const toText = (v) => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Own row in the active institution, or null. */
async function findOwn(req, id) {
  if (!UUID_RE.test(String(id))) return null;
  const r = await pgPool.query(
    `SELECT * FROM public.tbl_failed_requests
      WHERE id = $1 AND lower(user_email) = $2 AND (institution_id = $3 OR institution_id IS NULL)`,
    [id, req.user.email, req.tenant.institutionId]);
  return r.rows[0] || null;
}

export function registerFailedRequestRoutes(app, { port }) {
  app.post('/failed-requests', async (req, res) => {
    try {
      const n = normalizeFailedRequestData(req.body);
      if (!n.videoUrl) return res.status(400).json({ error: 'Missing required field: videoUrl' });

      const result = await pgPool.query(
        `INSERT INTO public.tbl_failed_requests (
           user_id, user_email, video_url, video_type, selected_phase, selected_video_title, video_details,
           promptbegining, rubric, structuredreturnedconfig, custom_prompt, custom_context, request_payload,
           error_type, error_message, institution_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13::jsonb,$14,$15,$16,NOW())
         RETURNING *`,
        [String(req.user.id || req.body.userId || ''), req.user.email, n.videoUrl, n.videoType,
         n.selectedPhase ?? null, n.selectedVideoTitle ?? null, toText(n.videoDetails), toText(n.promptbegining),
         toJson(n.rubric), toJson(n.structuredreturnedconfig), toText(n.customPrompt), toText(n.customContext),
         toJson(sanitizeRequestPayload(n.requestPayload)), toText(n.errorType) || 'UNKNOWN_ERROR',
         toText(n.errorMessage) || 'Evaluation failed', req.tenant.institutionId]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error creating failed request:', error);
      res.status(500).json({ error: error.message || 'Failed to save failed request', code: error.code || 'FAILED_REQUEST_INSERT_FAILED' });
    }
  });

  app.get('/failed-requests', async (req, res) => {
    try {
      const result = await pgPool.query(
        `SELECT * FROM public.tbl_failed_requests
          WHERE lower(user_email) = $1 AND (institution_id = $2 OR institution_id IS NULL)
          ORDER BY created_at DESC`, [req.user.email, req.tenant.institutionId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching failed requests:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/failed-requests/:id', async (req, res) => {
    try {
      const row = await findOwn(req, req.params.id);
      if (!row) return res.status(404).json({ error: 'Failed request not found' });
      res.json({ success: true, data: row });
    } catch (error) {
      console.error('Error fetching failed request:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete('/failed-requests/:id', async (req, res) => {
    try {
      const row = await findOwn(req, req.params.id);
      if (!row) return res.status(404).json({ error: 'Failed request not found or not owned by user' });
      await pgPool.query(`DELETE FROM public.tbl_failed_requests WHERE id = $1`, [row.id]);
      res.json({ success: true, message: 'Failed request deleted successfully' });
    } catch (error) {
      console.error('Error deleting failed request:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/failed-requests/:id/retry', async (req, res) => {
    const id = req.params.id;
    const markFailed = (type, message) => pgPool.query(
      `UPDATE public.tbl_failed_requests SET error_type = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
      [type, message, id]);
    try {
      const failedRequest = await findOwn(req, id);
      if (!failedRequest) return res.status(404).json({ error: 'Failed request not found' });

      const requestPayload = failedRequest.request_payload && typeof failedRequest.request_payload === 'object'
        ? { ...failedRequest.request_payload }
        : {
            videoUrl: failedRequest.video_url, videoType: failedRequest.video_type,
            selectedPhase: failedRequest.selected_phase, selectedVideoTitle: failedRequest.selected_video_title,
            videoDetails: failedRequest.video_details, promptbegining: failedRequest.promptbegining,
            rubric: failedRequest.rubric || {}, structuredreturnedconfig: failedRequest.structuredreturnedconfig || {},
            customPrompt: failedRequest.custom_prompt, customContext: failedRequest.custom_context,
          };
      // A client-built (legacy) payload needs its prompt; a server-config payload needs evaluationKind.
      if (!requestPayload.evaluationKind && !requestPayload.promptbegining) {
        return res.status(400).json({ success: false, status: 'failed', error: { type: 'not_retryable', message: 'This request cannot be retried. Please run the evaluation again.' } });
      }

      const { key: apiKey } = await resolveGeminiKey(req.tenant.institutionId, req.body?.apiKey);
      if (!apiKey) {
        return res.status(500).json({ success: false, status: 'failed', error: { type: 'missing_api_key', message: 'GEMINI_API_KEY not configured' } });
      }

      const videoType = String(requestPayload.videoType || failedRequest.video_type || 'project').toLowerCase();
      if (videoType === 'concept') {
        return res.status(400).json({
          success: false, status: 'failed',
          error: { type: 'concept_retry_unsupported', message: 'Concept retry is not supported yet. Please re-run the concept evaluation manually.' },
        });
      }

      const evaluationType = requestPayload.evaluationType || (videoType === 'other' ? 'custom' : 'project');
      // Call ourselves with the caller's login, so authentication and tenant scoping apply.
      const self = `http://127.0.0.1:${port}`;
      const headers = { 'Content-Type': 'application/json', Authorization: req.headers.authorization };
      if (req.headers['x-institution-id']) headers['X-Institution-Id'] = req.headers['x-institution-id'];

      const maxPasses = 3;
      const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
      let lastError = { type: 'GEMINI_ERROR', message: 'Retry failed' };
      let lastStatus = 503;

      for (let pass = 0; pass < maxPasses; pass += 1) {
        for (const model of GEMINI_MODELS) {
          const lastAttempt = pass === maxPasses - 1 && model === GEMINI_MODELS[GEMINI_MODELS.length - 1];
          try {
            const response = await fetch(`${self}/evaluate`, {
              method: 'POST', headers,
              body: JSON.stringify({ ...requestPayload, apiKey, model, evaluationType }),
            });
            const rawText = await response.text();
            let data;
            try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { error: { type: 'INVALID_RESPONSE', message: rawText || 'Gemini returned an invalid response' } }; }

            if (response.ok && !data.error) {
              if (!data.parsed) {
                return res.status(502).json({ success: false, status: 'failed', error: { type: 'EMPTY_RESULT', message: 'Gemini returned empty result' } });
              }
              const storeBody = {
                userId: failedRequest.user_id || req.user.id,
                userEmail: req.user.email,
                videoUrl: failedRequest.video_url || requestPayload.videoUrl,
                videoType,
                evaluationData: {
                  evaluation_result: data.parsed,
                  actual_model_used: model,
                  api_calls: [{ call_number: 1, evaluation_type: evaluationType, metrics: data.metrics || { model_version: model, http_status: 200 } }],
                  issues: [],
                },
                selectedPhase: failedRequest.selected_phase ?? requestPayload.selectedPhase ?? null,
                selectedVideoTitle: failedRequest.selected_video_title ?? requestPayload.selectedVideoTitle ?? null,
                customPrompt: failedRequest.custom_prompt ?? requestPayload.customPrompt ?? null,
                customContext: failedRequest.custom_context ?? requestPayload.customContext ?? null,
                videoDetails: failedRequest.video_details ?? requestPayload.videoDetails ?? null,
                videoAssignmentId: requestPayload.videoAssignmentId ?? null,
              };
              const storeResponse = await fetch(`${self}/store-evaluation`, { method: 'POST', headers, body: JSON.stringify(storeBody) });
              const storeData = await storeResponse.json().catch(() => ({ success: true }));
              if (!storeResponse.ok) {
                return res.status(storeResponse.status || 500).json({
                  success: false, status: 'failed', error: storeData?.error || { type: 'STORE_FAILED', message: 'Failed to save retry result' },
                });
              }
              await pgPool.query(`DELETE FROM public.tbl_failed_requests WHERE id = $1`, [id]);
              return res.json({ success: true, status: 'success', model, data: storeData });
            }

            const errorPayload = data?.error && typeof data.error === 'object' ? data.error : { type: 'GEMINI_ERROR', message: String(data?.error || rawText || 'Retry failed') };
            lastStatus = response.status || 500;
            lastError = errorPayload;
            const isRetryable = retryableStatuses.has(lastStatus)
              || /model_unavailable|temporarily unavailable|quota|overloaded|service unavailable|rate limit|busy/i.test(String(errorPayload.message || ''));
            if (!isRetryable || lastAttempt) {
              await markFailed(errorPayload.type || 'GEMINI_ERROR', errorPayload.message || 'Retry failed');
              return res.status(lastStatus || 500).json({ success: false, status: 'failed', error: errorPayload });
            }
          } catch (error) {
            const message = error?.message || String(error);
            lastStatus = 503;
            lastError = { type: 'network_error', message };
            const isRetryable = /fetch failed|timeout|temporarily unavailable|network|429|unavailable|busy/i.test(message);
            if (!isRetryable || lastAttempt) {
              await markFailed(lastError.type, lastError.message);
              return res.status(503).json({ success: false, status: 'failed', error: lastError });
            }
          }
        }
        if (pass < maxPasses - 1) await new Promise((r) => setTimeout(r, pass === 0 ? 2000 : 4000));
      }

      await markFailed(lastError.type || 'GEMINI_ERROR', lastError.message || 'Gemini is busy, please try again later');
      return res.status(lastStatus || 503).json({
        success: false, status: 'failed',
        error: { type: lastError.type || 'model_unavailable', message: lastError.message || 'Gemini abhi busy hai, thodi der baad dobara try karo.' },
      });
    } catch (error) {
      console.error('Error retrying failed request:', error);
      res.status(500).json({ success: false, status: 'failed', error: { type: 'retry_server_error', message: error.message || 'Retry failed' } });
    }
  });
}
