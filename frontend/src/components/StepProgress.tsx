import { useState, useEffect, useRef } from "react";
import { Button, Text, StatusBadge, Container, Divider, clx } from "@medusajs/ui";
import { CircleDottedLine, CircleHalfSolid, CheckCircleSolid, ChevronLeft, ChevronRight } from "@medusajs/icons";
import type { ProjectStep } from "../types";
import { useStepTimer } from "../hooks/useStepTimer";

interface StepProgressProps {
  currentStep: ProjectStep;
  isStepProcessing?: boolean; // True when step is actively running (streaming)
  hasError?: boolean; // True when step encountered an error
  hasUserInteraction?: boolean; // True when user has interacted (disables auto-next)
  onRetry?: () => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}

const steps: { step: ProjectStep; label: string }[] = [
  { step: "chat", label: "Chat & Requirements" },
  { step: "planning", label: "Planning" },
  { step: "identityGenerating", label: "Brand Identity" },
  { step: "assetSelection", label: "Select Assets" },
  { step: "assetsImagesGenerating", label: "Asset Images" },
  { step: "sourcing", label: "Sourcing" },
  { step: "negotiating", label: "Negotiating" },
  { step: "cost_analysing", label: "Cost Analysis" },
  { step: "layoutGenerating", label: "Layout Generation" },
  { step: "completed", label: "Completed" },
];

export function StepProgress({ currentStep, isStepProcessing = false, hasError = false, hasUserInteraction = false, onRetry, onNextStep, onPrevStep }: StepProgressProps) {
  const currentStepIndex = steps.findIndex((s) => s.step === currentStep);
  const isActive = currentStepIndex >= 0 && steps[currentStepIndex].step === currentStep;
  const { formattedTime } = useStepTimer(isStepProcessing);
  
  // Countdown timer for completed step
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const getStepStatus = (index: number): "not-started" | "in-progress" | "completed" | "error" => {
    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) {
      if (hasError) return "error";
      return "in-progress";
    }
    return "not-started";
  };

  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoPrev = currentStepIndex > 0;
  
  // Steps that are interactive (user needs to do something) - no auto-next
  const interactiveSteps: ProjectStep[] = ["chat", "assetSelection"];
  const isInteractiveStep = interactiveSteps.includes(currentStep);
  
  // Only show countdown when:
  // - Step is NOT processing (streaming complete)
  // - No error occurred
  // - Not at final step
  // - Not at chat step or interactive step
  // - Has next step handler
  // - User has NOT interacted (if they did, they want manual control)
  const stepComplete = !isStepProcessing && !hasError && currentStep !== "completed";
  const shouldShowCountdown = canGoNext && onNextStep && stepComplete && !isInteractiveStep && !hasUserInteraction;

  // Countdown duration based on step (longer for asset selection review)
  const countdownDuration = 20; // 20 seconds for all auto-steps

  // Start countdown only when step processing completes
  useEffect(() => {
    if (shouldShowCountdown && countdown === null) {
      // Step just completed, start countdown
      setCountdown(countdownDuration);
    } else if (!shouldShowCountdown) {
      // Reset countdown when conditions change
      setCountdown(null);
      setIsHovered(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [shouldShowCountdown, countdownDuration]);

  // Handle countdown timer
  useEffect(() => {
    // Clear any existing interval
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Only run countdown if conditions are met (also check hasUserInteraction)
    if (countdown !== null && countdown > 0 && !isHovered && shouldShowCountdown && onNextStep && !hasUserInteraction) {
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
  }, [countdown, isHovered, shouldShowCountdown, onNextStep, hasUserInteraction]);

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
                  {isStepProcessing ? (
                    <>
                      <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                        {formattedTime}
                      </Text>
                      <StatusBadge color="blue">
                        Processing
                      </StatusBadge>
                    </>
                  ) : hasError ? (
                    <StatusBadge color="red">
                      Error
                    </StatusBadge>
                  ) : currentStep !== "chat" ? (
                    <StatusBadge color="green">
                      Done
                    </StatusBadge>
                  ) : (
                    <StatusBadge color="grey">
                      Ready
                    </StatusBadge>
                  )}
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
