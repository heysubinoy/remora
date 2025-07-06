"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Wifi, WifiOff, RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  isHealthy: boolean | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export function DashboardHeader({
  isHealthy,
  onRefresh,
  isLoading,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Job Execution Dashboard
        </h1>
        <p className="text-gray-600">
          Manage remote job execution across your servers
        </p>
      </div>
      <div className="flex items-center gap-4">
        {/* Health Status */}
        <div className="flex items-center gap-2">
          {isHealthy === null ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : isHealthy ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-sm text-gray-600">
            Backend{" "}
            {isHealthy === null
              ? "Checking..."
              : isHealthy
              ? "Online"
              : "Offline"}
          </span>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
    </div>
  );
}
