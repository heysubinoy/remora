"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, Clock, Zap, LogOut } from "lucide-react";
import { formatDuration } from "@/hooks/use-live-duration";

interface LiveJobLogs {
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
}

interface LiveJobStatusProps {
  jobId: string;
  serverName: string;
  serverId: string;
  className?: string;
}

export function LiveJobStatus({
  jobId,
  serverName,
  serverId,
  className = "",
}: LiveJobStatusProps) {
  const [logs, setLogs] = useState<LiveJobLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
        }/api/v1/jobs/${jobId}/logs`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data: LiveJobLogs = await response.json();
      setLogs(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      setLoading(false);
      console.error("Error fetching job logs:", err);
    }
  };

  // Start polling when component mounts
  useEffect(() => {
    // Fetch immediately
    fetchLogs();

    // Then poll every 2 seconds
    intervalRef.current = setInterval(fetchLogs, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  // Stop polling when job is completed
  useEffect(() => {
    if (
      logs &&
      (logs.status === "completed" ||
        logs.status === "failed" ||
        logs.status === "canceled")
    ) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [logs?.status]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Loading live status...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
      >
        <p className="text-red-800 text-sm">
          Error loading live status: {error}
        </p>
      </div>
    );
  }

  if (!logs) {
    return (
      <div
        className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}
      >
        <p className="text-yellow-800 text-sm">No live data available</p>
      </div>
    );
  }

  // Calculate duration
  const duration = logs.duration ? parseInt(logs.duration) / 1000000 : 0; // Convert nanoseconds to milliseconds

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Live Status Header */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-sm font-medium text-blue-800">
          Live Status (2s polling)
        </span>
      </div>

      {/* Job Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Status
          </span>
          <Badge
            variant={
              logs.status === "completed"
                ? "default"
                : logs.status === "failed"
                ? "destructive"
                : logs.status === "running"
                ? "default"
                : "secondary"
            }
            className="capitalize"
          >
            {logs.status}
          </Badge>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Priority
          </span>
          <Badge
            variant={
              logs.priority >= 8
                ? "destructive"
                : logs.priority >= 6
                ? "default"
                : "secondary"
            }
            className="font-mono"
          >
            5
          </Badge>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Duration
          </span>
          <p className="font-mono">{formatDuration(duration)}</p>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <LogOut className="h-3 w-3" />
            Exit Code
          </span>
          <p className="font-mono">
            {logs.exit_code !== null && logs.exit_code !== undefined
              ? logs.exit_code
              : "N/A"}
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Timeout
          </span>
          <p className="font-mono">
            {logs.timeout ? `${logs.timeout}s` : "No timeout"}
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground">Created</span>
          <p className="text-sm">
            {logs.created_at
              ? new Date(logs.created_at).toLocaleString()
              : "Unknown"}
          </p>
        </div>
      </div>

      {/* Server Details */}
      <div className="space-y-2">
        <span className="font-medium text-muted-foreground flex items-center gap-1">
          <Server className="h-3 w-3" />
          Server Details
        </span>
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/20 rounded-lg text-sm">
          <div>
            <span className="font-medium">Name:</span> {serverName}
          </div>
          <div>
            <span className="font-medium">ID:</span> {serverId}
          </div>
          <div>
            <span className="font-medium">Status:</span> Live
          </div>
        </div>
      </div>

      {/* Command Section */}
      <div className="space-y-2">
        <span className="font-medium text-muted-foreground">Command</span>
        <div className="border rounded-lg bg-muted/50 h-32 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <code className="block p-3 text-sm font-mono break-all whitespace-pre-wrap max-w-full overflow-hidden">
              {logs.command}
              {logs.args && ` ${logs.args}`}
            </code>
          </ScrollArea>
        </div>
      </div>

      {/* Output Section with Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">Live Output</span>
          {logs.status === "running" && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live Updates
            </div>
          )}
        </div>

        <Tabs defaultValue="combined" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-10">
            <TabsTrigger value="combined" className="text-xs font-medium">
              <span className="flex items-center gap-1 truncate">
                Combined
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
              </span>
            </TabsTrigger>
            <TabsTrigger value="stdout" className="text-xs font-medium">
              <span className="flex items-center gap-1 truncate">
                STDOUT
                {logs.stdout && logs.stdout.trim() ? (
                  <span className="ml-1 text-xs bg-green-500/20 text-green-600 px-1 rounded flex-shrink-0">
                    {
                      logs.stdout.split("\n").filter((line) => line.trim())
                        .length
                    }
                  </span>
                ) : null}
              </span>
            </TabsTrigger>
            <TabsTrigger value="stderr" className="text-xs font-medium">
              <span className="flex items-center gap-1 truncate">
                STDERR
                {logs.stderr && logs.stderr.trim() ? (
                  <span className="ml-1 text-xs bg-orange-500/20 text-orange-600 px-1 rounded flex-shrink-0">
                    {
                      logs.stderr.split("\n").filter((line) => line.trim())
                        .length
                    }
                  </span>
                ) : null}
              </span>
            </TabsTrigger>
            <TabsTrigger value="error" className="text-xs font-medium">
              <span className="flex items-center gap-1 truncate">
                ERROR
                {logs.error && logs.error.trim() ? (
                  <span className="ml-1 text-xs bg-red-500/20 text-red-600 px-1 rounded flex-shrink-0">
                    {
                      logs.error.split("\n").filter((line) => line.trim())
                        .length
                    }
                  </span>
                ) : null}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="combined" className="mt-2">
            <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
              <ScrollArea className="h-full w-full">
                <pre className="p-4 text-sm font-mono text-white whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                  {logs.output || logs.stdout || logs.stderr || logs.error || (
                    <span className="text-gray-500 italic">
                      No output available
                      {logs.status === "running" ? " yet..." : ""}
                    </span>
                  )}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="stdout" className="mt-2">
            <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
              <ScrollArea className="h-full w-full">
                <pre className="p-4 text-sm font-mono text-green-400 whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                  {logs.stdout || (
                    <span className="text-gray-500 italic">
                      No stdout output
                      {logs.status === "running" ? " yet..." : ""}
                    </span>
                  )}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="stderr" className="mt-2">
            <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
              <ScrollArea className="h-full w-full">
                <pre className="p-4 text-sm font-mono text-orange-400 whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                  {logs.stderr || (
                    <span className="text-gray-500 italic">
                      No stderr output
                      {logs.status === "running" ? " yet..." : ""}
                    </span>
                  )}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="error" className="mt-2">
            <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
              <ScrollArea className="h-full w-full">
                <pre className="p-4 text-sm font-mono text-red-400 whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                  {logs.error || (
                    <span className="text-gray-500 italic">
                      No error output
                      {logs.status === "running" ? " yet..." : ""}
                    </span>
                  )}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
