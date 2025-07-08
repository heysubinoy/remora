export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username?: string; // For frontend compatibility
  user?: string; // Backend field name
  authType?: "ssh-key" | "private-key" | "password";
  auth_type?: "key" | "password"; // Backend field name
  sshKeyPath?: string;
  privateKeyContent?: string;
  private_key?: string; // Backend field for private key content
  password?: string;
  pem_file_url?: string; // Backend field for PEM file URL
  status?: "connected" | "disconnected" | "error";
  is_active?: boolean; // Backend field
  created_at?: string; // Backend timestamp
  updated_at?: string; // Backend timestamp
}

export interface Job {
  id: string;
  serverId?: string; // For frontend compatibility
  server_id: string; // Backend field name
  serverName?: string; // For frontend compatibility
  command: string; // Combined command + args for display
  originalCommand?: string; // Original command without args (for duplication)
  args?: string;
  status: "running" | "completed" | "failed" | "cancelled" | "canceled";
  created?: Date; // For frontend compatibility
  created_at: string; // Backend timestamp field
  updated_at?: string; // Backend timestamp field
  startedAt?: Date; // For frontend compatibility
  started_at?: string; // Backend timestamp field
  finishedAt?: Date; // For frontend compatibility
  finished_at?: string; // Backend timestamp field
  duration: number; // calculated duration in milliseconds
  exitCode?: number | null; // For frontend compatibility
  exit_code: number | null; // Backend field name
  output?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  timeout?: number;
  logLevel?: string; // For frontend compatibility
  log_level?: string; // Backend field name
  server?: Server; // Embedded server object from backend
}

// API response types
export interface JobsResponse {
  jobs: Job[];
  filters: {
    search: string;
    server_id: string;
    sort_by: string;
    sort_order: string;
    status: string;
  };
  pagination: {
    has_next: boolean;
    has_prev: boolean;
    limit: number;
    page: number;
    total: number;
    total_pages: number;
  };
}

export interface JobFilters {
  search?: string;
  server_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  status?: string;
  page?: number;
  limit?: number;
}

export interface SystemInfo {
  total_servers: number;
  total_jobs: number;
  completed_jobs: number;
  running_jobs: number;
  failed_jobs: number;
  queued_jobs: number;
  success_rate: number;
  timestamp: string;
}

export interface EnhancedSystemInfo extends SystemInfo {
  connected_servers: number;
  disconnected_servers: number;
}
