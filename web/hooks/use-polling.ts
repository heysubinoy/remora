"use client"

import { useEffect, useRef, useCallback } from "react"

interface UsePollingOptions {
  interval: number
  enabled?: boolean
  immediate?: boolean
}

export function usePolling(
  callback: () => void | Promise<void>,
  { interval, enabled = true, immediate = true }: UsePollingOptions,
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const startPolling = useCallback(() => {
    if (intervalRef.current) return // Already polling

    const poll = async () => {
      try {
        await callbackRef.current()
      } catch (error) {
        console.error("Polling error:", error)
      }
    }

    // Execute immediately if requested
    if (immediate) {
      poll()
    }

    // Set up interval
    intervalRef.current = setInterval(poll, interval)
  }, [interval, immediate])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const restartPolling = useCallback(() => {
    stopPolling()
    startPolling()
  }, [stopPolling, startPolling])

  // Start/stop polling based on enabled flag
  useEffect(() => {
    if (enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return stopPolling
  }, [enabled, startPolling, stopPolling])

  // Cleanup on unmount
  useEffect(() => {
    return stopPolling
  }, [stopPolling])

  return {
    startPolling,
    stopPolling,
    restartPolling,
    isPolling: intervalRef.current !== null,
  }
}
