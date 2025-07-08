import { useEffect, useRef, useState } from "react";

interface OutputEvent {
  job_id: string;
  output: string;
  is_stderr: boolean;
  line_count: number;
  timestamp: string;
}

interface JobStatus {
  id: string;
  status: string;
  command: string;
  args: string;
  started_at?: string;
  finished_at?: string;
  duration?: string;
}

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export const useJobStream = (jobId: string | null) => {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const url = `${BACKEND_BASE_URL}/api/jobs/${jobId}/stream`;
    const source = new EventSource(url, { withCredentials: true });
    sourceRef.current = source;

    source.addEventListener("status", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setStatus(data);
    });

    source.addEventListener("output", (e) => {
      const data: OutputEvent = JSON.parse((e as MessageEvent).data);
      if (data.is_stderr) {
        setErrors((prev) => [...prev, data.output]);
      } else {
        setLogs((prev) => [...prev, data.output]);
      }
    });

    source.addEventListener("complete", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setStatus(data);
      setIsComplete(true);
      source.close();
    });

    source.addEventListener("error", (e) => {
      console.error("SSE error", e);
      source.close();
    });

    return () => {
      source.close();
    };
  }, [jobId]);

  return { status, logs, errors, isComplete };
};
