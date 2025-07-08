import { useMemo } from "react";
import type { Job } from "@/types";

/**
 * Hook to determine if a job should be streamed based on its status
 */
export const useJobStreamingStatus = (jobs: Job[]) => {
  const streamableJobs = useMemo(() => {
    return jobs.filter(job => 
      job.status === "running" || job.status === "queued"
    );
  }, [jobs]);

  const hasStreamingJobs = streamableJobs.length > 0;
  const streamingJobIds = useMemo(() => 
    new Set(streamableJobs.map(job => job.id)), 
    [streamableJobs]
  );

  return {
    streamableJobs,
    hasStreamingJobs,
    streamingJobIds,
    runningCount: jobs.filter(job => job.status === "running").length,
    queuedCount: jobs.filter(job => job.status === "queued").length,
  };
};
