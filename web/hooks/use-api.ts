"use client"

import { useState, useCallback } from "react"
import { api } from "@/services/real-api"
import { usePolling } from "./use-polling"
import type { Server, Job } from "@/types"

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useServers() {
  const [state, setState] = useState<UseApiState<Server[]>>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchServers = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      const response = await api.servers.getServers()

      if (response.success) {
        setState({
          data: response.data,
          loading: false,
          error: null,
          lastUpdated: response.timestamp,
        })
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.message || "Failed to fetch servers",
        }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    }
  }, [])

  // Poll every 5 seconds
  const { isPolling, startPolling, stopPolling } = usePolling(fetchServers, {
    interval: 5000,
    enabled: true,
    immediate: true,
  })

  const addServer = useCallback(
    async (server: Omit<Server, "id">) => {
      try {
        const response = await api.servers.addServer(server)
        if (response.success) {
          // Refresh data immediately
          await fetchServers()
          return response
        }
        throw new Error(response.message || "Failed to add server")
      } catch (error) {
        throw error
      }
    },
    [fetchServers],
  )

  const updateServer = useCallback(
    async (id: string, updates: Partial<Server>) => {
      try {
        const response = await api.servers.updateServer(id, updates)
        if (response.success) {
          // Refresh data immediately
          await fetchServers()
          return response
        }
        throw new Error(response.message || "Failed to update server")
      } catch (error) {
        throw error
      }
    },
    [fetchServers],
  )

  const deleteServer = useCallback(
    async (id: string) => {
      try {
        const response = await api.servers.deleteServer(id)
        if (response.success) {
          // Refresh data immediately
          await fetchServers()
          return response
        }
        throw new Error(response.message || "Failed to delete server")
      } catch (error) {
        throw error
      }
    },
    [fetchServers],
  )

  const testConnection = useCallback(
    async (id: string) => {
      try {
        const response = await api.servers.testConnection(id)
        if (response.success) {
          // Refresh data immediately to show updated status
          await fetchServers()
          return response
        }
        throw new Error(response.message || "Connection test failed")
      } catch (error) {
        throw error
      }
    },
    [fetchServers],
  )

  return {
    ...state,
    isPolling,
    startPolling,
    stopPolling,
    refetch: fetchServers,
    addServer,
    updateServer,
    deleteServer,
    testConnection,
  }
}

export function useJobs() {
  const [state, setState] = useState<UseApiState<Job[]>>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchJobs = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: prev.data === null, error: null }))
      const response = await api.jobs.getJobs()

      if (response.success) {
        setState({
          data: response.data,
          loading: false,
          error: null,
          lastUpdated: response.timestamp,
        })
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.message || "Failed to fetch jobs",
        }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    }
  }, [])

  // Poll every 5 seconds
  const { isPolling, startPolling, stopPolling } = usePolling(fetchJobs, {
    interval: 5000,
    enabled: true,
    immediate: true,
  })

  const executeJob = useCallback(
    async (serverIds: string[], command: string, timeout: number, args?: string) => {
      try {
        const response = await api.jobs.executeJob({
          serverIds,
          command,
          timeout,
          arguments: args,
        })
        if (response.success) {
          // Refresh data immediately
          await fetchJobs()
          return response
        }
        throw new Error(response.message || "Failed to execute job")
      } catch (error) {
        throw error
      }
    },
    [fetchJobs],
  )

  const cancelJob = useCallback(
    async (jobId: string) => {
      try {
        const response = await api.jobs.cancelJob(jobId)
        if (response.success) {
          // Refresh data immediately
          await fetchJobs()
          return response
        }
        throw new Error(response.message || "Failed to cancel job")
      } catch (error) {
        throw error
      }
    },
    [fetchJobs],
  )

  const deleteJob = useCallback(
    async (jobId: string) => {
      try {
        const response = await api.jobs.deleteJob(jobId)
        if (response.success) {
          // Refresh data immediately
          await fetchJobs()
          return response
        }
        throw new Error(response.message || "Failed to delete job")
      } catch (error) {
        throw error
      }
    },
    [fetchJobs],
  )

  return {
    ...state,
    isPolling,
    startPolling,
    stopPolling,
    refetch: fetchJobs,
    executeJob,
    cancelJob,
    deleteJob,
  }
}

export function useSystemStats() {
  const [state, setState] = useState<
    UseApiState<{
      totalServers: number
      connectedServers: number
      runningJobs: number
      completedJobs: number
      failedJobs: number
    }>
  >({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.system.getStats()

      if (response.success) {
        setState({
          data: response.data,
          loading: false,
          error: null,
          lastUpdated: response.timestamp,
        })
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.message || "Failed to fetch stats",
        }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    }
  }, [])

  // Poll every 5 seconds
  usePolling(fetchStats, {
    interval: 5000,
    enabled: true,
    immediate: true,
  })

  return state
}
