import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/services/real-api";
import type { Job } from "@/types";

interface JobLogs {
  job_id: string;
  status: string;
  command: string;
  args: string;
  exit_code?: number;
  output: string;
  error: string;
  stdout: string;
  stderr: string;
  started_at?: string;
  finished_at?: string;
  duration?: string;
  timeout: number;
  created_at: string;
  updated_at: string;
  metadata: {
    stdout_length: number;
    stderr_length: number;
    has_output: boolean;
    has_errors: boolean;
  };
}

export const useJobLogsPolling = (
  jobId: string | null,
  isModalOpen: boolean
) => {
  const [logs, setLogs] = useState<JobLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
        }/api/v1/jobs/${jobId}/logs`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data: JobLogs = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      console.error("Error fetching job logs:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Start polling when modal opens
  useEffect(() => {
    if (isModalOpen && jobId) {
      // Fetch immediately
      fetchLogs();

      // Then poll every 2 seconds
      intervalRef.current = setInterval(fetchLogs, 2000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Stop polling when modal closes
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Clear logs when modal closes
      setLogs(null);
      setError(null);
    }
  }, [isModalOpen, jobId, fetchLogs]);

  // Stop polling when job is completed
  useEffect(() => {
    if (
      logs &&
      (logs.status === "completed" ||
        logs.status === "failed" ||
        logs.status === "canceled")
    ) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [logs?.status]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
  };
};
