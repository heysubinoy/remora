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
import { formatDuration } from "@/hooks/use-live-duration";
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
}

export function JobMonitoring({
  jobs,
  pagination,
  filters,
  onCancel,
  onRerun,
  onDuplicate,
  onSearch,
  onFilter,
  onPageChange,
  onSort,
}: JobMonitoringProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(filters?.search || "");
  const [localStatusFilter, setLocalStatusFilter] = useState<string>(
    filters?.status || "all"
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        "Status",
        "Created",
        "Duration",
        "Exit Code",
      ].join(","),
      ...jobs.map((job) =>
        [
          job.id,
          job.serverName || "Unknown",
          `"${job.command}"`,
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
                    {jobs.filter((j) => j.status === "running").length} running
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
                  jobs.map((job) => (
                    <AnimatedJobRow
                      key={job.id}
                      job={job}
                      onView={setSelectedJob}
                      onCancel={onCancel}
                      onRerun={onRerun}
                      onDuplicate={onDuplicate}
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
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Job Details
            </DialogTitle>
            <DialogDescription>
              {selectedJob?.id} • {selectedJob?.serverName || "Unknown Server"}
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="flex-1 overflow-hidden space-y-4 flex flex-col">
              {/* Job Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm flex-shrink-0">
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
                        : selectedJob.status === "running"
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
                      {selectedJob.server.hostname}:{selectedJob.server.port}
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
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pr-4">
                    {/* Command Section */}
                    <div className="space-y-2">
                      <span className="font-medium text-muted-foreground">
                        Command
                      </span>
                      <div className="border rounded-lg bg-muted/50 h-32 overflow-hidden">
                        <ScrollArea className="h-full">
                          <code className="block p-3 text-sm font-mono break-all whitespace-pre-wrap">
                            {selectedJob.command}
                            {selectedJob.args && ` ${selectedJob.args}`}
                          </code>
                        </ScrollArea>
                      </div>
                    </div>

                    {/* Output Section */}
                    <div className="space-y-2">
                      <span className="font-medium text-muted-foreground">
                        Output
                      </span>
                      <div className="border rounded-lg overflow-hidden bg-black/90 h-[300px]">
                        <ScrollArea className="h-full">
                          <div className="p-4 space-y-2">
                            {/* Standard Output */}
                            {selectedJob.stdout && (
                              <div>
                                <div className="text-green-400 text-xs font-semibold mb-1">
                                  STDOUT:
                                </div>
                                <pre className="text-green-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                  {selectedJob.stdout}
                                </pre>
                              </div>
                            )}

                            {/* Standard Error */}
                            {selectedJob.stderr && (
                              <div>
                                <div className="text-red-400 text-xs font-semibold mb-1">
                                  STDERR:
                                </div>
                                <pre className="text-red-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                  {selectedJob.stderr}
                                </pre>
                              </div>
                            )}

                            {/* Error Messages */}
                            {selectedJob.error && (
                              <div>
                                <div className="text-orange-400 text-xs font-semibold mb-1">
                                  ERROR:
                                </div>
                                <pre className="text-orange-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                  {selectedJob.error}
                                </pre>
                              </div>
                            )}

                            {/* Fallback to general output */}
                            {!selectedJob.stdout &&
                              !selectedJob.stderr &&
                              selectedJob.output && (
                                <div>
                                  <div className="text-gray-400 text-xs font-semibold mb-1">
                                    OUTPUT:
                                  </div>
                                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                    {selectedJob.output}
                                  </pre>
                                </div>
                              )}

                            {/* No output available */}
                            {!selectedJob.stdout &&
                              !selectedJob.stderr &&
                              !selectedJob.error &&
                              !selectedJob.output && (
                                <div className="text-gray-500 text-sm italic text-center py-8">
                                  No output available
                                </div>
                              )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
