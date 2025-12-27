import { Button, Text, StatusBadge } from "@medusajs/ui";
import { Check } from "@medusajs/icons";
import type { ProjectStep } from "../types";

interface StepProgressProps {
  currentStep: ProjectStep;
  onRetry?: () => void;
}

const steps: { step: ProjectStep; label: string }[] = [
  { step: "chat", label: "Chat & Requirements" },
  { step: "planning", label: "Planning" },
  { step: "planed", label: "Plan Complete" },
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

  return (
    <div className="flex flex-col gap-y-1">
      {steps.map((stepItem, index) => {
        const isCompleted = index < currentStepIndex;
        const isActive = index === currentStepIndex;

        return (
          <div key={stepItem.step} className="flex items-center gap-x-3 py-2">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full border-2 flex-shrink-0 ${
                isCompleted
                  ? "bg-ui-tag-green-bg border-ui-tag-green-border"
                  : isActive
                  ? "bg-ui-bg-interactive border-ui-border-interactive"
                  : "bg-ui-bg-subtle border-ui-border-base"
              }`}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 text-ui-tag-green-text" />
              ) : (
                <Text size="small" weight="plus" className={isActive ? "text-ui-fg-on-color" : "text-ui-fg-muted"}>
                  {index + 1}
                </Text>
              )}
            </div>
            <Text
              size="small"
              weight={isActive ? "plus" : "regular"}
              className={
                isActive
                  ? "text-ui-fg-base"
                  : isCompleted
                  ? "text-ui-fg-subtle"
                  : "text-ui-fg-muted"
              }
            >
              {stepItem.label}
            </Text>
            {isActive && <StatusBadge color="blue" size="small">Active</StatusBadge>}
          </div>
        );
      })}

      {currentStep !== "chat" && currentStep !== "completed" && onRetry && (
        <Button onClick={onRetry} variant="secondary" className="w-full mt-3">
          Retry Step
        </Button>
      )}
    </div>
  );
}
