/**
 * fetch() wrapper for our backend: adds the Supabase access token and the
 * active institution, so the server knows who is calling and for which tenant.
 * Accepts absolute URLs or paths relative to VITE_API_URL.
 */
import { supabase } from "@/integrations/supabase/client";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const ACTIVE_INSTITUTION_KEY = "active_institution_id";

export function getActiveInstitutionId(): string | null {
  try { return localStorage.getItem(ACTIVE_INSTITUTION_KEY); } catch { return null; }
}

export function setActiveInstitutionId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_INSTITUTION_KEY, id);
    else localStorage.removeItem(ACTIVE_INSTITUTION_KEY);
  } catch { /* storage unavailable */ }
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = /^https?:\/\//.test(input) ? input : `${API_BASE}${input.startsWith("/") ? "" : "/"}${input}`;
  const headers = new Headers(init.headers || {});
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const institutionId = getActiveInstitutionId();
  if (institutionId) headers.set("X-Institution-Id", institutionId);
  return fetch(url, { ...init, headers });
}
