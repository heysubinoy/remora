"use client";

import { TableCell } from "@/components/ui/table";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Terminal,
  Download,
  Filter,
  Search,
  Server,
  Clock,
  LogOut,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AnimatedJobRow } from "@/components/animated-job-row";
import { StreamingOutput } from "@/components/streaming-output";
import { LiveJobStatus } from "@/components/live-job-status";
import { formatDuration } from "@/hooks/use-live-duration";
import { useJobMonitoringStream } from "@/hooks/use-job-monitoring-stream";
import type { Job } from "@/types";

interface JobMonitoringProps {
  jobs: Job[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  filters?: {
    status?: string;
    server_id?: string;
    search?: string;
    sort_by: string;
    sort_order: string;
  };
  onCancel: (jobId: string) => void;
  onRerun?: (jobId: string) => void;
  onDuplicate?: (job: Job) => void;
  onSearch?: (search: string) => void;
  onFilter?: (key: string, value: string) => void;
  onPageChange?: (page: number) => void;
  onSort?: (sort_by: string, sort_order: "asc" | "desc") => void;
  onJobUpdate?: (job: Job) => void;
  onJobComplete?: (job: Job) => void;
}

export function JobMonitoring({
  jobs: initialJobs,
  pagination,
  filters,
  onCancel,
  onRerun,
  onDuplicate,
  onSearch,
  onFilter,
  onPageChange,
  onSort,
  onJobUpdate,
  onJobComplete,
}: JobMonitoringProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(filters?.search || "");
  const [localStatusFilter, setLocalStatusFilter] = useState<string>(
    filters?.status || "all"
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the streaming hook for live updates
  const { jobs, streamingJobs, startJobStream, stopJobStream, updateJobs } =
    useJobMonitoringStream(initialJobs, onJobUpdate, onJobComplete);

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);

    // Only call onSearch if it exists (server-side search)
    if (onSearch) {
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout
      searchTimeoutRef.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    }
  };

  const handleViewJob = (job: Job) => {
    setSelectedJob(job);
    // Start streaming for this job if it's running
    if (job.status === "running") {
      startJobStream(job.id);
    }
  };

  const handleCloseModal = () => {
    if (selectedJob) {
      // Stop streaming for this job
      stopJobStream(selectedJob.id);
    }
    setSelectedJob(null);
  };
  // useEffect(() => {
  //   if (onFilter) {
  //     onFilter("status", localStatusFilter === "all" ? "" : localStatusFilter);
  //   }
  // }, [localStatusFilter]);
  // // Handle status filter change with minimal debouncing
  // const handleStatusFilterChange = (value: string) => {
  //   setLocalStatusFilter(value);
  // };

  const exportJobs = () => {
    const csv = [
      [
        "Job ID",
        "Server",
        "Command",
        "Priority",
        "Status",
        "Created",
        "Duration",
        "Exit Code",
      ].join(","),
      ...jobs.map((job: Job) =>
        [
          job.id,
          job.serverName || "Unknown",
          `"${job.original_script || job.command}"`,
          job.priority || 5,
          job.status,
          job.created ? job.created.toISOString() : "",
          formatDuration(job.duration),
          job.exitCode?.toString() || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-update selected job when jobs change
  useEffect(() => {
    if (selectedJob) {
      const updatedJob = jobs.find((job: Job) => job.id === selectedJob.id);
      if (updatedJob) {
        setSelectedJob(updatedJob);
      }
    }
  }, [jobs, selectedJob]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card className="glass border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 transition-colors duration-200">
                <Terminal className="h-5 w-5 text-green-500" />
                Job Monitoring
              </CardTitle>
              <CardDescription className="transition-colors duration-200">
                Track the status and progress of your script executions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportJobs}
                className="transition-all duration-200 hover:scale-105 bg-transparent"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="transition-colors duration-200">
                    {jobs.filter((j: Job) => j.status === "running").length}{" "}
                    running
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  {streamingJobs.size > 0 ? (
                    <Wifi className="h-3 w-3 text-green-500" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="transition-colors duration-200">
                    {streamingJobs.size} streaming
                  </span>
                </div>
                <span>•</span>
                <span className="transition-colors duration-200">
                  {jobs.length} total
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={localSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 transition-all duration-200 focus:scale-105"
              />
            </div>
            {/* <Select
              value={localStatusFilter}
              onValueChange={(val) => {
                setLocalStatusFilter(val);
              }}
            >
              <SelectTrigger className="w-40 transition-all duration-200 hover:scale-105">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select> */}
          </div>

          {/* Jobs Table */}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Job ID</TableHead>
                  <TableHead className="font-semibold">Server</TableHead>
                  <TableHead className="font-semibold">Command</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">Duration</TableHead>
                  <TableHead className="font-semibold">Exit Code</TableHead>
                  <TableHead className="text-right font-semibold">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Terminal className="h-8 w-8 opacity-50" />
                        <p>No jobs found</p>
                        <p className="text-sm">
                          Execute a script to see jobs here
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  initialJobs.map((job: Job) => (
                    <AnimatedJobRow
                      key={job.id}
                      job={job}
                      onView={handleViewJob}
                      onCancel={onCancel}
                      onRerun={onRerun}
                      onDuplicate={onDuplicate}
                      isStreaming={streamingJobs.has(job.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {pagination && onPageChange && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={!pagination.has_prev}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, pagination.total_pages) },
                    (_, i) => {
                      const page = Math.max(1, pagination.page - 2) + i;
                      if (page > pagination.total_pages) return null;
                      return (
                        <Button
                          key={page}
                          variant={
                            page === pagination.page ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => onPageChange(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      );
                    }
                  )}
                  {pagination.total_pages > 5 &&
                    pagination.page < pagination.total_pages - 2 && (
                      <>
                        <span className="text-muted-foreground">...</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPageChange(pagination.total_pages)}
                          className="w-8 h-8 p-0"
                        >
                          {pagination.total_pages}
                        </Button>
                      </>
                    )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={!pagination.has_next}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col max-h-[90vh] w-[95vw]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 truncate">
              <Terminal className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Job Details</span>
            </DialogTitle>
            <DialogDescription className="truncate">
              {selectedJob?.id} • {selectedJob?.serverName || "Unknown Server"}
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="flex-1 overflow-hidden space-y-4 flex flex-col min-w-0">
              {/* Use LiveJobStatus for running jobs, normal details for others */}
              {selectedJob.status === ("running" as any) ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                    <LiveJobStatus
                      jobId={selectedJob.id}
                      serverName={selectedJob.serverName || "Unknown"}
                      serverId={selectedJob.server_id}
                      className="pr-4"
                    />
                  </ScrollArea>
                </div>
              ) : (
                <>
                  {/* Job Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm flex-shrink-0 min-w-0">
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Terminal className="h-3 w-3" />
                        Status
                      </span>
                      <Badge
                        variant={
                          selectedJob.status === "completed"
                            ? "default"
                            : selectedJob.status === "failed"
                            ? "destructive"
                            : selectedJob.status === ("running" as any)
                            ? "default"
                            : "secondary"
                        }
                        className="capitalize"
                      >
                        {selectedJob.status}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Priority
                      </span>
                      <Badge
                        variant={
                          selectedJob.priority >= 8
                            ? "destructive"
                            : selectedJob.priority >= 6
                            ? "default"
                            : "secondary"
                        }
                        className="font-mono"
                      >
                        {selectedJob.priority || 5}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Duration
                      </span>
                      <p className="font-mono">
                        {formatDuration(selectedJob.duration)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <LogOut className="h-3 w-3" />
                        Exit Code
                      </span>
                      <p className="font-mono">
                        {selectedJob.exitCode !== null
                          ? selectedJob.exitCode
                          : "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Timeout
                      </span>
                      <p className="font-mono">
                        {selectedJob.timeout
                          ? `${selectedJob.timeout}s`
                          : "No timeout"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground">
                        Created
                      </span>
                      <p className="text-sm">
                        {selectedJob.created
                          ? selectedJob.created.toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Server Details */}
                  {selectedJob.server && (
                    <div className="space-y-2 flex-shrink-0">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        Server Details
                      </span>
                      <div className="grid grid-cols-3 gap-4 p-3 bg-muted/20 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">Name:</span>{" "}
                          {selectedJob.server.name}
                        </div>
                        <div>
                          <span className="font-medium">Host:</span>{" "}
                          {selectedJob.server.hostname}:
                          {selectedJob.server.port}
                        </div>
                        <div>
                          <span className="font-medium">User:</span>{" "}
                          {selectedJob.server.user ||
                            selectedJob.server.username ||
                            "N/A"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scrollable Content Section - Everything after Server Details */}
                  <div className="flex-1 min-h-0 overflow-hidden min-w-0">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-4 pr-4 min-w-0">
                        {/* Command Section */}
                        <div className="space-y-2">
                          <span className="font-medium text-muted-foreground">
                            {selectedJob.original_script
                              ? "Script Content"
                              : "Command"}
                          </span>
                          <div className="border rounded-lg bg-muted/50 h-32 overflow-hidden w-full">
                            <ScrollArea className="h-full w-full">
                              <code className="block p-3 text-sm font-mono break-all whitespace-pre-wrap max-w-full overflow-hidden">
                                {selectedJob.original_script || (
                                  <>
                                    {selectedJob.command}
                                    {selectedJob.args && ` ${selectedJob.args}`}
                                  </>
                                )}
                              </code>
                            </ScrollArea>
                          </div>
                          {selectedJob.original_script && selectedJob.args && (
                            <div className="space-y-1">
                              <span className="font-medium text-muted-foreground text-xs">
                                Script Arguments
                              </span>
                              <div className="border rounded-lg bg-muted/50 p-2 w-full overflow-hidden">
                                <code className="text-xs font-mono break-all whitespace-pre-wrap max-w-full overflow-hidden">
                                  {selectedJob.args}
                                </code>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Output Section with Tabs */}
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-muted-foreground">
                              Output
                            </span>
                            {streamingJobs.has(selectedJob.id) && (
                              <div className="flex items-center gap-1 text-xs text-green-500 flex-shrink-0">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                Live Updates
                              </div>
                            )}
                          </div>

                          <Tabs defaultValue="combined" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 h-10 max-w-full">
                              <TabsTrigger
                                value="combined"
                                className="text-xs font-medium min-w-0 overflow-hidden"
                              >
                                <span className="flex items-center gap-1 truncate">
                                  Combined
                                  {streamingJobs.has(selectedJob.id) && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                                  )}
                                </span>
                              </TabsTrigger>
                              <TabsTrigger
                                value="stdout"
                                className="text-xs font-medium min-w-0 overflow-hidden"
                              >
                                <span className="flex items-center gap-1 truncate">
                                  STDOUT
                                  {(selectedJob.stdout &&
                                    selectedJob.stdout.trim()) ||
                                  streamingJobs.has(selectedJob.id) ? (
                                    <span className="ml-1 text-xs bg-green-500/20 text-green-600 px-1 rounded flex-shrink-0">
                                      {selectedJob.stdout
                                        ? selectedJob.stdout
                                            .split("\n")
                                            .filter((line) => line.trim())
                                            .length
                                        : streamingJobs.has(selectedJob.id)
                                        ? "∞"
                                        : "0"}
                                    </span>
                                  ) : null}
                                </span>
                              </TabsTrigger>
                              <TabsTrigger
                                value="stderr"
                                className="text-xs font-medium min-w-0 overflow-hidden"
                              >
                                <span className="flex items-center gap-1 truncate">
                                  STDERR
                                  {(selectedJob.stderr &&
                                    selectedJob.stderr.trim()) ||
                                  streamingJobs.has(selectedJob.id) ? (
                                    <span className="ml-1 text-xs bg-orange-500/20 text-orange-600 px-1 rounded flex-shrink-0">
                                      {selectedJob.stderr
                                        ? selectedJob.stderr
                                            .split("\n")
                                            .filter((line) => line.trim())
                                            .length
                                        : streamingJobs.has(selectedJob.id)
                                        ? "∞"
                                        : "0"}
                                    </span>
                                  ) : null}
                                </span>
                              </TabsTrigger>
                              <TabsTrigger
                                value="error"
                                className="text-xs font-medium min-w-0 overflow-hidden"
                              >
                                <span className="flex items-center gap-1 truncate">
                                  ERROR
                                  {(selectedJob.error &&
                                    selectedJob.error.trim()) ||
                                  streamingJobs.has(selectedJob.id) ? (
                                    <span className="ml-1 text-xs bg-red-500/20 text-red-600 px-1 rounded flex-shrink-0">
                                      {selectedJob.error
                                        ? selectedJob.error
                                            .split("\n")
                                            .filter((line) => line.trim())
                                            .length
                                        : streamingJobs.has(selectedJob.id)
                                        ? "∞"
                                        : "0"}
                                    </span>
                                  ) : null}
                                </span>
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="combined" className="mt-2">
                              <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
                                <StreamingOutput
                                  stdout={selectedJob.stdout}
                                  stderr={selectedJob.stderr}
                                  error={selectedJob.error}
                                  output={selectedJob.output}
                                  isStreaming={streamingJobs.has(
                                    selectedJob.id
                                  )}
                                  autoScroll={true}
                                  className="h-[300px] w-full"
                                  jobId={selectedJob.id}
                                />
                              </div>
                            </TabsContent>

                            <TabsContent value="stdout" className="mt-2">
                              <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
                                {streamingJobs.has(selectedJob.id) ? (
                                  <StreamingOutput
                                    stdout={selectedJob.stdout}
                                    isStreaming={true}
                                    autoScroll={true}
                                    className="h-[300px] w-full"
                                    jobId={selectedJob.id}
                                  />
                                ) : (
                                  <ScrollArea className="h-full w-full">
                                    <pre className="p-4 text-sm font-mono text-green-400 whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                                      {selectedJob.stdout || (
                                        <span className="text-gray-500 italic">
                                          No stdout output
                                          {selectedJob.status === "running"
                                            ? " yet..."
                                            : ""}
                                        </span>
                                      )}
                                    </pre>
                                  </ScrollArea>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent value="stderr" className="mt-2">
                              <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
                                {streamingJobs.has(selectedJob.id) ? (
                                  <StreamingOutput
                                    stderr={selectedJob.stderr}
                                    isStreaming={true}
                                    autoScroll={true}
                                    className="h-[300px] w-full"
                                    jobId={selectedJob.id}
                                  />
                                ) : (
                                  <ScrollArea className="h-full w-full">
                                    <pre className="p-4 text-sm font-mono text-orange-400 whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                                      {selectedJob.stderr || (
                                        <span className="text-gray-500 italic">
                                          No stderr output
                                          {selectedJob.status === "running"
                                            ? " yet..."
                                            : ""}
                                        </span>
                                      )}
                                    </pre>
                                  </ScrollArea>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent value="error" className="mt-2">
                              <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px] w-full">
                                {streamingJobs.has(selectedJob.id) ? (
                                  <StreamingOutput
                                    error={selectedJob.error}
                                    isStreaming={true}
                                    autoScroll={true}
                                    className="h-[300px] w-full"
                                    jobId={selectedJob.id}
                                  />
                                ) : (
                                  <ScrollArea className="h-full w-full">
                                    <pre className="p-4 text-sm font-mono text-red-400 whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
                                      {selectedJob.error || (
                                        <span className="text-gray-500 italic">
                                          No error output
                                          {selectedJob.status === "running"
                                            ? " yet..."
                                            : ""}
                                        </span>
                                      )}
                                    </pre>
                                  </ScrollArea>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
