import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RubricComparisonTable } from "@/components/rubric-guidance/RubricComparisonTable";
import { getRubricGuideContext } from "@/data/rubricGuidance";

interface RubricGuidanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoType: string;
  selectedPhase: string;
}

const RubricGuidanceModal = ({ open, onOpenChange, videoType, selectedPhase }: RubricGuidanceModalProps) => {
  const guideContext = getRubricGuideContext(videoType, selectedPhase);

  if (!guideContext) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-7xl flex-col overflow-hidden rounded-xl border-2 border-foreground bg-card p-0 shadow-brutal">
        <div className="border-b-2 border-foreground bg-muted/20 px-5 py-4 sm:px-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {guideContext.title}
            </DialogTitle>
            <DialogDescription className="max-w-4xl text-sm leading-6 text-muted-foreground">
              {guideContext.description}
            </DialogDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              {guideContext.selectedPhaseLabel && (
                <span className="rounded-full border-2 border-foreground bg-background px-3 py-1 text-xs font-semibold text-foreground">
                  Selected phase: {guideContext.selectedPhaseLabel}
                </span>
              )}
              <span className="rounded-full border-2 border-foreground bg-background px-3 py-1 text-xs font-semibold text-foreground">
                {guideContext.kind === "concept" ? "Concept explanation" : "Project rubric"}
              </span>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <RubricComparisonTable kind={guideContext.kind} rubric={guideContext.rubric} />
        </div>

        <div className="border-t-2 border-foreground bg-background px-5 py-4 sm:px-6">
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button className="min-w-[120px] rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brutal hover:bg-primary/90">
                Done
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { RubricGuidanceModal };