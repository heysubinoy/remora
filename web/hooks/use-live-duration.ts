"use client";

import { useState, useEffect } from "react";
import type { Job } from "@/types";

/**
 * Hook to provide live duration updates for running jobs
 * Returns the current duration in milliseconds for a job
 */
export function useLiveDuration(job: Job): number {
  const [liveDuration, setLiveDuration] = useState(job.duration);

  useEffect(() => {
    // If job is not running or doesn't have a start time, use static duration
    if (job.status !== "running" || !job.startedAt) {
      setLiveDuration(job.duration);
      return;
    }

    // For running jobs, update duration every second
    const interval = setInterval(() => {
      const now = new Date();
      const startTime = job.startedAt!;
      const currentDuration = now.getTime() - startTime.getTime();
      setLiveDuration(currentDuration);
    }, 1000);

    // Set initial live duration
    const now = new Date();
    const startTime = job.startedAt;
    const currentDuration = now.getTime() - startTime.getTime();
    setLiveDuration(currentDuration);

    return () => clearInterval(interval);
  }, [job.status, job.startedAt, job.duration]);

  return liveDuration;
}

/**
 * Utility function to format duration in milliseconds to human-readable format
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 0) return "0s";

  const seconds = Math.floor(durationMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}
