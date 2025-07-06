"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  Eye,
  Square,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Job as APIJob, formatDuration, formatTimestamp } from "@/lib/api";
import { useJobs } from "@/hooks/use-api";

interface JobListProps {
  onViewJob: (job: APIJob) => void;
}

export function JobList({ onViewJob }: JobListProps) {
  const { jobs, loading, submitJob, cancelJob } = useJobs();
  const getStatusBadge = (status: string) => {
    const variants = {
      queued: "bg-blue-100 text-blue-800 border-blue-200",
      running: "bg-yellow-100 text-yellow-800 border-yellow-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      canceled: "bg-gray-100 text-gray-800 border-gray-200",
    };

    const icons = {
      queued: <Clock className="w-3 h-3" />,
      running: <Loader2 className="w-3 h-3 animate-spin" />,
      completed: <CheckCircle className="w-3 h-3" />,
      failed: <XCircle className="w-3 h-3" />,
      canceled: <AlertCircle className="w-3 h-3" />,
    };

    return (
      <Badge
        className={`${
          variants[status as keyof typeof variants]
        } flex items-center gap-1`}
      >
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Jobs
        </CardTitle>
        <CardDescription>View and manage job execution history</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading jobs...</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Exit Code</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-gray-500 py-8"
                  >
                    No jobs found. Submit your first job above.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      {job.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {job.server?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {job.server?.hostname}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">
                        <div className="font-medium">{job.command}</div>
                        {job.args && (
                          <div className="text-gray-500 text-xs">
                            {job.args}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-sm">
                      {formatTimestamp(job.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.duration ? formatDuration(job.duration) : "-"}
                    </TableCell>
                    <TableCell>
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
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewJob(job)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(job.status === "running" ||
                          job.status === "queued") && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Square className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Job</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to cancel this job? This
                                  action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelJob(job.id)}
                                >
                                  Yes, Cancel Job
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
