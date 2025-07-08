import { SystemInfo, EnhancedSystemInfo } from "@/types";

// Configuration
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// Helper function to build API URLs
const buildApiUrl = (path: string): string => {
  return `${BACKEND_URL}${path}`;
};

// Helper function to build API URLs with parameters
const buildApiUrlWithParams = (
  path: string,
  params?: Record<string, string>
): string => {
  const url = new URL(buildApiUrl(path));
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  return url.toString();
};

// Go API types based on internal/models
export interface GoServer {
  id: string;
  name: string;
  hostname: string;
  port: number;
  user: string;
  auth_type: "password" | "key";
  password?: string;
  private_key?: string;
  pem_file?: string;
  pem_file_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoJob {
  id: string;
  command: string;
  args: string;
  server_id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  priority: number;
  output: string;
  error: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  timeout: number;
  log_level: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  duration?: string;
  server?: GoServer;
}

export interface JobRequest {
  command: string;
  args?: string;
  server_id: string;
  timeout?: number;
  priority?: number;
}

export interface ScriptJobRequest {
  script: string;
  args?: string;
  server_id: string;
  timeout?: number;
  shell?: string;
  priority?: number;
}

export interface DuplicateJobRequest {
  server_id?: string;
  timeout?: number;
  priority?: number;
}

export interface ServerRequest {
  name: string;
  hostname: string;
  port?: number;
  user: string;
  auth_type: "password" | "key";
  password?: string;
  private_key?: string;
  pem_file?: string;
  pem_file_url?: string;
  is_active?: boolean;
}

export interface ServerUpdateRequest {
  name?: string;
  hostname?: string;
  port?: number;
  user?: string;
  auth_type?: "password" | "key";
  password?: string;
  private_key?: string;
  pem_file?: string;
  pem_file_url?: string;
  is_active?: boolean;
}

// API client for Go backend
export const goApi = {
  servers: {
    // GET /api/v1/servers
    async getServers(): Promise<{ servers: GoServer[] }> {
      const response = await fetch(buildApiUrl("/api/v1/servers"), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // POST /api/v1/servers
    async createServer(server: ServerRequest): Promise<GoServer> {
      const response = await fetch(buildApiUrl("/api/v1/servers"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(server),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // GET /api/v1/servers/:id
    async getServer(id: string): Promise<GoServer> {
      const response = await fetch(buildApiUrl(`/api/v1/servers/${id}`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // PUT /api/v1/servers/:id
    async updateServer(
      id: string,
      updates: ServerUpdateRequest
    ): Promise<GoServer> {
      const response = await fetch(buildApiUrl(`/api/v1/servers/${id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // DELETE /api/v1/servers/:id
    async deleteServer(
      id: string,
      force: boolean = false
    ): Promise<{ message: string; deleted_jobs: number }> {
      const url = buildApiUrlWithParams(
        `/api/v1/servers/${id}`,
        force ? { force: "true" } : undefined
      );

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `HTTP error! status: ${response.status}`;

        // Include additional details if available
        const details = errorData.details ? ` ${errorData.details}` : "";
        const fullError = `${errorMessage}${details}`;

        throw new Error(fullError);
      }

      return response.json();
    },

    // POST /api/v1/servers/:id/test
    async testConnection(id: string): Promise<{
      server_id: string;
      status: string;
      message?: string;
      error?: string;
    }> {
      const response = await fetch(buildApiUrl(`/api/v1/servers/${id}/test`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Connection test failed`);
      }

      return response.json();
    },

    // GET /api/v1/servers/:id/status
    async checkServerStatus(id: string): Promise<{
      server_id: string;
      server_name: string;
      hostname: string;
      port: number;
      status: "connected" | "disconnected";
      message: string;
      checked_at: string;
    }> {
      const response = await fetch(
        buildApiUrl(`/api/v1/servers/${id}/status`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server status check failed`);
      }

      return response.json();
    },

    // GET /api/v1/servers/status/all
    async checkAllServersStatus(active?: boolean): Promise<{
      total_servers: number;
      connected: number;
      disconnected: number;
      servers: Array<{
        server_id: string;
        server_name: string;
        hostname: string;
        port: number;
        status: "connected" | "disconnected";
        message: string;
        checked_at: string;
      }>;
    }> {
      const url = buildApiUrlWithParams(
        "/api/v1/servers/status/all",
        active !== undefined ? { active: active.toString() } : undefined
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `All servers status check failed`);
      }

      return response.json();
    },
  },

  jobs: {
    // GET /api/v1/jobs
    async getJobs(params?: {
      page?: string;
      limit?: string;
      status?: string;
      server_id?: string;
      search?: string;
      sort_by?: string;
      sort_order?: "asc" | "desc";
    }): Promise<{
      jobs: GoJob[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
      };
      filters: {
        status?: string;
        server_id?: string;
        search?: string;
        sort_by: string;
        sort_order: string;
      };
    }> {
      const url = buildApiUrlWithParams("/api/v1/jobs", params);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // POST /api/v1/jobs
    async submitJob(job: JobRequest): Promise<GoJob> {
      const response = await fetch(buildApiUrl("/api/v1/jobs"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(job),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // POST /api/v1/jobs/script
    async submitScriptJob(scriptJob: ScriptJobRequest): Promise<GoJob> {
      const response = await fetch(buildApiUrl("/api/v1/jobs/script"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scriptJob),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // GET /api/v1/jobs/:id
    async getJob(id: string): Promise<GoJob> {
      const response = await fetch(buildApiUrl(`/api/v1/jobs/${id}`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // POST /api/v1/jobs/:id/cancel
    async cancelJob(id: string): Promise<{ message: string; job: GoJob }> {
      const response = await fetch(buildApiUrl(`/api/v1/jobs/${id}/cancel`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // POST /api/v1/jobs/:id/duplicate
    async duplicateJob(
      id: string,
      options?: DuplicateJobRequest
    ): Promise<{ message: string; original_job: string; new_job: GoJob }> {
      const response = await fetch(
        buildApiUrl(`/api/v1/jobs/${id}/duplicate`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options || {}),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // GET /api/v1/jobs/:id/logs
    async getJobLogs(id: string): Promise<{
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
    }> {
      const response = await fetch(buildApiUrl(`/api/v1/jobs/${id}/logs`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // GET /api/v1/jobs/:id/stdout
    async getJobStdout(id: string): Promise<string> {
      const response = await fetch(buildApiUrl(`/api/v1/jobs/${id}/stdout`), {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.text().catch(() => "HTTP error");
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      return response.text();
    },

    // GET /api/v1/jobs/:id/stderr
    async getJobStderr(id: string): Promise<string> {
      const response = await fetch(buildApiUrl(`/api/v1/jobs/${id}/stderr`), {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.text().catch(() => "HTTP error");
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      return response.text();
    },

    // GET /api/v1/jobs/:id/stream (Server-Sent Events)
    streamJob(
      id: string,
      onMessage: (data: any) => void,
      onError?: (error: Error) => void
    ): EventSource {
      const eventSource = new EventSource(
        buildApiUrl(`/api/v1/jobs/${id}/stream`)
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          onError?.(new Error(`Failed to parse SSE data: ${e}`));
        }
      };

      eventSource.onerror = (event) => {
        onError?.(new Error("SSE connection error"));
      };

      return eventSource;
    },
  },

  files: {
    // POST /api/v1/pem-files/upload
    async uploadPemFile(
      file: File
    ): Promise<{ message: string; pem_file_url: string; filename: string }> {
      const formData = new FormData();
      formData.append("pem_file", file);

      const response = await fetch(buildApiUrl("/api/v1/pem-files/upload"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },
  },

  system: {
    // GET /health
    async healthCheck(): Promise<{ status: string }> {
      const response = await fetch(buildApiUrl("/health"), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },

    // GET /api/v1/system/info
    async getSystemInfo(): Promise<SystemInfo> {
      const response = await fetch(buildApiUrl("/api/v1/system/info"), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    },

    // Enhanced system info that includes server connection status
    async getEnhancedSystemInfo(): Promise<
      SystemInfo & {
        connected_servers: number;
        disconnected_servers: number;
      }
    > {
      try {
        // Get basic system info and server status in parallel
        const [systemInfo, serverStatus] = await Promise.all([
          this.getSystemInfo(),
          goApi.servers.checkAllServersStatus(true), // Only check active servers
        ]);

        return {
          ...systemInfo,
          connected_servers: serverStatus.connected,
          disconnected_servers: serverStatus.disconnected,
        };
      } catch (error) {
        // If server status check fails, fall back to basic system info
        const systemInfo = await this.getSystemInfo();
        return {
          ...systemInfo,
          connected_servers: 0,
          disconnected_servers: 0,
        };
      }
    },
  },
};

// Export the Go API as the main API
export const api = goApi;

// Legacy export for backward compatibility
export const realApi = goApi;
