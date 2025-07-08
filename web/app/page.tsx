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
import type { ServerType } from "@/types";
import { ApiStatus } from "@/components/api-status";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { DebugPanel } from "@/components/debug-panel";
import { ApiTestPanel } from "@/components/api-test-panel";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("execution");

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
  } = useRealServers();

  const {
    jobs,
    loading: jobsLoading,
    error: jobsError,
    isPolling: jobsPolling,
    executeJob,
    cancelJob,
    // deleteJob,
  } = useRealJobs();

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

  const handleDeleteServer = async (id: string) => {
    try {
      await deleteServer(id);
      toast.success("Server deleted successfully");
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
                    Server Management & Automation
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
                <div className="flex items-center gap-2 transition-all duration-300">
                  <span className="text-muted-foreground transition-colors duration-200">
                    {connectedServers} servers online
                  </span>
                </div>
                <div className="flex items-center gap-2 transition-all duration-300">
                  <span className="text-muted-foreground transition-colors duration-200">
                    {runningJobs} jobs running
                  </span>
                </div>
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
                    <div>⌘+4 - API Testing</div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <AnimatedStatsCard
              title="Total Servers"
              value={stats?.totalServers || 0}
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
              title="Completed"
              value={stats?.completedJobs || 0}
              icon={Terminal}
              color="text-orange-500"
              bgColor="bg-orange-500/10"
            />
            <AnimatedStatsCard
              title="Running"
              value={runningJobs}
              icon={Settings}
              color="text-purple-500"
              bgColor="bg-purple-500/10"
            />
          </div>

          {/* Main tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-lg grid-cols-4 bg-muted/50 border border-border transition-all duration-300">
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
                <TabsTrigger
                  value="api"
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">API</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden md:flex transition-all duration-200 hover:scale-105"
                >
                  API v1.0
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 transition-all duration-200 hover:scale-110"
                >
                  <Github className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <TabsContent value="execution" className="space-y-0">
              <ScriptExecution
                servers={servers}
                onExecute={handleExecuteScript}
                onTestConnection={handleTestConnection}
              />
            </TabsContent>

            <TabsContent value="jobs" className="space-y-0">
              <JobMonitoring jobs={jobs} onCancel={handleCancelJob} />
            </TabsContent>

            <TabsContent value="servers" className="space-y-0">
              <ServerManagement
                servers={servers}
                onAdd={handleAddServer}
                onUpdate={handleUpdateServer}
                onDelete={handleDeleteServer}
                onTestConnection={handleTestConnection}
              />
            </TabsContent>
            <TabsContent value="api" className="space-y-0">
              <ApiTestPanel />
            </TabsContent>
          </Tabs>
        </main>
        <DebugPanel
          servers={servers}
          jobs={jobs}
          stats={stats}
          serversError={serversError}
          jobsError={jobsError}
          isPolling={serversPolling || jobsPolling}
        />
      </div>
    </TooltipProvider>
  );
}
