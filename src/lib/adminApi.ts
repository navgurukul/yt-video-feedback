/**
 * Small JSON client for /api/admin/* and /api/super/* with readable errors.
 */
import { apiFetch } from "@/lib/api";

export class ApiError extends Error {
  details: string[];
  status: number;
  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const details: string[] = Array.isArray(json?.details) ? json.details : [];
    throw new ApiError(json?.error?.message || json?.error || `Request failed (HTTP ${res.status})`, res.status, details);
  }
  return json as T;
}

export const errorText = (e: unknown) =>
  e instanceof ApiError ? [e.message, ...e.details].join("\n• ") : e instanceof Error ? e.message : String(e);

// ---- types returned by the admin API ----------------------------------------------
export interface AdminVideo {
  id: string; videoType: "concept" | "project"; title: string; description: string | null;
  whatToCover: string | null; questionsToAnswer: string[]; keyTopics: string[];
  rubricId: string | null; abilityRubricId: string | null;
  accuracyPromptId: string | null; abilityPromptId: string | null; projectPromptId: string | null;
  sortOrder: number; isActive: boolean;
}
export interface AdminPhase { id: string; name: string; description: string | null; sortOrder: number; isActive: boolean; videos: AdminVideo[] }
export interface AdminProgram { id: string; name: string; description: string | null; sortOrder: number; isActive: boolean; phases: AdminPhase[] }
export interface AdminConfig { institution: { id: string; name: string; slug: string } | null; programs: AdminProgram[] }

export interface Rubric {
  id: string; name: string; rubricType: "project" | "ability_to_explain" | "generic";
  levels: string[]; criteria: Record<string, unknown>[]; version: number; isActive: boolean;
  createdBy: string | null; createdAt: string; versions?: number; warnings?: string[];
}
export interface PromptTemplate {
  id: string; kind: "accuracy" | "ability_to_explain" | "project" | "custom"; name: string;
  promptText: string; generationConfig: Record<string, unknown>; version: number; isActive: boolean;
  isGlobalDefault: boolean; createdBy: string | null; createdAt: string; versions?: number;
}
export interface Member { id: string; email: string; role: string; program_id: string | null; program_name: string | null; evaluations: number }
export interface Settings {
  id: string; name: string; slug: string; type: string; logoUrl: string | null; status: string;
  allowedEmailDomains: string[]; manualEvalExcludedEmails: string[];
  gemini: { hasKey: boolean; masked: string | null };
}
export interface InstitutionRow {
  id: string; name: string; slug: string; type: string; status: string; allowed_email_domains: string[];
  has_gemini_key: boolean; students: number; admins: number; programs: number; evaluations: number; tokens_30d: number; created_at: string;
}

export const PROMPT_KIND_LABEL: Record<PromptTemplate["kind"], string> = {
  accuracy: "Concept accuracy",
  ability_to_explain: "Ability to explain",
  project: "Project explanation",
  custom: "Custom evaluation",
};

/** Lines in a textarea ⇄ string[] */
export const linesToList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const listToLines = (a?: string[] | null) => (a || []).join("\n");
