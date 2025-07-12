"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StreamingOutputProps {
  stdout?: string;
  stderr?: string;
  error?: string;
  output?: string;
  isStreaming?: boolean;
  autoScroll?: boolean;
  className?: string;
  jobId?: string;
}

export function StreamingOutput({
  stdout,
  stderr,
  error,
  output,
  isStreaming = false,
  autoScroll = true,
  className = "",
  jobId,
}: StreamingOutputProps) {
  const [logs, setLogs] = useState<{
    stdout: string;
    stderr: string;
    error: string;
    output: string;
  }>({
    stdout: stdout || "",
    stderr: stderr || "",
    error: error || "",
    output: output || "",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll logs when streaming is active
  useEffect(() => {
    if (isStreaming && jobId) {
      const fetchLogs = async () => {
        try {
          const response = await fetch(
            `${
              process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
            }/api/v1/jobs/${jobId}/logs`
          );
          if (response.ok) {
            const data = await response.json();
            setLogs({
              stdout: data.stdout || "",
              stderr: data.stderr || "",
              error: data.error || "",
              output: data.output || "",
            });
          }
        } catch (err) {
          console.error("Failed to fetch logs:", err);
        }
      };

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
    } else {
      // Use static data when not streaming
      setLogs({
        stdout: stdout || "",
        stderr: stderr || "",
        error: error || "",
        output: output || "",
      });
    }
  }, [isStreaming, jobId, stdout, stderr, error, output]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Determine what content to show
  const displayContent =
    logs.output || logs.stdout || logs.stderr || logs.error || "";

  return (
    <ScrollArea ref={scrollRef} className={className}>
      <pre className="p-4 text-sm font-mono text-white whitespace-pre-wrap break-words break-all max-w-full overflow-hidden">
        {displayContent || (
          <span className="text-gray-500 italic">
            {isStreaming ? "Waiting for output..." : "No output available"}
          </span>
        )}
      </pre>
    </ScrollArea>
  );
}
