"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"

// Types
interface ServerType {
  id: string
  name: string
  hostname: string
  port: number
  username: string
  privateKey: string
  status: "online" | "offline"
}

interface JobType {
  id: string
  serverId: string
  serverName: string
  command: string
  args: string
  status: "queued" | "running" | "completed" | "failed" | "canceled"
  createdAt: string
  duration?: string
  exitCode?: number
  logs: string[]
}

export default function JobExecutionDashboard() {
  // State management
  const [servers, setServers] = useState<ServerType[]>([
    {
      id: "1",
      name: "Production Server",
      hostname: "prod.example.com",
      port: 22,
      username: "deploy",
      privateKey: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
      status: "online",
    },
    {
      id: "2",
      name: "Staging Server",
      hostname: "staging.example.com",
      port: 22,
      username: "ubuntu",
      privateKey: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
      status: "offline",
    },
  ])

  const [jobs, setJobs] = useState<JobType[]>([
    {
      id: "job-001",
      serverId: "1",
      serverName: "Production Server",
      command: "docker ps",
      args: "-a",
      status: "completed",
      createdAt: "2024-01-15 14:30:25",
      duration: "2.3s",
      exitCode: 0,
      logs: [
        "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES",
        'abc123def456   nginx     "nginx"   2 hours   Up 2 hrs  80/tcp    web-server',
        'def456ghi789   redis     "redis"   1 day     Up 1 day  6379/tcp  cache',
      ],
    },
    {
      id: "job-002",
      serverId: "1",
      serverName: "Production Server",
      command: "npm run build",
      args: "",
      status: "running",
      createdAt: "2024-01-15 14:35:10",
      logs: ["> Building application...", "> Compiling TypeScript files...", "> Bundling assets..."],
    },
    {
      id: "job-003",
      serverId: "2",
      serverName: "Staging Server",
      command: "systemctl status nginx",
      args: "",
      status: "failed",
      createdAt: "2024-01-15 14:20:15",
      duration: "1.1s",
      exitCode: 1,
      logs: ["Unit nginx.service could not be found."],
    },
  ])

  const [newServer, setNewServer] = useState({
    name: "",
    hostname: "",
    port: 22,
    username: "",
    privateKey: "",
  })

  const [newJob, setNewJob] = useState({
    serverId: "",
    command: "",
    args: "",
    timeout: 300,
  })

  const [selectedJob, setSelectedJob] = useState<JobType | null>(null)
  const [isServerDialogOpen, setIsServerDialogOpen] = useState(false)
  const [isJobViewerOpen, setIsJobViewerOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<ServerType | null>(null)

  // Helper functions
  const getStatusBadge = (status: string) => {
    const variants = {
      online: "bg-green-100 text-green-800 border-green-200",
      offline: "bg-red-100 text-red-800 border-red-200",
      queued: "bg-blue-100 text-blue-800 border-blue-200",
      running: "bg-yellow-100 text-yellow-800 border-yellow-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      canceled: "bg-gray-100 text-gray-800 border-gray-200",
    }

    const icons = {
      online: <CheckCircle className="w-3 h-3" />,
      offline: <XCircle className="w-3 h-3" />,
      queued: <Clock className="w-3 h-3" />,
      running: <Loader2 className="w-3 h-3 animate-spin" />,
      completed: <CheckCircle className="w-3 h-3" />,
      failed: <XCircle className="w-3 h-3" />,
      canceled: <AlertCircle className="w-3 h-3" />,
    }

    return (
      <Badge className={`${variants[status as keyof typeof variants]} flex items-center gap-1`}>
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const handleAddServer = () => {
    if (editingServer) {
      setServers(servers.map((s) => (s.id === editingServer.id ? { ...editingServer, ...newServer } : s)))
      setEditingServer(null)
    } else {
      const server: ServerType = {
        id: Date.now().toString(),
        ...newServer,
        status: "offline",
      }
      setServers([...servers, server])
    }
    setNewServer({ name: "", hostname: "", port: 22, username: "", privateKey: "" })
    setIsServerDialogOpen(false)
  }

  const handleEditServer = (server: ServerType) => {
    setEditingServer(server)
    setNewServer({
      name: server.name,
      hostname: server.hostname,
      port: server.port,
      username: server.username,
      privateKey: server.privateKey,
    })
    setIsServerDialogOpen(true)
  }

  const handleDeleteServer = (serverId: string) => {
    setServers(servers.filter((s) => s.id !== serverId))
  }

  const handleSubmitJob = () => {
    const server = servers.find((s) => s.id === newJob.serverId)
    if (!server) return

    const job: JobType = {
      id: `job-${Date.now()}`,
      serverId: newJob.serverId,
      serverName: server.name,
      command: newJob.command,
      args: newJob.args,
      status: "queued",
      createdAt: new Date().toLocaleString(),
      logs: [],
    }

    setJobs([job, ...jobs])
    setNewJob({ serverId: "", command: "", args: "", timeout: 300 })

    // Simulate job execution
    setTimeout(() => {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "running" } : j)))
    }, 1000)
  }

  const handleCancelJob = (jobId: string) => {
    setJobs(jobs.map((j) => (j.id === jobId ? { ...j, status: "canceled" } : j)))
  }

  const handleViewLogs = (job: JobType) => {
    setSelectedJob(job)
    setIsJobViewerOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Terminal className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Job Execution Dashboard</h1>
              <p className="text-gray-600">Manage remote servers and execute commands</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="servers">Servers</TabsTrigger>
            <TabsTrigger value="submit">Submit Job</TabsTrigger>
            <TabsTrigger value="jobs">Job History</TabsTrigger>
          </TabsList>

          {/* Dashboard Overview */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{servers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {servers.filter((s) => s.status === "online").length} online
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter((j) => j.status === "running" || j.status === "queued").length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {jobs.filter((j) => j.status === "running").length} running
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.length > 0
                      ? Math.round((jobs.filter((j) => j.status === "completed").length / jobs.length) * 100)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Jobs</CardTitle>
                <CardDescription>Latest command executions across all servers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Server</TableHead>
                      <TableHead>Command</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.slice(0, 5).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">{job.id}</TableCell>
                        <TableCell>{job.serverName}</TableCell>
                        <TableCell className="font-mono">
                          {job.command} {job.args}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>{job.createdAt}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewLogs(job)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {job.status === "running" && (
                              <Button variant="outline" size="sm" onClick={() => handleCancelJob(job.id)}>
                                <Square className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Server Management */}
          <TabsContent value="servers" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Server Management</CardTitle>
                  <CardDescription>Manage your remote servers and their connection details</CardDescription>
                </div>
                <Dialog open={isServerDialogOpen} onOpenChange={setIsServerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingServer(null)
                        setNewServer({ name: "", hostname: "", port: 22, username: "", privateKey: "" })
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Server
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingServer ? "Edit Server" : "Add New Server"}</DialogTitle>
                      <DialogDescription>
                        {editingServer
                          ? "Update server connection details"
                          : "Enter the connection details for your remote server"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Server Name</Label>
                        <Input
                          id="name"
                          value={newServer.name}
                          onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                          placeholder="Production Server"
                        />
                      </div>
                      <div>
                        <Label htmlFor="hostname">Hostname</Label>
                        <Input
                          id="hostname"
                          value={newServer.hostname}
                          onChange={(e) => setNewServer({ ...newServer, hostname: e.target.value })}
                          placeholder="server.example.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="port">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            value={newServer.port}
                            onChange={(e) => setNewServer({ ...newServer, port: Number.parseInt(e.target.value) })}
                            placeholder="22"
                          />
                        </div>
                        <div>
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            value={newServer.username}
                            onChange={(e) => setNewServer({ ...newServer, username: e.target.value })}
                            placeholder="ubuntu"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="privateKey">Private Key</Label>
                        <Textarea
                          id="privateKey"
                          value={newServer.privateKey}
                          onChange={(e) => setNewServer({ ...newServer, privateKey: e.target.value })}
                          placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                          rows={4}
                        />
                      </div>
                      <Button onClick={handleAddServer} className="w-full">
                        {editingServer ? "Update Server" : "Add Server"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Port</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servers.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell className="font-medium">{server.name}</TableCell>
                        <TableCell className="font-mono">{server.hostname}</TableCell>
                        <TableCell>{server.port}</TableCell>
                        <TableCell>{server.username}</TableCell>
                        <TableCell>{getStatusBadge(server.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditServer(server)}>
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
                                  <AlertDialogTitle>Delete Server</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{server.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteServer(server.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Submission */}
          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit New Job</CardTitle>
                <CardDescription>Execute a command on a remote server</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="server">Select Server</Label>
                  <Select value={newJob.serverId} onValueChange={(value) => setNewJob({ ...newJob, serverId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a server" />
                    </SelectTrigger>
                    <SelectContent>
                      {servers
                        .filter((s) => s.status === "online")
                        .map((server) => (
                          <SelectItem key={server.id} value={server.id}>
                            {server.name} ({server.hostname})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="command">Shell Command</Label>
                  <Input
                    id="command"
                    value={newJob.command}
                    onChange={(e) => setNewJob({ ...newJob, command: e.target.value })}
                    placeholder="ls -la"
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="args">Arguments (Optional)</Label>
                  <Input
                    id="args"
                    value={newJob.args}
                    onChange={(e) => setNewJob({ ...newJob, args: e.target.value })}
                    placeholder="--verbose --output=json"
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={newJob.timeout}
                    onChange={(e) => setNewJob({ ...newJob, timeout: Number.parseInt(e.target.value) })}
                    placeholder="300"
                  />
                </div>

                <Button onClick={handleSubmitJob} className="w-full" disabled={!newJob.serverId || !newJob.command}>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Command
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job History */}
          <TabsContent value="jobs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job History</CardTitle>
                <CardDescription>View and manage all executed jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Server</TableHead>
                      <TableHead>Command</TableHead>
                      <TableHead>Args</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">{job.id}</TableCell>
                        <TableCell>{job.serverName}</TableCell>
                        <TableCell className="font-mono">{job.command}</TableCell>
                        <TableCell className="font-mono text-sm text-gray-600">{job.args || "-"}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>{job.createdAt}</TableCell>
                        <TableCell>{job.duration || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewLogs(job)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {job.status === "running" && (
                              <Button variant="outline" size="sm" onClick={() => handleCancelJob(job.id)}>
                                <Square className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Live Job Viewer Modal */}
      <Dialog open={isJobViewerOpen} onOpenChange={setIsJobViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Job Viewer - {selectedJob?.id}
            </DialogTitle>
            <DialogDescription>Command execution logs and details</DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              {/* Job Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-gray-500">Server</Label>
                  <p className="font-medium">{selectedJob.serverName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Command</Label>
                  <p className="font-mono text-sm">
                    {selectedJob.command} {selectedJob.args}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Duration</Label>
                  <p className="font-medium">{selectedJob.duration || "Running..."}</p>
                </div>
              </div>

              {/* Terminal Output */}
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Output:</span>
                  <div className="flex gap-2">
                    {selectedJob.status === "running" && (
                      <>
                        <Button variant="outline" size="sm" className="text-xs bg-transparent">
                          Stream Live
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs bg-transparent">
                          Stop Stream
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <Separator className="mb-4 bg-gray-700" />
                <ScrollArea className="h-64">
                  {selectedJob.logs.length > 0 ? (
                    selectedJob.logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500 mr-2">{String(index + 1).padStart(3, "0")}:</span>
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 italic">No output yet...</div>
                  )}
                  {selectedJob.status === "running" && (
                    <div className="flex items-center gap-2 text-yellow-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Waiting for output...
                    </div>
                  )}
                </ScrollArea>

                {selectedJob.exitCode !== undefined && (
                  <div className="mt-4 pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Exit Code: </span>
                    <span className={selectedJob.exitCode === 0 ? "text-green-400" : "text-red-400"}>
                      {selectedJob.exitCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <div className="flex gap-2">
                  {selectedJob.status === "running" && (
                    <Button variant="destructive" onClick={() => handleCancelJob(selectedJob.id)}>
                      <Square className="w-4 h-4 mr-2" />
                      Cancel Job
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setIsJobViewerOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
