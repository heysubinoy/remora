"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Import API hooks and utilities
import {
  useServers,
  useJobs,
  useJob,
  useHealth,
  useFormState,
} from "@/hooks/use-api";
import {
  Server as APIServer,
  Job as APIJob,
  JobRequest,
  ServerRequest,
} from "@/lib/api";

// Import new components
import { DashboardHeader } from "@/components/dashboard-header";
import { ErrorBanner } from "@/components/error-banner";
import { JobForm } from "@/components/job-form";
import { JobList } from "@/components/job-list";
import { ServerList } from "@/components/server-list";
import { LiveJobViewer } from "@/components/live-job-viewer";

export default function JobExecutionDashboard() {
  const { toast } = useToast();

  // API hooks
  const {
    servers,
    loading: serversLoading,
    error: serversError,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    refetch: refetchServers,
  } = useServers();

  const {
    jobs,
    loading: jobsLoading,
    error: jobsError,
    submitJob,
    cancelJob,
    refetch: refetchJobs,
  } = useJobs();

  const { isHealthy } = useHealth();

  // Local state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isServerDialogOpen, setIsServerDialogOpen] = useState(false);
  const [isJobViewerOpen, setIsJobViewerOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<APIServer | null>(null);

  // Form state management
  const {
    values: serverForm,
    errors: serverErrors,
    hasErrors: hasServerErrors,
    setValue: setServerValue,
    setError: setServerError,
    reset: resetServerForm,
  } = useFormState<ServerRequest>({
    name: "",
    hostname: "",
    port: 22,
    user: "",
    auth_type: "key",
    password: "",
    private_key: "",
    pem_file: "",
    is_active: true,
  });

  const {
    values: jobForm,
    errors: jobErrors,
    hasErrors: hasJobErrors,
    setValue: setJobValue,
    setError: setJobError,
    reset: resetJobForm,
  } = useFormState<JobRequest & { timeout: number }>({
    command: "",
    args: "",
    server_id: "",
    timeout: 300,
  });

  // Event handlers
  const handleRefresh = () => {
    refetchServers();
    refetchJobs();
  };

  const handleSubmitJob = async () => {
    // Validate required fields
    if (!jobForm.server_id) {
      setJobError("server_id", "Please select a server");
      return;
    }
    if (!jobForm.command) {
      setJobError("command", "Command is required");
      return;
    }

    try {
      const success = await submitJob({
        command: jobForm.command,
        args: jobForm.args,
        server_id: jobForm.server_id,
        timeout: jobForm.timeout,
      });

      if (success) {
        toast({
          title: "Job submitted",
          description: "Your job has been queued for execution.",
        });
        resetJobForm();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit job.",
        variant: "destructive",
      });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const success = await cancelJob(jobId);
      if (success) {
        toast({
          title: "Job canceled",
          description: "Job has been canceled successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel job.",
        variant: "destructive",
      });
    }
  };

  const handleViewJob = (job: APIJob) => {
    setSelectedJobId(job.id);
    setIsJobViewerOpen(true);
  };

  const handleAddServer = async () => {
    // Validate required fields
    if (!serverForm.name) {
      setServerError("name", "Server name is required");
      return;
    }
    if (!serverForm.hostname) {
      setServerError("hostname", "Hostname is required");
      return;
    }
    if (!serverForm.user) {
      setServerError("user", "Username is required");
      return;
    }

    try {
      let success = false;

      if (editingServer) {
        success = await updateServer(editingServer.id, serverForm);
        if (success) {
          toast({
            title: "Server updated",
            description: "Server configuration has been updated successfully.",
          });
        }
      } else {
        success = await createServer(serverForm);
        if (success) {
          toast({
            title: "Server created",
            description: "New server has been added successfully.",
          });
        }
      }

      if (success) {
        resetServerForm();
        setEditingServer(null);
        setIsServerDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save server configuration.",
        variant: "destructive",
      });
    }
  };

  const handleEditServer = (server: APIServer) => {
    setEditingServer(server);
    setServerValue("name", server.name);
    setServerValue("hostname", server.hostname);
    setServerValue("port", server.port);
    setServerValue("user", server.user);
    setServerValue("auth_type", server.auth_type);
    setServerValue("password", server.password || "");
    setServerValue("private_key", server.private_key || "");
    setServerValue("pem_file", server.pem_file || "");
    setServerValue("is_active", server.is_active);
    setIsServerDialogOpen(true);
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      const success = await deleteServer(serverId);
      if (success) {
        toast({
          title: "Server deleted",
          description: "Server has been removed successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete server.",
        variant: "destructive",
      });
    }
  };

  const handleTestConnection = async (serverId: string) => {
    try {
      const result = await testConnection(serverId);
      toast({
        title: result.success ? "Connection successful" : "Connection failed",
        description:
          result.message ||
          (result.success
            ? "Server is reachable"
            : "Unable to connect to server"),
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Connection test failed",
        description: "Unable to test server connection.",
        variant: "destructive",
      });
    }
  };

  const handleJobValueChange = (field: string, value: any) => {
    setJobValue(field as keyof (JobRequest & { timeout: number }), value);
  };

  const handleServerValueChange = (field: string, value: any) => {
    setServerValue(field as keyof ServerRequest, value);
  };

  const handleCancelServer = () => {
    resetServerForm();
    setEditingServer(null);
    setIsServerDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <DashboardHeader
          isHealthy={isHealthy}
          onRefresh={handleRefresh}
          isLoading={serversLoading || jobsLoading}
        />

        {/* Error Messages */}
        <ErrorBanner serversError={serversError} jobsError={jobsError} />

        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Job Execution
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Server Management
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-6">
            <JobForm
              servers={servers}
              jobForm={jobForm}
              jobErrors={jobErrors}
              hasJobErrors={hasJobErrors}
              onValueChange={handleJobValueChange}
              onSubmit={handleSubmitJob}
            />
            <JobList
              jobs={jobs}
              loading={jobsLoading}
              onViewJob={handleViewJob}
              onCancelJob={handleCancelJob}
            />
          </TabsContent>

          {/* Servers Tab */}
          <TabsContent value="servers" className="space-y-6">
            <ServerList
              servers={servers}
              loading={serversLoading}
              isServerDialogOpen={isServerDialogOpen}
              onServerDialogOpenChange={setIsServerDialogOpen}
              editingServer={editingServer}
              serverForm={serverForm}
              serverErrors={serverErrors}
              hasServerErrors={hasServerErrors}
              onServerValueChange={handleServerValueChange}
              onSubmitServer={handleAddServer}
              onCancelServer={handleCancelServer}
              onEditServer={handleEditServer}
              onDeleteServer={handleDeleteServer}
              onTestConnection={handleTestConnection}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Live Job Viewer */}
      <LiveJobViewer
        jobId={selectedJobId}
        isOpen={isJobViewerOpen}
        onClose={() => setIsJobViewerOpen(false)}
      />
    </div>
  );
}
