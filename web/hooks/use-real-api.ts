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
  authType:
    goServer.auth_type === "password"
      ? "password"
      : goServer.auth_type === "key"
      ? "ssh-key"
      : "private-key",
  sshKeyPath: goServer.pem_file_url,
  privateKeyContent: goServer.private_key,
  password: goServer.password,
  status: "disconnected" as const, // Default status, will be updated by connection tests
});

// Helper function to convert Go job to frontend job type
const convertGoJobToJob = (goJob: GoJob): Job => {
  // Parse duration from Go duration string (e.g., "2h30m15s" -> milliseconds)
  let durationMs = 0;
  if (goJob.duration) {
    const durationStr = goJob.duration.toString();
    if (goJob.started_at && goJob.finished_at) {
      durationMs =
        new Date(goJob.finished_at).getTime() -
        new Date(goJob.started_at).getTime();
    }
  }

  return {
    id: goJob.id,
    serverId: goJob.server_id,
    serverName: goJob.server?.name || "",
    command: goJob.command + (goJob.args ? ` ${goJob.args}` : ""),
    status:
      goJob.status === "queued"
        ? "running"
        : goJob.status === "running"
        ? "running"
        : goJob.status === "completed"
        ? "completed"
        : goJob.status === "failed"
        ? "failed"
        : "cancelled",
    created: new Date(goJob.created_at),
    duration: durationMs,
    exitCode: goJob.exit_code || null,
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
      prevJob.duration === nextJob.duration &&
      prevJob.exitCode === nextJob.exitCode &&
      new Date(prevJob.created).getTime() ===
        new Date(nextJob.created).getTime()
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

  const addServer = useCallback(
    async (server: Omit<Server, "id">) => {
      // Convert frontend server type to Go server request
      const goServerRequest = {
        name: server.name,
        hostname: server.hostname,
        port: server.port,
        user: server.username,
        auth_type:
          server.authType === "password"
            ? ("password" as const)
            : ("key" as const),
        password: server.password,
        private_key: server.privateKeyContent,
        pem_file_url: server.sshKeyPath,
        is_active: true,
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
    async (id: string) => {
      const response = await api.servers.deleteServer(id);
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
  };
}

export function useRealJobs() {
  const fetchJobs = useCallback(async () => {
    const response = await api.jobs.getJobs();
    return response.jobs.map(convertGoJobToJob);
  }, []);

  const {
    data: jobs,
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
    compareFunction: compareJobs,
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

  // Note: Go API doesn't have deleteJob endpoint, so we'll remove this function
  // If you need to delete jobs, you'll need to add that endpoint to your Go API

  return {
    jobs: jobs || [],
    loading,
    error,
    lastUpdated,
    isPolling,
    startPolling,
    stopPolling,
    executeJob,
    cancelJob,
    // deleteJob removed as it's not available in Go API
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
      const totalJobs = jobs.length;

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
