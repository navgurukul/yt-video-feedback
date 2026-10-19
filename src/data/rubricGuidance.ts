import { abilityToExplainRubric } from "@/data/RubricData";
import { projectRubricCatalog } from "@/data/projectRubrics";

export type RubricGuideKind = "concept" | "project";

export interface RubricGuideContext {
  kind: RubricGuideKind;
  title: string;
  description: string;
  rubric: any[];
  selectedPhaseLabel?: string;
}

export const getRubricGuideContext = (
  videoType: string,
  selectedPhase: string,
): RubricGuideContext | null => {
  if (videoType === "concept") {
    return {
      kind: "concept",
      title: "Concept Explanation — Rubric Guide",
      description:
        "Study the four rubric levels to understand what is expected before you record or submit your concept explanation video.",
      rubric: abilityToExplainRubric,
      selectedPhaseLabel: selectedPhase || undefined,
    };
  }

  if (!selectedPhase) {
    return null;
  }

  const projectGuide = projectRubricCatalog[selectedPhase as keyof typeof projectRubricCatalog];
  if (!projectGuide) {
    return null;
  }

  return {
    kind: "project",
    title: projectGuide.title,
    description:
      "Study the four rubric levels for each parameter to understand what is expected before you record or submit your project video.",
    rubric: projectGuide.rubric,
    selectedPhaseLabel: selectedPhase,
  };
};