import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import type { Job } from "@/types";

interface JobStatusUpdate {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  command: string;
  args: string;
  server_id: string;
  started_at?: string;
  finished_at?: string;
  duration?: string;
  exit_code?: number;
  output?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  server?: any;
  created_at: string;
  updated_at: string;
}

interface OutputEvent {
  job_id: string;
  output: string;
  is_stderr: boolean;
  line_count: number;
  timestamp: string;
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
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const jobOutputRef = useRef<Map<string, { stdout: string[]; stderr: string[] }>>(new Map());

  // Convert Go backend job to frontend Job type
  const convertJob = useCallback((goJob: JobStatusUpdate): Job => {
    const duration = goJob.duration ? parseInt(goJob.duration) / 1000000 : 0; // Convert nanoseconds to milliseconds
    
    return {
      id: goJob.id,
      server_id: goJob.server_id,
      serverName: goJob.server?.name || "Unknown",
      command: goJob.command + (goJob.args ? ` ${goJob.args}` : ""),
      originalCommand: goJob.command,
      args: goJob.args,
      status: goJob.status,
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
      server: goJob.server,
      created: goJob.created_at ? new Date(goJob.created_at) : undefined,
      startedAt: goJob.started_at ? new Date(goJob.started_at) : undefined,
      finishedAt: goJob.finished_at ? new Date(goJob.finished_at) : undefined,
    };
  }, []);

  // Start streaming for a specific job
  const startJobStream = useCallback((jobId: string) => {
    if (eventSourcesRef.current.has(jobId)) {
      return; // Already streaming
    }

    const url = `${BACKEND_BASE_URL}/api/v1/jobs/${jobId}/stream`;
    const eventSource = new EventSource(url);
    eventSourcesRef.current.set(jobId, eventSource);
    setStreamingJobs(prev => new Set([...prev, jobId]));

    // Initialize output storage for this job
    if (!jobOutputRef.current.has(jobId)) {
      jobOutputRef.current.set(jobId, { stdout: [], stderr: [] });
    }

    eventSource.addEventListener("status", (e) => {
      try {
        const statusUpdate: JobStatusUpdate = JSON.parse((e as MessageEvent).data);
        const updatedJob = convertJob(statusUpdate);

        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === jobId ? { ...job, ...updatedJob } : job
          )
        );

        onJobUpdate?.(updatedJob);
      } catch (error) {
        console.error("Failed to parse status update:", error);
      }
    });

    eventSource.addEventListener("output", (e) => {
      try {
        const outputEvent: OutputEvent = JSON.parse((e as MessageEvent).data);
        
        // Store the output
        const jobOutput = jobOutputRef.current.get(jobId);
        if (jobOutput) {
          if (outputEvent.is_stderr) {
            jobOutput.stderr.push(outputEvent.output);
          } else {
            jobOutput.stdout.push(outputEvent.output);
          }

          // Update the job with accumulated output
          setJobs(prevJobs => 
            prevJobs.map(job => {
              if (job.id === jobId) {
                return {
                  ...job,
                  stdout: jobOutput.stdout.join(""),
                  stderr: jobOutput.stderr.join(""),
                  output: [...jobOutput.stdout, ...jobOutput.stderr].join(""),
                };
              }
              return job;
            })
          );
        }
      } catch (error) {
        console.error("Failed to parse output event:", error);
      }
    });

    eventSource.addEventListener("complete", (e) => {
      try {
        const finalStatus: JobStatusUpdate = JSON.parse((e as MessageEvent).data);
        const completedJob = convertJob(finalStatus);

        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === jobId ? { ...job, ...completedJob } : job
          )
        );

        onJobComplete?.(completedJob);
        
        // Show completion notification
        if (completedJob.status === "completed") {
          toast({
            title: "Job Completed",
            description: `Job ${completedJob.id} finished successfully`,
            variant: "default",
          });
        } else if (completedJob.status === "failed") {
          toast({
            title: "Job Failed",
            description: `Job ${completedJob.id} failed with exit code ${completedJob.exit_code || "unknown"}`,
            variant: "destructive",
          });
        } else if (completedJob.status === "canceled") {
          toast({
            title: "Job Canceled",
            description: `Job ${completedJob.id} was canceled`,
            variant: "default",
          });
        }
        
        // Clean up this job's stream
        stopJobStream(jobId);
      } catch (error) {
        console.error("Failed to parse completion event:", error);
      }
    });

    eventSource.addEventListener("error", (e) => {
      console.error(`SSE error for job ${jobId}:`, e);
      stopJobStream(jobId);
    });

    eventSource.onerror = (e) => {
      console.error(`EventSource error for job ${jobId}:`, e);
      stopJobStream(jobId);
    };

  }, [convertJob, onJobUpdate, onJobComplete]);

  // Stop streaming for a specific job
  const stopJobStream = useCallback((jobId: string) => {
    const eventSource = eventSourcesRef.current.get(jobId);
    if (eventSource) {
      eventSource.close();
      eventSourcesRef.current.delete(jobId);
      setStreamingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  }, []);

  // Start streams for running jobs when component mounts or jobs change
  useEffect(() => {
    const runningJobs = jobs.filter(job => 
      job.status === "running" || job.status === "queued"
    );

    runningJobs.forEach(job => {
      if (!streamingJobs.has(job.id)) {
        startJobStream(job.id);
      }
    });

    // Stop streams for jobs that are no longer running
    streamingJobs.forEach(jobId => {
      const job = jobs.find(j => j.id === jobId);
      if (!job || (job.status !== "running" && job.status !== "queued")) {
        stopJobStream(jobId);
      }
    });
  }, [jobs, streamingJobs, startJobStream, stopJobStream]);

  // Update jobs when initialJobs changes (e.g., from API refetch)
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  // Cleanup all streams on unmount
  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach((eventSource) => {
        eventSource.close();
      });
      eventSourcesRef.current.clear();
      jobOutputRef.current.clear();
    };
  }, []);

  return {
    jobs,
    streamingJobs,
    startJobStream,
    stopJobStream,
    updateJobs: setJobs,
  };
};
