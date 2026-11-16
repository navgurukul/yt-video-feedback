/**
 * The active institution's syllabus (programs → phases → videos) from /api/config.
 *
 * Falls back to the hardcoded Navgurukul data in src/data/* when
 * VITE_USE_DB_CONFIG=false or when /api/config cannot be loaded, so the
 * analyzer keeps working during the migration.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { videoDataStructure } from "@/data/videoData";
import { projectVideoDataStructure } from "@/data/phasevideodata";

export interface ConfigVideo {
  id: string;
  videoType: "concept" | "project";
  title: string;
  description: string | null;
  whatToCover: string | null;
  questionsToAnswer: string[];
  keyTopics: string[];
  rubricId: string | null;
  abilityRubricId: string | null;
}
export interface ConfigPhase { id: string; name: string; description: string | null; videos: ConfigVideo[] }
export interface ConfigProgram { id: string; name: string; description: string | null; phases: ConfigPhase[] }
export interface InstitutionConfig {
  institution: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  programs: ConfigProgram[];
}

export const USE_DB_CONFIG = import.meta.env.VITE_USE_DB_CONFIG !== "false";

/** The hardcoded Navgurukul syllabus in the same shape (no ids → legacy evaluation path). */
export function legacyConfig(): InstitutionConfig {
  const phases: ConfigPhase[] = videoDataStructure.map((p) => {
    const project = projectVideoDataStructure.find((x) => x.phase === p.phase)?.projectVideo;
    const videos: ConfigVideo[] = p.videos.map((v) => ({
      id: "", videoType: "concept", title: v.title, description: null, whatToCover: v.whatToCover,
      questionsToAnswer: v.questionsToAnswer, keyTopics: [], rubricId: null, abilityRubricId: null,
    }));
    if (project) {
      videos.push({
        id: "", videoType: "project", title: project.title, description: project.description,
        whatToCover: project.whatToCover, questionsToAnswer: [], keyTopics: project.keyTopics,
        rubricId: null, abilityRubricId: null,
      });
    }
    return { id: p.phase, name: p.phase, description: null, videos };
  });
  return { institution: null, programs: [{ id: "legacy", name: "School of Programming", description: null, phases }] };
}

export function useInstitutionConfig() {
  const query = useQuery({
    queryKey: ["institution-config"],
    enabled: USE_DB_CONFIG,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<InstitutionConfig> => {
      const res = await apiFetch("/api/config");
      if (!res.ok) throw new Error(`Could not load your institution's syllabus (HTTP ${res.status})`);
      return res.json();
    },
  });

  const useLegacy = !USE_DB_CONFIG || query.isError;
  if (query.isError) console.warn("useInstitutionConfig: falling back to built-in syllabus:", query.error);

  return {
    config: useLegacy ? legacyConfig() : query.data ?? null,
    /** "db": send videoAssignmentId to the server. "legacy": send the prompt from src/data. */
    source: (useLegacy ? "legacy" : "db") as "db" | "legacy",
    isLoading: USE_DB_CONFIG && query.isLoading,
  };
}

/** Rubric by id (for showing rubric details next to results / manual evaluation). */
export function useRubric(rubricId: string | null | undefined) {
  return useQuery({
    queryKey: ["rubric", rubricId],
    enabled: !!rubricId && USE_DB_CONFIG,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await apiFetch(`/api/rubrics/${rubricId}`);
      if (!res.ok) throw new Error(`Could not load rubric (HTTP ${res.status})`);
      return res.json() as Promise<{ id: string; name: string; levels: string[]; criteria: Record<string, unknown>[]; version: number }>;
    },
  });
}
