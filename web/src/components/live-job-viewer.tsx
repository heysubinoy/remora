"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Square,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useLiveJob } from "@/hooks/use-live-job";
import { LiveOutputViewer } from "@/components/live-output-viewer";
import { formatTimestamp, formatDuration } from "@/lib/api";

interface LiveJobViewerProps {
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LiveJobViewer({ jobId, isOpen, onClose }: LiveJobViewerProps) {
  const { job, logs, isConnected, error, loading, refetch, cancelJob } =
    useLiveJob(jobId);

  const stdoutRef = useRef<HTMLDivElement>(null);
  const stderrRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (stdoutRef.current) {
      stdoutRef.current.scrollTop = stdoutRef.current.scrollHeight;
    }
  }, [logs.stdout]);

  useEffect(() => {
    if (stderrRef.current) {
      stderrRef.current.scrollTop = stderrRef.current.scrollHeight;
    }
  }, [logs.stderr]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <Clock className="w-4 h-4" />;
      case "running":
        return <Play className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "failed":
        return <XCircle className="w-4 h-4" />;
      case "canceled":
        return <Square className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued":
        return "bg-yellow-100 text-yellow-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "canceled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleCancel = async () => {
    await cancelJob();
  };

  if (!isOpen || !jobId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Live Job Monitor
            {job && (
              <Badge
                className={`${getStatusColor(
                  job.status
                )} flex items-center gap-1`}
              >
                {getStatusIcon(job.status)}
                {job.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            {job && (
              <>
                <span>
                  Command: {job.command} {job.args}
                </span>
                <span className="flex items-center gap-1">
                  {isConnected ? (
                    <>
                      <Wifi className="w-3 h-3 text-green-500" />
                      <span className="text-green-600 text-xs">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-500 text-xs">Offline</span>
                    </>
                  )}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && !job ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2">Loading job details...</span>
          </div>
        ) : error && !job ? (
          <div className="flex items-center justify-center h-64 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : job ? (
          <div className="flex-1 flex flex-col gap-4">
            {/* Job Status Bar */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(job.status)}>
                      {getStatusIcon(job.status)}
                      {job.status}
                    </Badge>
                    {job.status === "running" && isConnected && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Duration</Label>
                  <p className="text-sm font-mono">
                    {job.duration ? formatDuration(job.duration) : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Exit Code</Label>
                  <div className="text-sm">
                    {job.exit_code !== null ? (
                      <Badge
                        className={
                          job.exit_code === 0
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {job.exit_code}
                      </Badge>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetch}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                {(job.status === "running" || job.status === "queued") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancel}
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Live Logs */}
            <Tabs defaultValue={job.status === "running" || job.status === "queued" ? "live" : "stdout"} className="flex-1 flex flex-col">
              <TabsList className={`grid w-full ${job.status === "running" || job.status === "queued" ? "grid-cols-4" : "grid-cols-3"}`}>
                {(job.status === "running" || job.status === "queued") && (
                  <TabsTrigger value="live" className="flex items-center gap-2">
                    Live Output
                    {isConnected && (
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger value="stdout" className="flex items-center gap-2">
                  Output
                  {logs.stdout && (
                    <Badge variant="secondary" className="text-xs">
                      {logs.stdout.split("\\n").length - 1} lines
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="stderr" className="flex items-center gap-2">
                  Errors
                  {logs.stderr && (
                    <Badge variant="secondary" className="text-xs">
                      {logs.stderr.split("\\n").length - 1} lines
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
              </TabsList>

              {/* Live Output Tab - Only for running/queued jobs */}
              {(job.status === "running" || job.status === "queued") && (
                <TabsContent value="live" className="flex-1">
                  <LiveOutputViewer 
                    job={job}
                    logs={logs}
                    isConnected={isConnected}
                    onCancel={cancelJob}
                  />
                </TabsContent>
              )}

              <TabsContent value="stdout" className="flex-1">
                <div className="h-full bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm relative">
                  {isConnected && job.status === "running" && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-green-500/20 px-2 py-1 rounded">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      Live
                    </div>
                  )}
                  <ScrollArea className="h-full" ref={stdoutRef}>
                    {logs.stdout ? (
                      <pre className="whitespace-pre-wrap">
                        {logs.stdout}
                        {job.status === "running" && (
                          <span className="text-green-300 animate-pulse">
                            _
                          </span>
                        )}
                      </pre>
                    ) : (
                      <div className="text-gray-500 italic">
                        {job.status === "running"
                          ? "Waiting for output..."
                          : "No stdout output"}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="stderr" className="flex-1">
                <div className="h-full bg-gray-900 text-red-400 p-4 rounded-lg font-mono text-sm relative">
                  {isConnected && job.status === "running" && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-red-500/20 px-2 py-1 rounded">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      Live
                    </div>
                  )}
                  <ScrollArea className="h-full" ref={stderrRef}>
                    {logs.stderr ? (
                      <pre className="whitespace-pre-wrap">
                        {logs.stderr}
                        {job.status === "running" && (
                          <span className="text-red-300 animate-pulse">_</span>
                        )}
                      </pre>
                    ) : (
                      <div className="text-gray-500 italic">
                        {job.status === "running"
                          ? "Waiting for errors..."
                          : "No stderr output"}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="info" className="flex-1">
                <div className="h-full overflow-auto">
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Job ID</Label>
                        <p className="text-sm font-mono">{job.id}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Server</Label>
                        <p className="text-sm">
                          {job.server
                            ? `${job.server.name} (${job.server.hostname})`
                            : "Unknown"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Created</Label>
                        <p className="text-sm">
                          {formatTimestamp(job.created_at)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Started</Label>
                        <p className="text-sm">
                          {formatTimestamp(job.started_at)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Finished
                        </Label>
                        <p className="text-sm">
                          {formatTimestamp(job.finished_at)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Timeout</Label>
                        <p className="text-sm">{job.timeout}s</p>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                        <div className="flex items-center gap-2 text-red-800">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">Connection Error</span>
                        </div>
                        <p className="text-sm text-red-600 mt-1">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-xs text-gray-500">
                {isConnected ? (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Live updates active
                  </span>
                ) : (
                  <span>Live updates unavailable</span>
                )}
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">No job selected</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
