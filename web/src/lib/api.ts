/**
 * API client for Job Executor Backend
 * Provides typed functions for all backend endpoints
 */

// Base configuration
const API_BASE_URL = "http://localhost:8080";

// Types matching the backend models
export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  user: string;
  auth_type: string;
  password?: string;
  private_key?: string;
  pem_file?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  command: string;
  args: string;
  server_id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  output: string;
  error: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timeout: number;
  log_level: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  server?: Server;
  duration?: number;
}

export interface JobRequest {
  command: string;
  args?: string;
  server_id: string;
  timeout?: number;
}

export interface ServerRequest {
  name: string;
  hostname: string;
  port: number;
  user: string;
  auth_type: string;
  password?: string;
  private_key?: string;
  pem_file?: string;
  is_active?: boolean;
}

export interface JobLogs {
  job_id: string;
  status: string;
  command: string;
  args: string;
  exit_code: number | null;
  output: string;
  error: string;
  stdout: string;
  stderr: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
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

// API Error class
export class APIError extends Error {
  constructor(message: string, public status: number, public response?: any) {
    super(message);
    this.name = "APIError";
  }
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      `Network error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      0
    );
  }
}

// Generic API request function for text responses
async function apiTextRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<string> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    headers: {
      Accept: "text/plain",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      // For text endpoints, try to get error as text first, then fall back to JSON
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage =
          (await response.text()) ||
          `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new APIError(errorMessage, response.status);
    }

    const text = await response.text();
    return text;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      `Network error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      0
    );
  }
}

// Server API functions
export const serverAPI = {
  // Get all servers
  list: (): Promise<{ servers: Server[] }> => apiRequest("/api/v1/servers"),

  // Get server by ID
  get: (id: string): Promise<Server> => apiRequest(`/api/v1/servers/${id}`),

  // Create new server
  create: (server: ServerRequest): Promise<Server> =>
    apiRequest("/api/v1/servers", {
      method: "POST",
      body: JSON.stringify(server),
    }),

  // Update server
  update: (id: string, server: Partial<ServerRequest>): Promise<Server> =>
    apiRequest(`/api/v1/servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(server),
    }),

  // Delete server
  delete: (id: string): Promise<void> =>
    apiRequest(`/api/v1/servers/${id}`, {
      method: "DELETE",
    }),

  // Test server connection
  test: (id: string): Promise<{ status: string; message?: string }> =>
    apiRequest(`/api/v1/servers/${id}/test`, {
      method: "POST",
    }),
};

// Job API functions
export const jobAPI = {
  // Get all jobs
  list: (params?: {
    page?: string;
    limit?: string;
    status?: string;
    server_id?: string;
  }): Promise<{ jobs: Job[]; page: string; limit: string }> => {
    const searchParams = new URLSearchParams(params || {});
    const query = searchParams.toString();
    return apiRequest(`/api/v1/jobs${query ? `?${query}` : ""}`);
  },

  // Get job by ID
  get: (id: string): Promise<Job> => apiRequest(`/api/v1/jobs/${id}`),

  // Submit new job
  submit: (job: JobRequest): Promise<Job> =>
    apiRequest("/api/v1/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    }),

  // Cancel job
  cancel: (id: string): Promise<Job> =>
    apiRequest(`/api/v1/jobs/${id}/cancel`, {
      method: "POST",
    }),

  // Get job logs
  getLogs: (id: string): Promise<JobLogs> =>
    apiRequest(`/api/v1/jobs/${id}/logs`),

  // Get job stdout
  getStdout: (id: string): Promise<string> =>
    apiTextRequest(`/api/v1/jobs/${id}/stdout`),

  // Get job stderr
  getStderr: (id: string): Promise<string> =>
    apiTextRequest(`/api/v1/jobs/${id}/stderr`),
};

// Health check
export const healthAPI = {
  check: (): Promise<{ status: string }> =>
    apiRequest("/health", {
      method: "GET",
      headers: {},
    }),
};

// Server-Sent Events for real-time job updates
export function createJobStream(jobId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/api/v1/jobs/${jobId}/stream`);
}

// Utility function to format duration
export function formatDuration(nanoseconds: number | undefined): string {
  if (!nanoseconds) return "-";

  const seconds = nanoseconds / 1000000000;

  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
}

// Utility function to format timestamps
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString();
}
