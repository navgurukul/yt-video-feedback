-- =====================================================================
-- 06: Settings used by the authenticated, tenant-scoped API (TEST database only)
-- Re-runnable.
-- =====================================================================

-- Staff accounts hidden from the manual-evaluation queue
-- (previously hardcoded in server/index.js).
UPDATE institutions
   SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{manual_eval_excluded_emails}',
                            '["sachin.i@navgurukul.org", "rishav@navgurukul.org"]'::jsonb, true),
       updated_at = NOW()
 WHERE slug = 'navgurukul'
   AND NOT (COALESCE(settings, '{}'::jsonb) ? 'manual_eval_excluded_emails');

-- Fast domain lookup for auto-join on first login
CREATE INDEX IF NOT EXISTS idx_institutions_domains ON institutions USING GIN (allowed_email_domains);

-- ---------------------------------------------------------------------
-- Staff roles. Evaluators were created automatically from past manual
-- evaluations. Add other staff who need All Evaluations / Manual Evaluation
-- here (or via the admin UI from Prompt 7), then re-run run.js.
-- Roles: 'evaluator' (view all + manual evaluation), 'institution_admin'.
-- ---------------------------------------------------------------------
INSERT INTO user_memberships (email, institution_id, role)
SELECT lower(e.email), i.id, e.role
  FROM (VALUES
          ('rishav@navgurukul.org', 'evaluator')
       ) AS e(email, role)
  JOIN institutions i ON i.slug = 'navgurukul'
ON CONFLICT DO NOTHING;
