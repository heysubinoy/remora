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
  RotateCcw,
  Copy,
  Wifi,
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
  onRerun?: (jobId: string) => void;
  onDuplicate?: (job: Job) => void;
  isStreaming?: boolean;
}

export const AnimatedJobRow = memo(function AnimatedJobRow({
  job,
  onView,
  onCancel,
  onRerun,
  onDuplicate,
  isStreaming = false,
}: AnimatedJobRowProps) {
  // Use the live duration hook for running jobs
  const liveDuration = useLiveDuration(job);

  const getStatusIcon = (status: Job["status"]) => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4 text-yellow-500" />;
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
      queued: {
        variant: "secondary" as const,
        className:
          "bg-yellow-500 hover:bg-yellow-600 transition-colors duration-200",
      },
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

  const getPriorityBadge = (priority: number) => {
    const config = {
      1: {
        variant: "secondary" as const,
        className: "bg-gray-500",
        label: "Lowest",
      },
      2: {
        variant: "secondary" as const,
        className: "bg-gray-600",
        label: "Very Low",
      },
      3: {
        variant: "secondary" as const,
        className: "bg-blue-500",
        label: "Low",
      },
      4: {
        variant: "secondary" as const,
        className: "bg-blue-600",
        label: "Below Normal",
      },
      5: {
        variant: "default" as const,
        className: "bg-slate-500",
        label: "Normal",
      },
      6: {
        variant: "default" as const,
        className: "bg-yellow-500",
        label: "Above Normal",
      },
      7: {
        variant: "default" as const,
        className: "bg-orange-500",
        label: "High",
      },
      8: {
        variant: "default" as const,
        className: "bg-orange-600",
        label: "Very High",
      },
      9: {
        variant: "destructive" as const,
        className: "bg-red-500",
        label: "Critical",
      },
      10: {
        variant: "destructive" as const,
        className: "bg-red-600",
        label: "Highest",
      },
    };

    const { variant, className, label } =
      config[priority as keyof typeof config] || config[5];

    return (
      <Badge
        variant={variant}
        className={`font-mono text-xs ${className}`}
        title={label}
      >
        {priority}
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
            {(() => {
              const displayText = job.original_script || job.command;
              return displayText.length > 50
                ? `${displayText.substring(0, 50)}...`
                : displayText;
            })()}
          </code>
        </div>
      </TableCell>
      <TableCell>{getPriorityBadge(job.priority || 5)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 transition-all duration-300">
          <div className="transition-transform duration-200 hover:scale-110">
            {getStatusIcon(job.status)}
          </div>
          {getStatusBadge(job.status)}
          {isStreaming && (
            <div className="flex items-center gap-1" title="Live updates">
              <Wifi className="h-3 w-3 text-green-500" />
              <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
            </div>
          )}
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
            {job.created ? (
              <>
                <span title="UTC Time">{job.created.toUTCString()}</span>
                <br />
                <span title="Local Time">{job.created.toLocaleString()}</span>
              </>
            ) : (
              "N/A"
            )}
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

          {onDuplicate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(job)}
              className="transition-all duration-200 hover:scale-105 hover:text-purple-500"
              title="Duplicate job to Execute tab"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}

          {onRerun &&
            (job.status === "completed" ||
              job.status === "failed" ||
              job.status === "cancelled" ||
              job.status === "canceled") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRerun(job.id)}
                className="transition-all duration-200 hover:scale-105 hover:text-blue-500"
                title="Rerun job"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}

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
