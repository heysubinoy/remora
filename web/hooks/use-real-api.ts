"use client";

import { useCallback } from "react";
import { api, type GoServer, type GoJob } from "@/services/real-api";
import { useOptimizedPolling } from "./use-optimized-polling";
import type { Server, Job } from "@/types";

// Helper function to convert Go server to frontend server type
const convertGoServerToServer = (goServer: GoServer): Server => ({
  id: goServer.id,
  name: goServer.name,
  hostname: goServer.hostname,
  port: goServer.port,
  username: goServer.user,
  user: goServer.user,
  authType:
    goServer.auth_type === "password"
      ? "password"
      : goServer.auth_type === "key"
      ? "ssh-key"
      : "private-key",
  auth_type: goServer.auth_type,
  sshKeyPath: goServer.pem_file_url,
  privateKeyContent: goServer.private_key,
  private_key: goServer.private_key,
  password: goServer.password,
  pem_file_url: goServer.pem_file_url,
  status: "disconnected" as const, // Default status, will be updated by status checks
  is_active: goServer.is_active,
  created_at: goServer.created_at,
  updated_at: goServer.updated_at,
});

// Helper function to convert Go job to frontend job type
const convertGoJobToJob = (goJob: GoJob): Job => {
  // Calculate duration from timestamps
  let durationMs = 0;

  if (goJob.started_at) {
    const startTime = new Date(goJob.started_at);
    const endTime = goJob.finished_at
      ? new Date(goJob.finished_at)
      : new Date(); // Use current time for running jobs

    durationMs = endTime.getTime() - startTime.getTime();
  }

  return {
    id: goJob.id,
    serverId: goJob.server_id,
    server_id: goJob.server_id,
    serverName: goJob.server?.name || "",
    command: goJob.command + (goJob.args ? ` ${goJob.args}` : ""),
    args: goJob.args,
    status:
      goJob.status === "queued"
        ? "running"
        : goJob.status === "running"
        ? "running"
        : goJob.status === "completed"
        ? "completed"
        : goJob.status === "failed"
        ? "failed"
        : goJob.status === "canceled"
        ? "cancelled"
        : "cancelled",
    created: new Date(goJob.created_at),
    created_at: goJob.created_at,
    updated_at: goJob.updated_at,
    startedAt: goJob.started_at ? new Date(goJob.started_at) : undefined,
    started_at: goJob.started_at,
    finishedAt: goJob.finished_at ? new Date(goJob.finished_at) : undefined,
    finished_at: goJob.finished_at,
    duration: durationMs,
    exitCode: goJob.exit_code || null,
    exit_code: goJob.exit_code || null,
    output: goJob.output,
    error: goJob.error,
    stdout: goJob.stdout,
    stderr: goJob.stderr,
    timeout: goJob.timeout,
    logLevel: goJob.log_level,
    log_level: goJob.log_level,
    server: goJob.server ? convertGoServerToServer(goJob.server) : undefined,
  };
};

// Deep comparison functions for detecting actual changes
const compareServers = (prev: Server[] | null, next: Server[]): boolean => {
  if (!prev || prev.length !== next.length) return false;

  return prev.every((prevServer, index) => {
    const nextServer = next[index];
    return (
      prevServer.id === nextServer.id &&
      prevServer.name === nextServer.name &&
      prevServer.hostname === nextServer.hostname &&
      prevServer.port === nextServer.port &&
      prevServer.username === nextServer.username &&
      prevServer.authType === nextServer.authType &&
      prevServer.status === nextServer.status &&
      prevServer.sshKeyPath === nextServer.sshKeyPath &&
      prevServer.privateKeyContent === nextServer.privateKeyContent &&
      prevServer.password === nextServer.password
    );
  });
};

const compareJobs = (prev: Job[] | null, next: Job[]): boolean => {
  if (!prev || prev.length !== next.length) return false;

  return prev.every((prevJob, index) => {
    const nextJob = next[index];
    return (
      prevJob.id === nextJob.id &&
      prevJob.serverId === nextJob.serverId &&
      prevJob.serverName === nextJob.serverName &&
      prevJob.command === nextJob.command &&
      prevJob.status === nextJob.status &&
      prevJob.exitCode === nextJob.exitCode &&
      (prevJob.created?.getTime() || 0) === (nextJob.created?.getTime() || 0) &&
      (prevJob.startedAt?.getTime() || 0) ===
        (nextJob.startedAt?.getTime() || 0) &&
      (prevJob.finishedAt?.getTime() || 0) ===
        (nextJob.finishedAt?.getTime() || 0)
    );
  });
};

export function useRealServers() {
  const fetchServers = useCallback(async () => {
    const response = await api.servers.getServers();
    return response.servers.map(convertGoServerToServer);
  }, []);

  const {
    data: servers,
    setData: setServers,
    loading,
    error,
    lastUpdated,
    isPolling,
    forceRefresh,
    startPolling,
    stopPolling,
  } = useOptimizedPolling(fetchServers, {
    interval: 5000,
    enabled: true,
    immediate: true,
    compareFunction: compareServers,
  });

  const updateServerStatus = (
    serverUpdate: Partial<Server> & { id: string }
  ) => {
    console.log("Updating server status:", serverUpdate);
    setServers((prev) => {
      if (!prev) return prev;

      const updated = prev.map((s) =>
        s.id === serverUpdate.id ? { ...s, ...serverUpdate } : s
      );

      console.log("Updated servers:", updated);
      return updated;
    });
  };

  const updateMultipleServerStatus = (
    serverUpdates: Array<{
      id: string;
      status: Server["status"];
      message?: string;
    }>
  ) => {
    console.log("Updating multiple server statuses:", serverUpdates);
    setServers((prev) => {
      if (!prev) return prev;

      const updatesMap = new Map(
        serverUpdates.map((update) => [update.id, update])
      );

      const updated = prev.map((server) => {
        const update = updatesMap.get(server.id);
        return update ? { ...server, status: update.status } : server;
      });

      console.log("Updated servers:", updated);
      return updated;
    });
  };

  const checkAllServersStatus = useCallback(async () => {
    try {
      const response = await api.servers.checkAllServersStatus(true); // Only check active servers

      // Convert API response to the format expected by updateMultipleServerStatus
      const statusUpdates = response.servers.map((server) => ({
        id: server.server_id,
        status: server.status as Server["status"],
        message: server.message,
      }));

      // Update all server statuses at once
      updateMultipleServerStatus(statusUpdates);

      return response;
    } catch (error) {
      console.error("Failed to check all servers status:", error);
      throw error;
    }
  }, []);

  const addServer = useCallback(
    async (server: Omit<Server, "id">) => {
      // Convert frontend server type to Go server request
      const goServerRequest = {
        name: server.name,
        hostname: server.hostname,
        port: server.port,
        user: server.username || server.user || "",
        auth_type:
          server.authType === "password" || server.auth_type === "password"
            ? ("password" as const)
            : ("key" as const),
        password: server.password,
        private_key: server.privateKeyContent || server.private_key,
        pem_file_url: server.sshKeyPath || server.pem_file_url,
        is_active: server.is_active ?? true,
      };

      const response = await api.servers.createServer(goServerRequest);
      // Force refresh to get the new server
      await forceRefresh();
      return convertGoServerToServer(response);
    },
    [forceRefresh]
  );

  const updateServer = useCallback(
    async (id: string, updates: Partial<Server>) => {
      // Convert frontend updates to Go server update request
      const goServerUpdate: any = {};
      if (updates.name) goServerUpdate.name = updates.name;
      if (updates.hostname) goServerUpdate.hostname = updates.hostname;
      if (updates.port) goServerUpdate.port = updates.port;
      if (updates.username) goServerUpdate.user = updates.username;
      if (updates.authType)
        goServerUpdate.auth_type =
          updates.authType === "password" ? "password" : "key";
      if (updates.password) goServerUpdate.password = updates.password;
      if (updates.privateKeyContent)
        goServerUpdate.private_key = updates.privateKeyContent;
      if (updates.sshKeyPath) goServerUpdate.pem_file_url = updates.sshKeyPath;

      const response = await api.servers.updateServer(id, goServerUpdate);
      // Force refresh to get updated data
      await forceRefresh();
      return convertGoServerToServer(response);
    },
    [forceRefresh]
  );

  const deleteServer = useCallback(
    async (id: string, force: boolean = false) => {
      const response = await api.servers.deleteServer(id, force);
      // Force refresh to remove deleted server
      await forceRefresh();
      return response;
    },
    [forceRefresh]
  );

  const testConnection = useCallback(
    async (id: string) => {
      const response = await api.servers.testConnection(id);
      if (response.error) {
        throw new Error(response.error);
      }
      // Force refresh to get updated status
      await forceRefresh();
      return response;
    },
    [forceRefresh]
  );

  return {
    servers: servers || [],
    loading,
    error,
    lastUpdated,
    isPolling,
    startPolling,
    stopPolling,
    addServer,
    updateServer,
    deleteServer,
    testConnection,
    updateServerStatus,
    updateMultipleServerStatus,
    checkAllServersStatus,
  };
}

export function useRealJobs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  server_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  const fetchJobs = useCallback(async () => {
    const queryParams = {
      page: params?.page?.toString() || "1",
      limit: params?.limit?.toString() || "20",
      ...(params?.status && { status: params.status }),
      ...(params?.server_id && { server_id: params.server_id }),
      ...(params?.search && { search: params.search }),
      ...(params?.sort_by && { sort_by: params.sort_by }),
      ...(params?.sort_order && { sort_order: params.sort_order }),
    };

    const response = await api.jobs.getJobs(queryParams);
    return {
      jobs: response.jobs.map(convertGoJobToJob),
      pagination: response.pagination,
      filters: response.filters,
    };
  }, [params]);

  const {
    data: jobsData,
    loading,
    error,
    lastUpdated,
    isPolling,
    forceRefresh,
    startPolling,
    stopPolling,
  } = useOptimizedPolling(fetchJobs, {
    interval: 5000,
    enabled: true,
    immediate: true,
    compareFunction: (prev, next) => {
      // Compare the jobs array and pagination info
      if (!prev || !next) return false;
      return (
        compareJobs(prev.jobs, next.jobs) &&
        JSON.stringify(prev.pagination) === JSON.stringify(next.pagination)
      );
    },
  });

  const executeJob = useCallback(
    async (
      serverIds: string[],
      command: string,
      timeout: number,
      args?: string
    ) => {
      // For multiple servers, submit individual jobs
      const jobs = await Promise.all(
        serverIds.map((serverId) =>
          api.jobs.submitJob({
            command,
            args,
            server_id: serverId,
            timeout,
          })
        )
      );

      // Force refresh to get new jobs
      await forceRefresh();
      return jobs.map(convertGoJobToJob);
    },
    [forceRefresh]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      const response = await api.jobs.cancelJob(jobId);
      // Force refresh to get updated status
      await forceRefresh();
      return convertGoJobToJob(response.job);
    },
    [forceRefresh]
  );

  const rerunJob = useCallback(
    async (jobId: string, serverIds?: string[], timeout?: number) => {
      const options: any = {};
      if (serverIds && serverIds.length === 1) {
        options.server_id = serverIds[0];
      }
      if (timeout) {
        options.timeout = timeout;
      }

      const response = await api.jobs.duplicateJob(jobId, options);
      // Force refresh to get new job
      await forceRefresh();
      return convertGoJobToJob(response.new_job);
    },
    [forceRefresh]
  );

  return {
    jobs: jobsData?.jobs || [],
    pagination: jobsData?.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    },
    filters: jobsData?.filters || {
      sort_by: "created_at",
      sort_order: "desc",
    },
    loading,
    error,
    lastUpdated,
    isPolling,
    startPolling,
    stopPolling,
    executeJob,
    cancelJob,
    rerunJob,
    forceRefresh,
  };
}

export function useRealSystemStats() {
  const fetchStats = useCallback(async () => {
    try {
      // Fetch servers and jobs to calculate stats
      const [serversResponse, jobsResponse] = await Promise.all([
        api.servers.getServers(),
        api.jobs.getJobs({ limit: "1000" }), // Get more jobs for accurate stats
      ]);

      const servers = serversResponse.servers;
      const jobs = jobsResponse.jobs;

      // Calculate stats
      const totalServers = servers.length;
      const activeServers = servers.filter((s) => s.is_active).length;

      const runningJobs = jobs.filter((j) => j.status === "running").length;
      const completedJobs = jobs.filter((j) => j.status === "completed").length;
      const failedJobs = jobs.filter((j) => j.status === "failed").length;
      const totalJobs = jobsResponse.pagination.total; // Use actual total from pagination

      const connectionRate =
        totalServers > 0 ? (activeServers / totalServers) * 100 : 0;
      const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

      return {
        totalServers,
        connectedServers: activeServers,
        runningJobs,
        completedJobs,
        failedJobs,
        connectionRate: Math.round(connectionRate),
        totalJobs,
        successRate: Math.round(successRate),
      };
    } catch (error) {
      // Fallback to health check only
      await api.system.healthCheck();
      return {
        totalServers: 0,
        connectedServers: 0,
        runningJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        connectionRate: 0,
        totalJobs: 0,
        successRate: 0,
      };
    }
  }, []);

  const {
    data: stats,
    loading,
    error,
  } = useOptimizedPolling(fetchStats, {
    interval: 10000, // Slower polling for stats since it fetches more data
    enabled: true,
    immediate: true,
  });

  return { stats, loading, error };
}
