import { useState, useEffect, useRef } from "react";
import { Button, Text, StatusBadge, Container, Divider, clx } from "@medusajs/ui";
import { CircleDottedLine, CircleHalfSolid, CheckCircleSolid, ChevronLeft, ChevronRight } from "@medusajs/icons";
import type { ProjectStep } from "../types";
import { useStepTimer } from "../hooks/useStepTimer";

interface StepProgressProps {
  currentStep: ProjectStep;
  onRetry?: () => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
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
  { step: "layoutGenerating", label: "Generating Layouts" },
  { step: "layoutGenerated", label: "Layouts Complete" },
  { step: "completed", label: "Completed" },
];

export function StepProgress({ currentStep, onRetry, onNextStep, onPrevStep }: StepProgressProps) {
  const currentStepIndex = steps.findIndex((s) => s.step === currentStep);
  const isActive = currentStepIndex >= 0 && steps[currentStepIndex].step === currentStep;
  const { formattedTime } = useStepTimer(isActive);
  
  // Countdown timer for completed step
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const getStepStatus = (index: number): "not-started" | "in-progress" | "completed" => {
    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "in-progress";
    return "not-started";
  };

  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoPrev = currentStepIndex > 0;
  // Show countdown for any step that can go next (not the final "completed" step)
  const shouldShowCountdown = canGoNext && onNextStep && currentStep !== "chat";

  // Start countdown when a step is completed and can go next
  useEffect(() => {
    if (shouldShowCountdown && countdown === null) {
      setCountdown(5);
    } else if (!shouldShowCountdown) {
      setCountdown(null);
      setIsHovered(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [shouldShowCountdown, countdown]);

  // Handle countdown timer
  useEffect(() => {
    // Clear any existing interval
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Only run countdown if conditions are met
    if (countdown !== null && countdown > 0 && !isHovered && shouldShowCountdown && onNextStep) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            // Auto-trigger next step when countdown reaches 0
            if (prev === 1 && onNextStep) {
              // Use setTimeout to ensure state updates are processed
              setTimeout(() => {
                onNextStep();
              }, 100);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [countdown, isHovered, shouldShowCountdown, onNextStep]);

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
                <div className="ml-auto flex items-center gap-2">
                  <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                    Running for {formattedTime}
                  </Text>
                  <StatusBadge color="blue">
                    Active
                  </StatusBadge>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(onNextStep || onPrevStep || onRetry) && (
        <>
          <Divider />
          <div className="px-6 py-4 space-y-2">
            {/* Navigation Buttons */}
            {(onNextStep || onPrevStep) && (
              <div className="flex gap-2">
                {onPrevStep && (
                  <Button 
                    onClick={onPrevStep} 
                    variant="secondary" 
                    disabled={!canGoPrev}
                    className="flex-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                )}
                {onNextStep && (
                  <Button 
                    onClick={onNextStep} 
                    variant="primary"
                    disabled={!canGoNext}
                    className="flex-1 relative"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    {shouldShowCountdown && countdown !== null && countdown > 0 ? (
                      <>
                        Next <span className="font-mono">({countdown}s)</span>
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
            {/* Retry Button */}
            {currentStep !== "chat" && currentStep !== "completed" && onRetry && (
              <Button onClick={onRetry} variant="secondary" className="w-full">
                Retry Step
              </Button>
            )}
          </div>
        </>
      )}
    </Container>
  );
}
