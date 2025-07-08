"use client"

import { useCallback } from "react"
import { api } from "@/services/real-api"
import { useOptimizedPolling } from "./use-optimized-polling"
import type { Server, Job } from "@/types"

// Deep comparison functions for detecting actual changes
const compareServers = (prev: Server[] | null, next: Server[]): boolean => {
  if (!prev || prev.length !== next.length) return false

  return prev.every((prevServer, index) => {
    const nextServer = next[index]
    return (
      prevServer.id === nextServer.id &&
      prevServer.name === nextServer.name &&
      prevServer.hostname === nextServer.hostname &&
      prevServer.port === nextServer.port &&
      prevServer.username === nextServer.username &&
      prevServer.authType === nextServer.authType &&
      prevServer.status === nextServer.status &&
      prevServer.sshKeyPath === nextServer.sshKeyPath &&
      prevServer.privateKeyContent === nextServer.privateKeyContent
    )
  })
}

const compareJobs = (prev: Job[] | null, next: Job[]): boolean => {
  if (!prev || prev.length !== next.length) return false

  return prev.every((prevJob, index) => {
    const nextJob = next[index]
    return (
      prevJob.id === nextJob.id &&
      prevJob.serverId === nextJob.serverId &&
      prevJob.serverName === nextJob.serverName &&
      prevJob.command === nextJob.command &&
      prevJob.status === nextJob.status &&
      prevJob.duration === nextJob.duration &&
      prevJob.exitCode === nextJob.exitCode &&
      prevJob.created.getTime() === nextJob.created.getTime()
    )
  })
}

export function useSmoothServers() {
  const fetchServers = useCallback(async () => {
    const response = await api.servers.getServers()
    if (!response.success) {
      throw new Error(response.message || "Failed to fetch servers")
    }
    return response.data
  }, [])

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
  })

  const addServer = useCallback(
    async (server: Omit<Server, "id">) => {
      const response = await api.servers.addServer(server)
      if (!response.success) {
        throw new Error(response.message || "Failed to add server")
      }
      // Force refresh to get the new server
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

  const updateServer = useCallback(
    async (id: string, updates: Partial<Server>) => {
      const response = await api.servers.updateServer(id, updates)
      if (!response.success) {
        throw new Error(response.message || "Failed to update server")
      }
      // Force refresh to get updated data
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

  const deleteServer = useCallback(
    async (id: string) => {
      const response = await api.servers.deleteServer(id)
      if (!response.success) {
        throw new Error(response.message || "Failed to delete server")
      }
      // Force refresh to remove deleted server
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

  const testConnection = useCallback(
    async (id: string) => {
      const response = await api.servers.testConnection(id)
      if (!response.success) {
        throw new Error(response.message || "Connection test failed")
      }
      // Force refresh to get updated status
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

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
  }
}

export function useSmoothJobs() {
  const fetchJobs = useCallback(async () => {
    const response = await api.jobs.getJobs()
    if (!response.success) {
      throw new Error(response.message || "Failed to fetch jobs")
    }
    return response.data
  }, [])

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
  })

  const executeJob = useCallback(
    async (serverIds: string[], command: string, timeout: number, args?: string) => {
      const response = await api.jobs.executeJob({
        serverIds,
        command,
        timeout,
        arguments: args,
      })
      if (!response.success) {
        throw new Error(response.message || "Failed to execute job")
      }
      // Force refresh to get new jobs
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

  const cancelJob = useCallback(
    async (jobId: string) => {
      const response = await api.jobs.cancelJob(jobId)
      if (!response.success) {
        throw new Error(response.message || "Failed to cancel job")
      }
      // Force refresh to get updated status
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

  const deleteJob = useCallback(
    async (jobId: string) => {
      const response = await api.jobs.deleteJob(jobId)
      if (!response.success) {
        throw new Error(response.message || "Failed to delete job")
      }
      // Force refresh to remove deleted job
      await forceRefresh()
      return response
    },
    [forceRefresh],
  )

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
    deleteJob,
  }
}

export function useSmoothSystemStats() {
  const fetchStats = useCallback(async () => {
    const response = await api.system.getStats()
    if (!response.success) {
      throw new Error(response.message || "Failed to fetch stats")
    }
    return response.data
  }, [])

  const {
    data: stats,
    loading,
    error,
  } = useOptimizedPolling(fetchStats, {
    interval: 5000,
    enabled: true,
    immediate: true,
  })

  return { stats, loading, error }
}
