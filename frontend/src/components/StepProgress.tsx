import { Button, Text, StatusBadge, Container, Divider, clx } from "@medusajs/ui";
import { CircleDottedLine, CircleHalfSolid, CheckCircleSolid } from "@medusajs/icons";
import type { ProjectStep } from "../types";

interface StepProgressProps {
  currentStep: ProjectStep;
  onRetry?: () => void;
}

const steps: { step: ProjectStep; label: string }[] = [
  { step: "chat", label: "Chat & Requirements" },
  { step: "planning", label: "Planning" },
  { step: "planed", label: "Plan Complete" },
  { step: "layoutGenerating", label: "Generating Layouts" },
  { step: "layoutGenerated", label: "Layouts Complete" },
  { step: "assetsImagesGenerating", label: "Generating Images" },
  { step: "assetsImagesGenerated", label: "Images Complete" },
  { step: "sourcing", label: "Sourcing" },
  { step: "sourced", label: "Sourced" },
  { step: "negotiating", label: "Negotiating" },
  { step: "negotiated", label: "Negotiated" },
  { step: "cost_analysing", label: "Cost Analysis" },
  { step: "cost_analysed", label: "Analysis Complete" },
  { step: "completed", label: "Completed" },
];

export function StepProgress({ currentStep, onRetry }: StepProgressProps) {
  const currentStepIndex = steps.findIndex((s) => s.step === currentStep);

  const getStepStatus = (index: number): "not-started" | "in-progress" | "completed" => {
    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "in-progress";
    return "not-started";
  };

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Text size="small" weight="plus" leading="compact" className="text-ui-fg-subtle">
          Workflow Progress
        </Text>
      </div>
      <div className="flex flex-col gap-y-0.5 px-3 py-3">
        {steps.map((stepItem, index) => {
          const status = getStepStatus(index);
          const isCompleted = status === "completed";
          const isActive = status === "in-progress";

          const Icon = isCompleted ? CheckCircleSolid : isActive ? CircleHalfSolid : CircleDottedLine;

          return (
            <div key={stepItem.step} className="flex items-center gap-x-3 py-2">
              <div className="flex size-6 items-center justify-center flex-shrink-0">
                <Icon
                  className={clx({
                    "text-ui-tag-green-text": isCompleted,
                    "text-ui-fg-interactive": isActive,
                    "text-ui-fg-muted": !isCompleted && !isActive,
                  })}
                />
              </div>
              <Text
                size="small"
                weight={isActive ? "plus" : "regular"}
                leading="compact"
                className={clx({
                  "text-ui-fg-base": isActive,
                  "text-ui-fg-subtle": isCompleted,
                  "text-ui-fg-muted": !isCompleted && !isActive,
                })}
              >
                {stepItem.label}
              </Text>
              {isActive && (
                <StatusBadge color="blue" size="small" className="ml-auto">
                  Active
                </StatusBadge>
              )}
            </div>
          );
        })}
      </div>

      {currentStep !== "chat" && currentStep !== "completed" && onRetry && (
        <>
          <Divider />
          <div className="px-6 py-4">
            <Button onClick={onRetry} variant="secondary" className="w-full">
              Retry Step
            </Button>
          </div>
        </>
      )}
    </Container>
  );
}
