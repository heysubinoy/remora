"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { WifiOff, AlertCircle, Activity } from "lucide-react"

interface ConnectionIndicatorProps {
  isPolling: boolean
  lastUpdated: Date | null
  error: string | null
  className?: string
}

export function ConnectionIndicator({ isPolling, lastUpdated, error, className }: ConnectionIndicatorProps) {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>("")

  useEffect(() => {
    if (!lastUpdated) return

    const updateTimer = () => {
      const now = new Date()
      const diff = now.getTime() - lastUpdated.getTime()
      const seconds = Math.floor(diff / 1000)

      if (seconds < 60) {
        setTimeSinceUpdate(`${seconds}s ago`)
      } else {
        const minutes = Math.floor(seconds / 60)
        setTimeSinceUpdate(`${minutes}m ago`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  const getStatus = () => {
    if (error) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        text: "Error",
        variant: "destructive" as const,
        pulse: false,
      }
    }

    if (isPolling) {
      return {
        icon: <Activity className="h-3 w-3" />,
        text: "Live",
        variant: "default" as const,
        pulse: true,
      }
    }

    return {
      icon: <WifiOff className="h-3 w-3" />,
      text: "Offline",
      variant: "secondary" as const,
      pulse: false,
    }
  }

  const status = getStatus()

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <Badge variant={status.variant} className="flex items-center gap-1">
        <div className={status.pulse ? "animate-pulse" : ""}>{status.icon}</div>
        {status.text}
      </Badge>
      {lastUpdated && !error && <span className="text-muted-foreground">{timeSinceUpdate}</span>}
    </div>
  )
}
