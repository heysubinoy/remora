"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServerManagement } from "@/components/server-management";
import { ScriptExecution } from "@/components/script-execution";
import { JobMonitoring } from "@/components/job-monitoring";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  ServerIcon,
  Activity,
  Settings,
  Keyboard,
  Github,
  AlertCircle,
  Database,
  Server,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnimatedStatsCard } from "@/components/animated-stats-card";
import {
  useRealServers,
  useRealJobs,
  useRealSystemStats,
} from "@/hooks/use-real-api";
import { toast } from "sonner";
import type { Server as ServerType, Job } from "@/types";
import { ApiStatus } from "@/components/api-status";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { DebugPanel } from "@/components/debug-panel";
import { ApiTestPanel } from "@/components/api-test-panel";
import { goApi } from "@/services/real-api";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("execution");

  // Job filtering and pagination state
  const [jobFilters, setJobFilters] = useState({
    page: 1,
    limit: 20,
    search: "",
    status: "",
    server_id: "",
    sort_by: "created_at",
    sort_order: "desc" as "asc" | "desc",
  });

  // State for pre-filling execute tab when duplicating jobs
  const [prefilledJob, setPrefilledJob] = useState<{
    command: string;
    args?: string;
    timeout: number;
  } | null>(null);

  // Use the real API hooks
  const {
    servers,
    loading: serversLoading,
    error: serversError,
    isPolling: serversPolling,
    addServer,
    updateServer,
    deleteServer,
    testConnection,
    updateServerStatus,
    checkAllServersStatus,
  } = useRealServers();

  const {
    jobs,
    pagination,
    filters,
    loading: jobsLoading,
    error: jobsError,
    isPolling: jobsPolling,
    executeJob,
    cancelJob,
    rerunJob,
    forceRefresh: refreshJobs,
  } = useRealJobs(jobFilters);

  const { stats, loading: statsLoading } = useRealSystemStats();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            setActiveTab("execution");
            break;
          case "2":
            e.preventDefault();
            setActiveTab("jobs");
            break;
          case "3":
            e.preventDefault();
            setActiveTab("servers");
            break;
          case "4":
            e.preventDefault();
            setActiveTab("api");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initial server status check when servers are loaded and periodic checks
  useEffect(() => {
    const checkServersStatusPeriodically = async () => {
      if (servers.length > 0) {
        try {
          await checkAllServersStatus();
          console.log("Server status check completed");
        } catch (error) {
          console.error("Server status check failed:", error);
        }
      }
    };

    // Only run if we have servers
    if (servers.length > 0) {
      // Initial check when servers are first loaded
      const initialTimeout = setTimeout(() => {
        checkServersStatusPeriodically();
      }, 1000); // 1 second after servers are loaded

      // Set up periodic check every 5 minutes
      const intervalId = setInterval(() => {
        checkServersStatusPeriodically();
      }, 5 * 60 * 1000); // 5 minutes

      return () => {
        clearTimeout(initialTimeout);
        clearInterval(intervalId);
      };
    }
  }, [servers.length, checkAllServersStatus]);

  // Handle server operations with error handling
  const handleAddServer = async (serverData: Omit<ServerType, "id">) => {
    try {
      await addServer(serverData);
      toast.success("Server added successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add server"
      );
      throw error;
    }
  };

  const handleUpdateServer = async (
    id: string,
    updates: Partial<ServerType>
  ) => {
    try {
      await updateServer(id, updates);
      toast.success("Server updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update server"
      );
      throw error;
    }
  };

  const handleDeleteServer = async (id: string, force: boolean = false) => {
    try {
      const result = await deleteServer(id, force);
      if (result.deleted_jobs > 0) {
        toast.success(
          `Server deleted successfully. ${result.deleted_jobs} associated job(s) were also removed.`
        );
      } else {
        toast.success("Server deleted successfully");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete server"
      );
      throw error;
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      await testConnection(id);
      toast.success("Connection test completed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection test failed"
      );
    }
  };

  const handleCheckServerStatus = async (id: string) => {
    try {
      const result = await goApi.servers.checkServerStatus(id);
      // Convert the API result to the expected format for updateServerStatus
      updateServerStatus({
        id: result.server_id,
        status: result.status, // This is already "connected" | "disconnected"
      });
      toast.success(`Server status: ${result.status}`);
    } catch (error) {
      // Update server status to error on failure
      updateServerStatus({
        id: id,
        status: "error",
      });

      toast.error(
        error instanceof Error ? error.message : "Server status check failed"
      );
    }
  };

  const handleCheckAllServersStatus = async () => {
    try {
      const result = await checkAllServersStatus();
      // Status updates are already handled in the hook, just show the toast
      const connectedCount = result.servers.filter(
        (s) => s.status === "connected"
      ).length;
      const disconnectedCount = result.servers.filter(
        (s) => s.status === "disconnected"
      ).length;
      toast.success(
        `Server Status: ${connectedCount}/${result.total_servers} connected`,
        {
          description: `${connectedCount} servers reachable, ${disconnectedCount} unreachable`,
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "All servers status check failed"
      );
    }
  };

  // Handle job operations with error handling
  const handleExecuteScript = async (
    serverIds: string[],
    command: string,
    timeout: number,
    args?: string
  ) => {
    try {
      await executeJob(serverIds, command, timeout, args);
      toast.success("Jobs started successfully");
      // Reset to first page to see new jobs
      setJobFilters((prev) => ({ ...prev, page: 1 }));
      // Clear pre-filled job data after successful execution
      setPrefilledJob(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to execute jobs"
      );
      throw error;
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      toast.success("Job cancelled successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel job"
      );
    }
  };

  const handleRerunJob = async (jobId: string) => {
    try {
      await rerunJob(jobId);
      toast.success("Job rerun successfully - new job created");
      // Reset to first page to see new job
      setJobFilters((prev) => ({ ...prev, page: 1 }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rerun job"
      );
    }
  };

  const handleDuplicateJob = (job: Job) => {
    // For script jobs, use the original script content; otherwise use the original command
    const command = job.original_script || job.originalCommand || job.command;
    const args = job.args || "";

    // Set the pre-filled job data
    setPrefilledJob({
      command: command,
      args: args,
      timeout: job.timeout || 300,
    });

    // Switch to execution tab
    setActiveTab("execution");

    toast.success("Job details copied to Execute tab - select servers and run");
  };

  // Handle job filtering and pagination
  const handleJobSearch = (search: string) => {
    setJobFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleJobFilter = (key: string, value: string) => {
    setJobFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleJobPageChange = (page: number) => {
    setJobFilters((prev) => ({ ...prev, page }));
  };

  const handleJobSort = (sort_by: string, sort_order: "asc" | "desc") => {
    setJobFilters((prev) => ({ ...prev, sort_by, sort_order, page: 1 }));
  };

  // const handleDeleteJob = async (jobId: string) => {
  //   try {
  //     await deleteJob(jobId);
  //     toast.success("Job deleted successfully");
  //   } catch (error) {
  //     toast.error(
  //       error instanceof Error ? error.message : "Failed to delete job"
  //     );
  //   }
  // };

  // Show loading state only on initial load
  if (
    (serversLoading || jobsLoading || statsLoading) &&
    !servers.length &&
    !jobs.length
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4" />
            <span>Connecting to API...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (serversError || jobsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-destructive">Error loading dashboard</p>
          <p className="text-sm text-muted-foreground">
            {serversError || jobsError}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const connectedServers = stats?.connectedServers || 0;
  const runningJobs = stats?.runningJobs || 0;
  const totalServers = stats?.totalServers || 0;
  const completedJobs = stats?.completedJobs || 0;
  const failedJobs = stats?.failedJobs || 0;
  const queuedJobs = stats?.queuedJobs || 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md transition-all duration-300">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-2 transition-transform duration-200 hover:scale-110">
                  <Terminal className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">Remora</h1>
                  <p className="text-xs text-muted-foreground transition-colors duration-200">
                    Distributed Job Execution System
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Status indicators */}
              <div className="hidden md:flex items-center gap-4 text-sm">
                <ConnectionIndicator
                  isPolling={serversPolling}
                  lastUpdated={servers.length > 0 ? new Date() : null}
                  error={serversError}
                />
                {/* <div className="flex items-center gap-2 transition-all duration-300">
                  <span className="text-muted-foreground transition-colors duration-200">
                    {connectedServers}/{totalServers} servers online
                  </span>
                  {statsLoading && (
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="flex items-center gap-2 transition-all duration-300">
                  <span className="text-muted-foreground transition-colors duration-200">
                    {runningJobs} jobs running
                  </span>
                  {queuedJobs > 0 && (
                    <span className="text-xs text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
                      {queuedJobs} queued
                    </span>
                  )}
                </div> */}
                <ApiStatus />
              </div>

              {/* Keyboard shortcuts hint */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 transition-all duration-200 hover:scale-110"
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <div>⌘+1 - Script Execution</div>
                    <div>⌘+2 - Job Monitoring</div>
                    <div>⌘+3 - Server Management</div>
                  </div>
                </TooltipContent>
              </Tooltip>

              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto p-6 space-y-8">
          {/* Stats cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                System Overview
              </h2>
              {stats?.timestamp && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      statsLoading
                        ? "bg-blue-500 animate-pulse"
                        : "bg-green-500"
                    }`}
                  ></div>
                  <span>
                    Last updated:{" "}
                    {new Date(stats.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <AnimatedStatsCard
                title="Total Servers"
                value={totalServers}
                icon={ServerIcon}
                color="text-green-500"
                bgColor="bg-green-500/10"
              />
              <AnimatedStatsCard
                title="Connected"
                value={connectedServers}
                icon={Activity}
                color="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <AnimatedStatsCard
                title="Completed Jobs"
                value={completedJobs}
                icon={Terminal}
                color="text-green-500"
                bgColor="bg-green-500/10"
              />
              <AnimatedStatsCard
                title="Running Jobs"
                value={runningJobs}
                icon={Settings}
                color="text-purple-500"
                bgColor="bg-purple-500/10"
              />
              <AnimatedStatsCard
                title="Failed Jobs"
                value={failedJobs}
                icon={AlertCircle}
                color="text-red-500"
                bgColor="bg-red-500/10"
              />
              <AnimatedStatsCard
                title="Queued Jobs"
                value={queuedJobs}
                icon={Database}
                color="text-orange-500"
                bgColor="bg-orange-500/10"
              />
            </div>
          </div>

          {/* Main tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-lg grid-cols-3 bg-muted/50 border border-border transition-all duration-300">
                <TabsTrigger
                  value="execution"
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <Terminal className="h-4 w-4" />
                  <span className="hidden sm:inline">Execute</span>
                </TabsTrigger>
                <TabsTrigger
                  value="jobs"
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Jobs</span>
                </TabsTrigger>
                <TabsTrigger
                  value="servers"
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <Server className="h-4 w-4" />
                  <span className="hidden sm:inline">Servers</span>
                </TabsTrigger>
                {/* <TabsTrigger
                  value="api"
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">API</span>
                </TabsTrigger> */}
              </TabsList>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden md:flex transition-all duration-200 hover:scale-105"
                >
                  API v1.0
                </Badge>
                <a
                  href="https://github.com/heysubinoy/remora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 transition-all duration-200 hover:scale-110"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 transition-all duration-200"
                  >
                    <Github className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            <TabsContent value="execution" className="space-y-0">
              <ScriptExecution
                servers={servers}
                onExecute={handleExecuteScript}
                onTestConnection={handleTestConnection}
                onJobsUpdate={refreshJobs}
                prefilledCommand={prefilledJob?.command}
                prefilledArgs={prefilledJob?.args}
                prefilledTimeout={prefilledJob?.timeout}
              />
            </TabsContent>

            <TabsContent value="jobs" className="space-y-0">
              <JobMonitoring
                jobs={jobs}
                pagination={pagination}
                filters={filters}
                onCancel={handleCancelJob}
                onRerun={handleRerunJob}
                onDuplicate={handleDuplicateJob}
                onSearch={handleJobSearch}
                onFilter={handleJobFilter}
                onPageChange={handleJobPageChange}
                onSort={handleJobSort}
                onJobUpdate={(updatedJob) => {
                  // Optional: Handle individual job updates
                  console.log("Job updated:", updatedJob);
                }}
                onJobComplete={(completedJob) => {
                  // Refresh jobs list when a job completes
                  console.log("Job completed:", completedJob);
                  // The list will auto-refresh via polling, but we could trigger immediate refresh here if needed
                }}
              />
            </TabsContent>

            <TabsContent value="servers" className="space-y-0">
              <ServerManagement
                servers={servers}
                onAdd={handleAddServer}
                onUpdate={handleUpdateServer}
                onDelete={handleDeleteServer}
                onTestConnection={handleTestConnection}
                onCheckStatus={handleCheckServerStatus}
                onCheckAllStatus={handleCheckAllServersStatus}
              />
            </TabsContent>
            <TabsContent value="api" className="space-y-0">
              <ApiTestPanel />
            </TabsContent>
          </Tabs>
        </main>
        {/* <DebugPanel
          servers={servers}
          jobs={jobs}
          stats={stats}
          serversError={serversError}
          jobsError={jobsError}
          isPolling={serversPolling || jobsPolling}
        /> */}
      </div>
    </TooltipProvider>
  );
}
