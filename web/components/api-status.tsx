"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Database, WifiOff, AlertCircle, RefreshCw } from "lucide-react"

interface ApiStatusProps {
  className?: string
}

export function ApiStatus({ className }: ApiStatusProps) {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected")
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkApiStatus = async () => {
    setIsChecking(true)
    try {
      const response = await fetch("/api/system/stats", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        setStatus("connected")
      } else {
        setStatus("error")
      }
    } catch (error) {
      setStatus("error")
    } finally {
      setIsChecking(false)
      setLastCheck(new Date())
    }
  }

  useEffect(() => {
    checkApiStatus()
    const interval = setInterval(checkApiStatus, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = () => {
    if (isChecking) {
      return <RefreshCw className="h-3 w-3 animate-spin" />
    }

    switch (status) {
      case "connected":
        return <Database className="h-3 w-3 text-green-500" />
      case "disconnected":
        return <WifiOff className="h-3 w-3 text-gray-500" />
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "API Connected"
      case "disconnected":
        return "API Disconnected"
      case "error":
        return "API Error"
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "bg-green-500/10 text-green-700 border-green-500/20"
      case "disconnected":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20"
      case "error":
        return "bg-red-500/10 text-red-700 border-red-500/20"
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkApiStatus}
            disabled={isChecking}
            className={`h-8 px-2 ${className}`}
          >
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-xs font-medium">{getStatusText()}</span>
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>Status: {getStatusText()}</div>
            {lastCheck && <div>Last check: {lastCheck.toLocaleTimeString()}</div>}
            <div>Click to refresh</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
