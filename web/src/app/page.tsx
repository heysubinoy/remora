"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Server,
  Play,
  Square,
  Eye,
  Trash2,
  Edit,
  Plus,
  Terminal,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

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
  formatDuration,
  formatTimestamp,
} from "@/lib/api";

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

  // Job details hook (only when a job is selected)
  const {
    job: selectedJob,
    logs: selectedJobLogs,
    loading: jobDetailsLoading,
  } = useJob(selectedJobId);

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

  // Helper functions
  const getStatusBadge = (status: string, isServer = false) => {
    const variants = {
      // Server statuses (based on is_active)
      online: "bg-green-100 text-green-800 border-green-200",
      offline: "bg-red-100 text-red-800 border-red-200",
      // Job statuses
      queued: "bg-blue-100 text-blue-800 border-blue-200",
      running: "bg-yellow-100 text-yellow-800 border-yellow-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      canceled: "bg-gray-100 text-gray-800 border-gray-200",
    };

    const icons = {
      online: <CheckCircle className="w-3 h-3" />,
      offline: <XCircle className="w-3 h-3" />,
      queued: <Clock className="w-3 h-3" />,
      running: <Loader2 className="w-3 h-3 animate-spin" />,
      completed: <CheckCircle className="w-3 h-3" />,
      failed: <XCircle className="w-3 h-3" />,
      canceled: <AlertCircle className="w-3 h-3" />,
    };

    // For servers, determine status based on is_active
    const displayStatus = isServer ? (status ? "online" : "offline") : status;

    return (
      <Badge
        className={`${
          variants[displayStatus as keyof typeof variants]
        } flex items-center gap-1`}
      >
        {icons[displayStatus as keyof typeof icons]}
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </Badge>
    );
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
        args: jobForm.args || undefined,
        server_id: jobForm.server_id,
        timeout: jobForm.timeout,
      });

      if (success) {
        resetJobForm();
        toast({
          title: "Job submitted",
          description: "Job has been queued for execution.",
        });
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

  const handleViewLogs = (job: APIJob) => {
    setSelectedJobId(job.id);
    setIsJobViewerOpen(true);
  };

  const handleCloseDialogs = () => {
    setIsServerDialogOpen(false);
    setIsJobViewerOpen(false);
    setEditingServer(null);
    setSelectedJobId(null);
    resetServerForm();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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
              onClick={() => {
                refetchServers();
                refetchJobs();
              }}
              disabled={serversLoading || jobsLoading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  serversLoading || jobsLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Error Messages */}
        {(serversError || jobsError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-800">Connection Error</span>
            </div>
            {serversError && (
              <p className="text-red-700 mt-1">Servers: {serversError}</p>
            )}
            {jobsError && (
              <p className="text-red-700 mt-1">Jobs: {jobsError}</p>
            )}
          </div>
        )}

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
            {/* Submit Job Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Submit New Job
                </CardTitle>
                <CardDescription>
                  Execute commands on remote servers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="server">Target Server</Label>
                    <Select
                      value={jobForm.server_id}
                      onValueChange={(value) => setJobValue("server_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a server" />
                      </SelectTrigger>
                      <SelectContent>
                        {servers
                          .filter((server) => server.is_active)
                          .map((server) => (
                            <SelectItem key={server.id} value={server.id}>
                              <div className="flex items-center gap-2">
                                <span>{server.name}</span>
                                <span className="text-gray-400">
                                  ({server.hostname})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {jobErrors.server_id && (
                      <p className="text-sm text-red-600">
                        {jobErrors.server_id}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout">Timeout (seconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={jobForm.timeout}
                      onChange={(e) =>
                        setJobValue("timeout", parseInt(e.target.value) || 300)
                      }
                      placeholder="300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="command">Command</Label>
                  <Input
                    id="command"
                    value={jobForm.command}
                    onChange={(e) => setJobValue("command", e.target.value)}
                    placeholder="e.g., ls, docker ps, systemctl status nginx"
                  />
                  {jobErrors.command && (
                    <p className="text-sm text-red-600">{jobErrors.command}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="args">Arguments (optional)</Label>
                  <Input
                    id="args"
                    value={jobForm.args}
                    onChange={(e) => setJobValue("args", e.target.value)}
                    placeholder="e.g., -la, --help, status nginx"
                  />
                </div>

                <Button
                  onClick={handleSubmitJob}
                  className="w-full"
                  disabled={
                    hasJobErrors || !jobForm.server_id || !jobForm.command
                  }
                >
                  <Play className="w-4 h-4 mr-2" />
                  Execute Job
                </Button>
              </CardContent>
            </Card>

            {/* Jobs List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Jobs
                </CardTitle>
                <CardDescription>
                  View and manage job execution history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Loading jobs...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job ID</TableHead>
                        <TableHead>Server</TableHead>
                        <TableHead>Command</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Exit Code</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-gray-500 py-8"
                          >
                            No jobs found. Submit your first job above.
                          </TableCell>
                        </TableRow>
                      ) : (
                        jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-mono text-xs">
                              {job.id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {job.server?.name || "Unknown"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {job.server?.hostname}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">
                                <div className="font-medium">{job.command}</div>
                                {job.args && (
                                  <div className="text-gray-500 text-xs">
                                    {job.args}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(job.status)}</TableCell>
                            <TableCell className="text-sm">
                              {formatTimestamp(job.created_at)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {job.duration
                                ? formatDuration(job.duration)
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {job.exit_code !== null ? (
                                <Badge
                                  className={
                                    job.exit_code === 0
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }
                                >
                                  {job.exit_code}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewLogs(job)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {(job.status === "running" ||
                                  job.status === "queued") && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        <Square className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Cancel Job
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to cancel this
                                          job? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() =>
                                            handleCancelJob(job.id)
                                          }
                                        >
                                          Yes, Cancel Job
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Servers Tab */}
          <TabsContent value="servers" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Servers
                  </CardTitle>
                  <CardDescription>
                    Manage your remote servers and SSH connections
                  </CardDescription>
                </div>
                <Dialog
                  open={isServerDialogOpen}
                  onOpenChange={setIsServerDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Server
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingServer ? "Edit Server" : "Add New Server"}
                      </DialogTitle>
                      <DialogDescription>
                        Configure SSH connection details for your server
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Server Name</Label>
                          <Input
                            id="name"
                            value={serverForm.name}
                            onChange={(e) =>
                              setServerValue("name", e.target.value)
                            }
                            placeholder="Production Server"
                          />
                          {serverErrors.name && (
                            <p className="text-sm text-red-600">
                              {serverErrors.name}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hostname">Hostname/IP</Label>
                          <Input
                            id="hostname"
                            value={serverForm.hostname}
                            onChange={(e) =>
                              setServerValue("hostname", e.target.value)
                            }
                            placeholder="192.168.1.100"
                          />
                          {serverErrors.hostname && (
                            <p className="text-sm text-red-600">
                              {serverErrors.hostname}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="port">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            value={serverForm.port}
                            onChange={(e) =>
                              setServerValue(
                                "port",
                                parseInt(e.target.value) || 22
                              )
                            }
                            placeholder="22"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="user">Username</Label>
                          <Input
                            id="user"
                            value={serverForm.user}
                            onChange={(e) =>
                              setServerValue("user", e.target.value)
                            }
                            placeholder="ubuntu"
                          />
                          {serverErrors.user && (
                            <p className="text-sm text-red-600">
                              {serverErrors.user}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="auth_type">Authentication Type</Label>
                        <Select
                          value={serverForm.auth_type}
                          onValueChange={(value) =>
                            setServerValue("auth_type", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="key">SSH Key</SelectItem>
                            <SelectItem value="password">Password</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {serverForm.auth_type === "password" && (
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={serverForm.password || ""}
                            onChange={(e) =>
                              setServerValue("password", e.target.value)
                            }
                            placeholder="Enter password"
                          />
                        </div>
                      )}

                      {serverForm.auth_type === "key" && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="pem_file">PEM File Path</Label>
                            <Input
                              id="pem_file"
                              value={serverForm.pem_file || ""}
                              onChange={(e) =>
                                setServerValue("pem_file", e.target.value)
                              }
                              placeholder="./path/to/key.pem"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="private_key">
                              Or Private Key Content
                            </Label>
                            <Textarea
                              id="private_key"
                              value={serverForm.private_key || ""}
                              onChange={(e) =>
                                setServerValue("private_key", e.target.value)
                              }
                              placeholder="-----BEGIN PRIVATE KEY-----..."
                              rows={4}
                            />
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between">
                        <Button variant="outline" onClick={handleCloseDialogs}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddServer}
                          disabled={hasServerErrors}
                        >
                          {editingServer ? "Update Server" : "Add Server"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {serversLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Loading servers...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Hostname</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Auth</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-gray-500 py-8"
                          >
                            No servers configured. Add your first server above.
                          </TableCell>
                        </TableRow>
                      ) : (
                        servers.map((server) => (
                          <TableRow key={server.id}>
                            <TableCell className="font-medium">
                              {server.name}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{server.hostname}</span>
                                <span className="text-xs text-gray-500">
                                  Port: {server.port}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{server.user}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {server.auth_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(
                                server.is_active.toString(),
                                true
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleTestConnection(server.id)
                                  }
                                >
                                  <Wifi className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditServer(server)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Delete Server
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "
                                        {server.name}"? This action cannot be
                                        undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleDeleteServer(server.id)
                                        }
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Viewer Modal */}
      <Dialog open={isJobViewerOpen} onOpenChange={setIsJobViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Job Details - {selectedJobId?.slice(0, 8)}...
            </DialogTitle>
            <DialogDescription>
              Command execution logs and details
            </DialogDescription>
          </DialogHeader>

          {jobDetailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading job details...</span>
            </div>
          ) : selectedJob && selectedJobLogs ? (
            <div className="space-y-4">
              {/* Job Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-gray-500">Server</Label>
                  <p className="font-medium">
                    {selectedJob.server?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Command</Label>
                  <p className="font-mono text-sm">
                    {selectedJob.command} {selectedJob.args}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedJob.status)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Duration</Label>
                  <p className="font-medium">
                    {selectedJob.duration
                      ? formatDuration(selectedJob.duration)
                      : "Running..."}
                  </p>
                </div>
              </div>

              {/* Log Tabs */}
              <Tabs defaultValue="stdout" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="stdout">
                    stdout ({selectedJobLogs.metadata.stdout_length} chars)
                  </TabsTrigger>
                  <TabsTrigger value="stderr">
                    stderr ({selectedJobLogs.metadata.stderr_length} chars)
                  </TabsTrigger>
                  <TabsTrigger value="info">Info</TabsTrigger>
                </TabsList>

                <TabsContent value="stdout">
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                    <ScrollArea className="h-64">
                      {selectedJobLogs.stdout ? (
                        <pre className="whitespace-pre-wrap">
                          {selectedJobLogs.stdout}
                        </pre>
                      ) : (
                        <div className="text-gray-500 italic">
                          No stdout output
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="stderr">
                  <div className="bg-gray-900 text-red-400 p-4 rounded-lg font-mono text-sm">
                    <ScrollArea className="h-64">
                      {selectedJobLogs.stderr ? (
                        <pre className="whitespace-pre-wrap">
                          {selectedJobLogs.stderr}
                        </pre>
                      ) : (
                        <div className="text-gray-500 italic">
                          No stderr output
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="info">
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Started</Label>
                        <p className="text-sm">
                          {formatTimestamp(selectedJobLogs.started_at)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Finished
                        </Label>
                        <p className="text-sm">
                          {formatTimestamp(selectedJobLogs.finished_at)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Exit Code
                        </Label>
                        <p className="text-sm">
                          {selectedJobLogs.exit_code !== null ? (
                            <Badge
                              className={
                                selectedJobLogs.exit_code === 0
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {selectedJobLogs.exit_code}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Timeout</Label>
                        <p className="text-sm">{selectedJobLogs.timeout}s</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <div className="flex gap-2">
                  {(selectedJob.status === "running" ||
                    selectedJob.status === "queued") && (
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelJob(selectedJob.id)}
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Cancel Job
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsJobViewerOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Failed to load job details
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
