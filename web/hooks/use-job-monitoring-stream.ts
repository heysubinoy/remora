import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import type { Job } from "@/types";

interface JobStatusUpdate {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  command: string;
  args: string;
  server_id: string;
  priority: number;
  started_at?: string;
  finished_at?: string;
  duration?: string;
  exit_code?: number;
  output?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  original_script?: string;
  server?: any;
  created_at: string;
  updated_at: string;
}

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export const useJobMonitoringStream = (
  initialJobs: Job[],
  onJobUpdate?: (job: Job) => void,
  onJobComplete?: (job: Job) => void
) => {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [streamingJobs, setStreamingJobs] = useState<Set<string>>(new Set());

  // Convert Go backend job to frontend Job type
  const convertJob = useCallback((goJob: JobStatusUpdate): Job => {
    const duration = goJob.duration ? parseInt(goJob.duration) / 1000000 : 0; // Convert nanoseconds to milliseconds

    // Ensure all dates are properly parsed as UTC
    const parseUTCDate = (dateString: string | undefined) => {
      if (!dateString) return undefined;
      // Force UTC parsing by ensuring the string ends with Z or adding it
      const utcString = dateString.endsWith("Z")
        ? dateString
        : dateString + "Z";
      return new Date(utcString);
    };

    return {
      id: goJob.id,
      server_id: goJob.server_id,
      serverName: goJob.server?.name || "Unknown",
      command: goJob.command + (goJob.args ? ` ${goJob.args}` : ""),
      originalCommand: goJob.command,
      args: goJob.args,
      status: goJob.status,
      priority: goJob.priority || 5, // Default to 5 if not provided
      created_at: goJob.created_at,
      updated_at: goJob.updated_at,
      started_at: goJob.started_at,
      finished_at: goJob.finished_at,
      duration,
      exit_code: goJob.exit_code || null,
      exitCode: goJob.exit_code || null,
      output: goJob.output,
      error: goJob.error,
      stdout: goJob.stdout,
      stderr: goJob.stderr,
      original_script: goJob.original_script,
      server: goJob.server,
      created: parseUTCDate(goJob.created_at),
      startedAt: parseUTCDate(goJob.started_at),
      finishedAt: parseUTCDate(goJob.finished_at),
    };
  }, []);

  // Start streaming for a specific job
  const startJobStream = useCallback((jobId: string) => {
    setStreamingJobs((prev) => new Set([...prev, jobId]));
  }, []);

  // Stop streaming for a specific job
  const stopJobStream = useCallback((jobId: string) => {
    setStreamingJobs((prev) => {
      const newSet = new Set(prev);
      newSet.delete(jobId);
      return newSet;
    });
  }, []);

  // Update jobs with new data
  const updateJobs = useCallback((newJobs: Job[]) => {
    setJobs(newJobs);
  }, []);

  // Update jobs when initialJobs change
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  // Check for completed jobs and show notifications
  useEffect(() => {
    jobs.forEach((job) => {
      const initialJob = initialJobs.find((j) => j.id === job.id);
      if (initialJob && initialJob.status !== job.status) {
        if (job.status === "completed") {
          toast({
            title: "Job Completed",
            description: `Job ${job.id} finished successfully`,
            variant: "default",
          });
          onJobComplete?.(job);
        } else if (job.status === "failed") {
          toast({
            title: "Job Failed",
            description: `Job ${job.id} failed with exit code ${
              job.exit_code || "unknown"
            }`,
            variant: "destructive",
          });
          onJobComplete?.(job);
        } else if (job.status === "canceled") {
          toast({
            title: "Job Canceled",
            description: `Job ${job.id} was canceled`,
            variant: "default",
          });
          onJobComplete?.(job);
        }
        onJobUpdate?.(job);
      }
    });
  }, [jobs, initialJobs, onJobUpdate, onJobComplete]);

  return {
    jobs,
    streamingJobs,
    startJobStream,
    stopJobStream,
    updateJobs,
  };
};
