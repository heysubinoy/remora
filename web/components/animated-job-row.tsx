"use client";

import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  StopCircle,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLiveDuration, formatDuration } from "@/hooks/use-live-duration";
import type { Job } from "@/types";

interface AnimatedJobRowProps {
  job: Job;
  onView: (job: Job) => void;
  onCancel: (jobId: string) => void;
}

export const AnimatedJobRow = memo(function AnimatedJobRow({
  job,
  onView,
  onCancel,
}: AnimatedJobRowProps) {
  // Use the live duration hook for running jobs
  const liveDuration = useLiveDuration(job);

  const getStatusIcon = (status: Job["status"]) => {
    switch (status) {
      case "running":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
      case "canceled":
        return <StopCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Job["status"]) => {
    const config = {
      running: {
        variant: "default" as const,
        className:
          "bg-blue-500 hover:bg-blue-600 transition-colors duration-200",
      },
      completed: {
        variant: "default" as const,
        className:
          "bg-green-500 hover:bg-green-600 transition-colors duration-200",
      },
      failed: {
        variant: "destructive" as const,
        className: "transition-colors duration-200",
      },
      cancelled: {
        variant: "secondary" as const,
        className: "transition-colors duration-200",
      },
      canceled: {
        variant: "secondary" as const,
        className: "transition-colors duration-200",
      },
    };

    const { variant, className } = config[status];

    return (
      <Badge variant={variant} className={`capitalize ${className}`}>
        {status}
      </Badge>
    );
  };

  return (
    <TableRow
      key={job.id}
      className="transition-all duration-300 hover:bg-muted/50 animate-in fade-in-0 slide-in-from-right-1"
    >
      <TableCell className="font-mono text-sm font-medium">{job.id}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium transition-colors duration-200">
            {job.serverName}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-xs">
          <code className="text-sm bg-muted/50 px-2 py-1 rounded font-mono truncate block transition-colors duration-200">
            {job.command.length > 50
              ? `${job.command.substring(0, 50)}...`
              : job.command}
          </code>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 transition-all duration-300">
          <div className="transition-transform duration-200 hover:scale-110">
            {getStatusIcon(job.status)}
          </div>
          {getStatusBadge(job.status)}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="flex flex-col">
          <span className="transition-colors duration-200">
            {job.created
              ? formatDistanceToNow(job.created, { addSuffix: true })
              : "Unknown"}
          </span>
          <span className="text-xs opacity-70">
            {job.created ? job.created.toLocaleString() : "N/A"}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {job.status === "running" ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-blue-500 transition-colors duration-200">
              {formatDuration(liveDuration)}
            </span>
          </div>
        ) : (
          <span className="transition-colors duration-200">
            {formatDuration(liveDuration)}
          </span>
        )}
      </TableCell>
      <TableCell>
        {job.exitCode !== null ? (
          <Badge
            variant={job.exitCode === 0 ? "default" : "destructive"}
            className="font-mono transition-colors duration-200"
          >
            {job.exitCode}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(job)}
            className="transition-all duration-200 hover:scale-105"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {job.status === "running" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(job.id)}
              className="transition-all duration-200 hover:scale-105 hover:text-orange-500"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
