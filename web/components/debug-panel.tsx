"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Code, ChevronDown, Database, Activity, Server, Terminal } from "lucide-react"
import type { Server as ServerType, Job } from "@/types"

interface DebugPanelProps {
  servers: ServerType[]
  jobs: Job[]
  stats: any
  serversError: string | null
  jobsError: string | null
  isPolling: boolean
}

export function DebugPanel({ servers, jobs, stats, serversError, jobsError, isPolling }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const apiEndpoints = [
    { method: "GET", path: "/api/servers", description: "Fetch all servers" },
    { method: "POST", path: "/api/servers", description: "Create new server" },
    { method: "PUT", path: "/api/servers/[id]", description: "Update server" },
    { method: "DELETE", path: "/api/servers/[id]", description: "Delete server" },
    { method: "POST", path: "/api/servers/[id]/test-connection", description: "Test connection" },
    { method: "GET", path: "/api/jobs", description: "Fetch all jobs" },
    { method: "POST", path: "/api/jobs", description: "Execute job" },
    { method: "PATCH", path: "/api/jobs/[id]", description: "Cancel job" },
    { method: "DELETE", path: "/api/jobs/[id]", description: "Delete job" },
    { method: "GET", path: "/api/system/stats", description: "System statistics" },
  ]

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-green-500/10 text-green-700 border-green-500/20"
      case "POST":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20"
      case "PUT":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20"
      case "PATCH":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
      case "DELETE":
        return "bg-red-500/10 text-red-700 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20"
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-md border shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Code className="h-4 w-4 mr-2" />
            Debug Panel
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <Card className="w-96 max-h-96 bg-background/95 backdrop-blur-md border shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                API Debug Information
              </CardTitle>
              <CardDescription className="text-xs">Real-time API status and data</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Status Overview */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    <span>Servers: {servers.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Terminal className="h-3 w-3" />
                    <span>Jobs: {jobs.length}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span>Polling: {isPolling ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    <span>API: Connected</span>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {(serversError || jobsError) && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-destructive">Errors:</div>
                  {serversError && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      Servers: {serversError}
                    </div>
                  )}
                  {jobsError && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">Jobs: {jobsError}</div>
                  )}
                </div>
              )}

              {/* API Endpoints */}
              <div className="space-y-2">
                <div className="text-xs font-medium">API Endpoints:</div>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {apiEndpoints.map((endpoint, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={`text-xs px-1 py-0 ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </Badge>
                        <code className="text-xs font-mono">{endpoint.path}</code>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Stats */}
              {stats && (
                <div className="space-y-1">
                  <div className="text-xs font-medium">System Stats:</div>
                  <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                    <pre>{JSON.stringify(stats, null, 2)}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
