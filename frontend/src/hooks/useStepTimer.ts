import { useEffect, useState, useRef } from "react";

/**
 * Custom hook for tracking elapsed time during step execution
 * Provides real-time timer updates and duration tracking
 */
export function useStepTimer(isActive: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      // Start the timer
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);
        }
      }, 100); // Update every 100ms for smooth display
    } else {
      // Stop the timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Keep the final elapsed time
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  /**
   * Formats seconds into a readable time string (MM:SS or HH:MM:SS)
   */
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    reset: () => {
      setElapsedSeconds(0);
      startTimeRef.current = Date.now();
    },
  };
}

