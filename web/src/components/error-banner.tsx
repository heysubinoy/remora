"use client";

import { AlertCircle } from "lucide-react";

interface ErrorBannerProps {
  serversError?: string | null;
  jobsError?: string | null;
}

export function ErrorBanner({ serversError, jobsError }: ErrorBannerProps) {
  if (!serversError && !jobsError) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="font-medium text-red-800">Connection Error</span>
      </div>
      {serversError && (
        <p className="text-red-700 mt-1">Servers: {serversError}</p>
      )}
      {jobsError && <p className="text-red-700 mt-1">Jobs: {jobsError}</p>}
    </div>
  );
}
