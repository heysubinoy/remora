"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Job, jobAPI, createJobStream } from "@/lib/api";

interface LiveJobState {
  job: Job | null;
  logs: {
    stdout: string;
    stderr: string;
    output: string;
    error: string;
  };
  isConnected: boolean;
  error: string | null;
  loading: boolean;
}

interface UseLiveJobOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useLiveJob(
  jobId: string | null,
  options: UseLiveJobOptions = {}
) {
  const { autoRefresh = true, refreshInterval = 1000 } = options;

  const [state, setState] = useState<LiveJobState>({
    job: null,
    logs: {
      stdout: "",
      stderr: "",
      output: "",
      error: "",
    },
    isConnected: false,
    error: null,
    loading: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial job data
  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch job details
      const job = await jobAPI.get(jobId);

      // If job is completed/failed/canceled, fetch final logs via REST
      let stdout = "";
      let stderr = "";

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "canceled"
      ) {
        console.log(
          "🔍 Fetching logs for completed job:",
          jobId,
          "status:",
          job.status
        );
        [stdout, stderr] = await Promise.all([
          jobAPI.getStdout(jobId).catch((err) => {
            console.error("❌ Failed to fetch stdout:", err);
            return "";
          }),
          jobAPI.getStderr(jobId).catch((err) => {
            console.error("❌ Failed to fetch stderr:", err);
            return "";
          }),
        ]);
        console.log(
          "📝 Fetched logs - stdout length:",
          stdout.length,
          "stderr length:",
          stderr.length
        );
      }

      setState((prev) => ({
        ...prev,
        job,
        logs: {
          stdout,
          stderr,
          output: job.output || "",
          error: job.error || "",
        },
        loading: false,
      }));
      console.log(
        "✅ State updated with logs - stdout:",
        stdout.length > 0 ? `${stdout.length} chars` : "empty",
        "stderr:",
        stderr.length > 0 ? `${stderr.length} chars` : "empty"
      );
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to fetch job",
        loading: false,
      }));
    }
  }, [jobId]);

  // Setup SSE for live updates
  useEffect(() => {
    if (!jobId || !autoRefresh) return;

    const job = state.job;
    if (!job || (job.status !== "running" && job.status !== "queued")) {
      return;
    }

    console.log("🔴 Setting up SSE for job:", jobId, "status:", job.status);

    try {
      eventSourceRef.current = createJobStream(jobId);

      eventSourceRef.current.onopen = () => {
        console.log("🟢 SSE connection opened for job:", jobId);
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
      };

      // Handle real-time output events
      eventSourceRef.current.addEventListener("output", (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const outputData = JSON.parse(messageEvent.data);
          console.log("📤 SSE Output event:", outputData);

          setState((prev) => {
            const currentOutput = prev.logs.output || "";
            const currentError = prev.logs.error || "";

            // Append new output to existing content
            const newContent = outputData.content || "";

            if (outputData.is_stderr) {
              return {
                ...prev,
                logs: {
                  ...prev.logs,
                  error: currentError + newContent,
                },
              };
            } else {
              return {
                ...prev,
                logs: {
                  ...prev.logs,
                  output: currentOutput + newContent,
                },
              };
            }
          });
        } catch (err) {
          console.error("❌ Error parsing SSE output data:", err);
        }
      });
      eventSourceRef.current.addEventListener("status", (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const jobData = JSON.parse(messageEvent.data);
          console.log("📊 SSE Status update:", jobData);

          setState((prev) => ({
            ...prev,
            job: { ...prev.job, ...jobData },
            // For running jobs, keep existing logs and update other fields
            logs: {
              ...prev.logs,
              output: jobData.output || prev.logs.output,
              error: jobData.error || prev.logs.error,
            },
          }));
        } catch (err) {
          console.error("❌ Error parsing SSE status data:", err);
        }
      });

      // Handle completion
      eventSourceRef.current.addEventListener("complete", (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const jobData = JSON.parse(messageEvent.data);
          console.log("✅ SSE Job complete:", jobData);

          setState((prev) => ({
            ...prev,
            job: { ...prev.job, ...jobData },
            isConnected: false,
          }));

          // Close the connection
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          // Fetch final logs via REST endpoints for completed jobs
          if (jobData.id) {
            console.log(
              "🔄 Fetching final logs after completion for job:",
              jobData.id
            );
            Promise.all([
              jobAPI.getStdout(jobData.id).catch((err) => {
                console.error(
                  "❌ Failed to fetch stdout after completion:",
                  err
                );
                return "";
              }),
              jobAPI.getStderr(jobData.id).catch((err) => {
                console.error(
                  "❌ Failed to fetch stderr after completion:",
                  err
                );
                return "";
              }),
            ]).then(([stdout, stderr]) => {
              console.log(
                "📝 Final logs fetched - stdout length:",
                stdout.length,
                "stderr length:",
                stderr.length
              );
              setState((current) => ({
                ...current,
                logs: {
                  ...current.logs,
                  stdout,
                  stderr,
                  output: jobData.output || current.logs.output,
                  error: jobData.error || current.logs.error,
                },
              }));
            });
          }
        } catch (err) {
          console.error("❌ Error parsing SSE complete data:", err);
        }
      });

      // Handle errors
      eventSourceRef.current.addEventListener("error", (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data = JSON.parse(messageEvent.data);
          console.error("❌ SSE Job error:", data);
          setState((prev) => ({
            ...prev,
            error: data.error || "Job error occurred",
            isConnected: false,
          }));
        } catch (err) {
          console.error("❌ Error parsing SSE error data:", err);
        }
      });

      eventSourceRef.current.onerror = (err) => {
        console.error("❌ SSE connection error:", err);
        setState((prev) => ({ ...prev, isConnected: false }));

        // Retry connection after a delay for running jobs
        if (job && job.status === "running") {
          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              fetchJob(); // Refetch and potentially reconnect
            }
          }, 2000);
        }
      };
    } catch (err) {
      console.error("❌ Failed to create SSE connection:", err);
      setState((prev) => ({
        ...prev,
        error: "Failed to establish live connection",
        isConnected: false,
      }));
    }

    return () => {
      if (eventSourceRef.current) {
        console.log("🔴 Closing SSE connection for job:", jobId);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId, state.job?.status, autoRefresh, fetchJob]);

  // Fallback polling for jobs that don't support SSE
  useEffect(() => {
    if (!jobId || !autoRefresh) return;
    if (eventSourceRef.current) return; // SSE is active

    const job = state.job;
    if (!job || (job.status !== "running" && job.status !== "queued")) {
      return;
    }

    const pollJob = async () => {
      try {
        await fetchJob();
      } catch (err) {
        console.error("❌ Polling error:", err);
      }
    };

    refreshTimeoutRef.current = setTimeout(pollJob, refreshInterval);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [jobId, state.job?.status, autoRefresh, refreshInterval, fetchJob]);

  // Initial fetch
  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  const refetch = useCallback(() => {
    fetchJob();
  }, [fetchJob]);

  const cancelJob = useCallback(async () => {
    if (!jobId || !state.job) return;

    try {
      await jobAPI.cancel(jobId);
      await fetchJob(); // Refresh job status
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to cancel job",
      }));
    }
  }, [jobId, state.job, fetchJob]);

  return {
    ...state,
    refetch,
    cancelJob,
  };
}
