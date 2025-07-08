"use client";

import { TableCell } from "@/components/ui/table";

import { useState } from "react";
import { Terminal, Download, Filter, Search } from "lucide-react";
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
import { AnimatedJobRow } from "@/components/animated-job-row";
import type { Job } from "@/types";

interface JobMonitoringProps {
  jobs: Job[];
  onCancel: (jobId: string) => void;
}

export function JobMonitoring({ jobs, onCancel }: JobMonitoringProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
      ...filteredJobs.map((job) =>
        [
          job.id,
          job.serverName,
          `"${job.command}"`,
          job.status,
          job.created.toISOString(),
          job.duration.toString(),
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

  const getJobOutput = (job: Job) => {
    // Mock output for demonstration
    if (job.status === "running") {
      return `[INFO] Connecting to ${job.serverName}...
[INFO] Executing command: ${job.command}
[WARN] Command in progress...
[INFO] Output will appear here...`;
    }
    return `[SUCCESS] Connected to ${job.serverName}
[INFO] Executing: ${job.command}
[SUCCESS] Command completed successfully
[SUCCESS] Exit code: ${job.exitCode || 0}`;
  };

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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 transition-all duration-200 focus:scale-105"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            </Select>
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
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
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
                  filteredJobs.map((job) => (
                    <AnimatedJobRow
                      key={job.id}
                      job={job}
                      onView={setSelectedJob}
                      onCancel={onCancel}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Job Details
            </DialogTitle>
            <DialogDescription>
              {selectedJob?.id} on {selectedJob?.serverName}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="font-medium text-muted-foreground">
                    Status
                  </span>
                  <p className="capitalize">{selectedJob.status}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-medium text-muted-foreground">
                    Duration
                  </span>
                  <p className="font-mono">
                    {selectedJob.duration.toFixed(1)}s
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-medium text-muted-foreground">
                    Exit Code
                  </span>
                  <p className="font-mono">{selectedJob.exitCode ?? "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-medium text-muted-foreground">
                    Created
                  </span>
                  <p className="text-sm">
                    {selectedJob.created.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-medium text-muted-foreground">
                  Command
                </span>
                <code className="block p-3 bg-muted/50 rounded-lg text-sm font-mono border">
                  {selectedJob.command}
                </code>
              </div>

              <div className="space-y-2">
                <span className="font-medium text-muted-foreground">
                  Output
                </span>
                <ScrollArea className="h-64">
                  <div className="terminal p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {getJobOutput(selectedJob)}
                    </pre>
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
