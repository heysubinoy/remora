/**
 * Custom hooks for Job Executor API
 * Provides React hooks for server and job management
 */

import { useState, useEffect, useCallback } from "react";
import {
  serverAPI,
  jobAPI,
  healthAPI,
  createJobStream,
  Server,
  Job,
  JobRequest,
  ServerRequest,
  JobLogs,
  APIError,
} from "@/lib/api";

// Generic hook for API state management
interface UseAPIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Hook for server management
export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await serverAPI.list();
      setServers(response.servers || []);
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : "Failed to fetch servers";
      setError(message);
      console.error("Error fetching servers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createServer = useCallback(
    async (serverData: ServerRequest): Promise<boolean> => {
      try {
        setError(null);
        const newServer = await serverAPI.create(serverData);
        setServers((prev) => [...prev, newServer]);
        return true;
      } catch (err) {
        const message =
          err instanceof APIError ? err.message : "Failed to create server";
        setError(message);
        console.error("Error creating server:", err);
        return false;
      }
    },
    []
  );

  const updateServer = useCallback(
    async (
      id: string,
      serverData: Partial<ServerRequest>
    ): Promise<boolean> => {
      try {
        setError(null);
        const updatedServer = await serverAPI.update(id, serverData);
        setServers((prev) =>
          prev.map((s) => (s.id === id ? updatedServer : s))
        );
        return true;
      } catch (err) {
        const message =
          err instanceof APIError ? err.message : "Failed to update server";
        setError(message);
        console.error("Error updating server:", err);
        return false;
      }
    },
    []
  );

  const deleteServer = useCallback(async (id: string, force?: boolean): Promise<boolean> => {
    try {
      setError(null);
      await serverAPI.delete(id, force);
      setServers((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : "Failed to delete server";
      setError(message);
      console.error("Error deleting server:", err);
      return false;
    }
  }, []);

  const testConnection = useCallback(
    async (id: string): Promise<{ success: boolean; message?: string }> => {
      try {
        setError(null);
        const result = await serverAPI.test(id);
        return { success: true, message: result.message };
      } catch (err) {
        const message =
          err instanceof APIError ? err.message : "Connection test failed";
        setError(message);
        console.error("Error testing connection:", err);
        return { success: false, message };
      }
    },
    []
  );

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return {
    servers,
    loading,
    error,
    refetch: fetchServers,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
  };
}

// Hook for job management
export function useJobs(filters?: { status?: string; server_id?: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await jobAPI.list({
        limit: "50", // Get more jobs for better UX
        ...filters,
      });
      setJobs(response.jobs || []);
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : "Failed to fetch jobs";
      setError(message);
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const submitJob = useCallback(
    async (jobData: JobRequest): Promise<boolean> => {
      try {
        const newJob = await jobAPI.submit(jobData);
        setError(null);
        setJobs((prev) => [newJob, ...prev]);
        return true;
      } catch (err) {
        const message =
          err instanceof APIError ? err.message : "Failed to submit job";
        setError(message);
        console.error("Error submitting job:", err);
        return false;
      }
    },
    []
  );

  const cancelJob = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const canceledJob = await jobAPI.cancel(id);
      setJobs((prev) => prev.map((j) => (j.id === id ? canceledJob : j)));
      return true;
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : "Failed to cancel job";
      setError(message);
      console.error("Error canceling job:", err);
      return false;
    }
  }, []);

  // Lightweight status check that only updates changed jobs
  const checkJobStatusUpdates = useCallback(async () => {
    try {
      const response = await jobAPI.list({
        limit: "50",
        ...filters,
      });
      const newJobs = response.jobs || [];

      setJobs((prevJobs) => {
        // Check if any job status actually changed
        const hasChanges = newJobs.some((newJob) => {
          const existingJob = prevJobs.find((j) => j.id === newJob.id);
          return (
            existingJob &&
            (existingJob.status !== newJob.status ||
              existingJob.exit_code !== newJob.exit_code ||
              existingJob.duration !== newJob.duration)
          );
        });

        // Only update if there are actual changes
        if (hasChanges) {
          console.log("Job status changes detected, updating...");
          return newJobs;
        }

        // No changes, return previous jobs to prevent re-render
        return prevJobs;
      });
    } catch (err) {
      console.error("Error checking job status updates:", err);
    }
  }, [filters]);

  // Auto-refresh jobs every 5 seconds for running/queued jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === "running" || job.status === "queued"
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      checkJobStatusUpdates();
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs, checkJobStatusUpdates]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs,
    submitJob,
    cancelJob,
  };
}

// Hook for individual job details and logs
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<JobLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);
      const [jobData, logsData] = await Promise.all([
        jobAPI.get(jobId),
        jobAPI.getLogs(jobId),
      ]);
      setJob(jobData);
      setLogs(logsData);
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : "Failed to fetch job details";
      setError(message);
      console.error("Error fetching job:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Real-time updates for running jobs
  useEffect(() => {
    if (
      !jobId ||
      !job ||
      (job.status !== "running" && job.status !== "queued")
    ) {
      return;
    }

    console.log("Starting SSE for job:", jobId, "with status:", job.status);
    const eventSource = createJobStream(jobId);

    // Handle status updates
    eventSource.addEventListener("status", (event) => {
      try {
        const messageEvent = event as MessageEvent;
        const data = JSON.parse(messageEvent.data);
        console.log("SSE Status update:", data);
        setJob(data);
      } catch (err) {
        console.error("Error parsing SSE status data:", err);
      }
    });

    // Handle completion
    eventSource.addEventListener("complete", (event) => {
      try {
        const messageEvent = event as MessageEvent;
        const data = JSON.parse(messageEvent.data);
        console.log("SSE Job complete:", data);
        setJob(data);
        eventSource.close();
      } catch (err) {
        console.error("Error parsing SSE complete data:", err);
      }
    });

    // Handle errors
    eventSource.addEventListener("error", (event) => {
      try {
        const messageEvent = event as MessageEvent;
        const data = JSON.parse(messageEvent.data);
        console.error("SSE Job error:", data);
        setError(data.error || "Job error occurred");
        eventSource.close();
      } catch (err) {
        console.error("Error parsing SSE error data:", err);
      }
    });

    eventSource.onopen = () => {
      console.log("SSE connection opened for job:", jobId);
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, job?.status]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  return {
    job,
    logs,
    loading,
    error,
    refetch: fetchJob,
  };
}

// Hook for health status
export function useHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      await healthAPI.check();
      setIsHealthy(true);
    } catch (err) {
      setIsHealthy(false);
      console.error("Health check failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    isHealthy,
    loading,
    checkHealth,
  };
}

// Hook for managing form state and validation
export function useFormState<T>(initialState: T) {
  const [values, setValues] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const setValue = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // Clear error when user starts typing
      if (errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    },
    [errors]
  );

  const setError = useCallback(<K extends keyof T>(key: K, error: string) => {
    setErrors((prev) => ({ ...prev, [key]: error }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialState);
    setErrors({});
  }, [initialState]);

  const hasErrors = Object.values(errors).some((error) => !!error);

  return {
    values,
    errors,
    hasErrors,
    setValue,
    setError,
    reset,
  };
}
