import { ArrowRight, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RubricGuidanceButtonProps {
  onClick: () => void;
  label: string;
}

const RubricGuidanceButton = ({ onClick, label }: RubricGuidanceButtonProps) => {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="flex h-auto w-full items-center justify-between rounded-md border-2 border-foreground bg-primary px-4 py-3 text-left text-primary-foreground shadow-brutal transition-all duration-200 hover:bg-primary/90 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-foreground bg-background/20">
          <BookOpenText className="h-5 w-5" />
        </span>
        <span className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-semibold tracking-wide">{label}</span>
          <span className="text-xs font-normal normal-case tracking-normal text-primary-foreground/90">Read the levels first. They will help you make a better video..</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Button>
  );
};

export { RubricGuidanceButton };