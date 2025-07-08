"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Play,
  Upload,
  FileText,
  Clock,
  Zap,
  Code,
  Terminal,
  Copy,
  Check,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/real-api";
import type { Server } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const commonCommands = [
  { name: "Restart Nginx", command: "sudo systemctl restart nginx" },
  { name: "List Docker Containers", command: "docker ps -a" },
  { name: "Install and Build", command: "npm install && npm run build" },
  {
    name: "Find Recent Logs",
    command: "find /var/log -name '*.log' -mtime -1",
  },
];

interface ScriptExecutionProps {
  servers: Server[];
  onExecute?: (
    serverIds: string[],
    command: string,
    timeout: number,
    args?: string
  ) => void;
  onTestConnection?: (serverId: string) => void;
  onJobsUpdate?: () => void; // Callback to refresh jobs list
  prefilledCommand?: string; // Pre-filled command for duplicating jobs
  prefilledArgs?: string; // Pre-filled arguments for duplicating jobs
  prefilledTimeout?: number; // Pre-filled timeout for duplicating jobs
}

export function ScriptExecution({
  servers,
  onExecute,
  onTestConnection,
  onJobsUpdate,
  prefilledCommand,
  prefilledArgs,
  prefilledTimeout,
}: ScriptExecutionProps) {
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [arguments_, setArguments] = useState("");
  const [timeout, setTimeoutState] = useState(300);
  const [priority, setPriority] = useState(5); // Default priority is 5
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle pre-filled values for job duplication
  useEffect(() => {
    if (prefilledCommand) {
      setCommand(prefilledCommand);
    }
    if (prefilledArgs) {
      setArguments(prefilledArgs);
    }
    if (prefilledTimeout) {
      setTimeoutState(prefilledTimeout);
    }
  }, [prefilledCommand, prefilledArgs, prefilledTimeout]);

  const connectedServers = servers;

  const handleServerToggle = (serverId: string) => {
    setSelectedServers((prev) =>
      prev.includes(serverId)
        ? prev.filter((id) => id !== serverId)
        : [...prev, serverId]
    );
  };

  const handleSelectAll = () => {
    if (selectedServers.length === connectedServers.length) {
      setSelectedServers([]);
    } else {
      setSelectedServers(connectedServers.map((s) => s.id));
    }
  };

  const validateAndProcessFile = (file: File) => {
    // Validate file type
    if (!file.name.endsWith(".sh")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload only shell script files (.sh)",
        variant: "destructive",
      });
      return false;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload files smaller than 1MB",
        variant: "destructive",
      });
      return false;
    }

    setScriptFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCommand(content);
      toast({
        title: "Script Uploaded",
        description: `Successfully loaded ${file.name}`,
        variant: "default",
      });
    };
    reader.onerror = () => {
      toast({
        title: "Upload Error",
        description: "Failed to read the uploaded file",
        variant: "destructive",
      });
      setScriptFile(null);
    };
    reader.readAsText(file);
    return true;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      validateAndProcessFile(file);
    }
  };

  const handleCommonCommand = (cmd: string) => {
    setCommand(cmd);
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setCommand("");
    setScriptFile(null);
    setArguments("");
    setSelectedServers([]);
    setTimeoutState(300);
    setPriority(5); // Reset priority to default
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "Form Reset",
      description: "All fields have been cleared",
      variant: "default",
    });
  };

  const handleExecute = async () => {
    if (selectedServers.length === 0 || !command.trim()) return;

    setIsExecuting(true);

    try {
      const jobs = [];
      let successCount = 0;
      let errorCount = 0;

      // Submit jobs for each selected server
      for (const serverId of selectedServers) {
        try {
          let job;

          if (scriptFile) {
            // Use script job endpoint for file uploads or multi-line scripts
            job = await api.jobs.submitScriptJob({
              script: command.trim(),
              args: arguments_.trim() || undefined,
              server_id: serverId,
              timeout: timeout,
              priority: priority,
              shell: "/bin/bash", // Default shell
            });
          } else {
            // Use regular job endpoint for simple commands
            job = await api.jobs.submitJob({
              command: command.trim(),
              args: arguments_.trim() || undefined,
              server_id: serverId,
              timeout: timeout,
              priority: priority,
            });
          }

          jobs.push(job);
          successCount++;
        } catch (error) {
          console.error(`Failed to submit job for server ${serverId}:`, error);
          errorCount++;
        }
      }

      // Show success/error toast
      if (successCount > 0) {
        toast({
          title: "Jobs Submitted Successfully",
          description: `${successCount} job${
            successCount !== 1 ? "s" : ""
          } submitted successfully${
            errorCount > 0 ? `, ${errorCount} failed` : ""
          }.`,
          variant:
            successCount === selectedServers.length ? "default" : "destructive",
        });
      } else {
        toast({
          title: "Job Submission Failed",
          description:
            "Failed to submit any jobs. Please check your server connections.",
          variant: "destructive",
        });
      }

      // Trigger jobs list refresh
      if (onJobsUpdate) {
        onJobsUpdate();
      }

      // Reset form only if at least one job was submitted successfully
      if (successCount > 0) {
        setCommand("");
        setScriptFile(null);
        setArguments("");
        setSelectedServers([]);
      }
    } catch (error) {
      console.error("Error during job execution:", error);
      toast({
        title: "Execution Error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderHighlightedLine = (line: string): React.ReactNode[] => {
    // Simple syntax highlighting using React elements instead of dangerouslySetInnerHTML
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Helper function to add highlighted part
    const addPart = (text: string, className?: string) => {
      if (text) {
        parts.push(
          className ? (
            <span key={key++} className={className}>
              {text}
            </span>
          ) : (
            <span key={key++}>{text}</span>
          )
        );
      }
    };

    // Simple regex-based highlighting
    const patterns = [
      // Comments (highest priority)
      { regex: /(#.*)$/, className: "text-gray-400 italic" },
      // String literals
      { regex: /(".*?"|'.*?')/, className: "text-green-400" },
      // Shell keywords
      {
        regex:
          /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|source|export|local|readonly|declare|set|unset)\b/,
        className: "text-purple-400 font-semibold",
      },
      // Common commands
      {
        regex:
          /\b(sudo|systemctl|docker|npm|yarn|git|curl|wget|ssh|scp|echo|cat|grep|sed|awk|sort|uniq|head|tail|find|ls|cd|mkdir|rm|cp|mv|chmod|chown)\b/,
        className: "text-blue-400 font-semibold",
      },
      // Variables
      { regex: /(\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?)/, className: "text-cyan-400" },
      // Numbers
      { regex: /\b(\d+)\b/, className: "text-yellow-400" },
      // Operators
      { regex: /([|&;(){}[\]])/, className: "text-pink-400" },
    ];

    // Process each pattern
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        // Add text before match
        if (match.index > 0) {
          addPart(remaining.substring(0, match.index));
        }
        // Add highlighted match
        addPart(match[0], pattern.className);
        // Update remaining text
        remaining = remaining.substring(match.index + match[0].length);
        break; // Process one pattern at a time to avoid conflicts
      }
    }

    // Add any remaining text
    if (remaining) {
      addPart(remaining);
    }

    return parts.length > 0 ? parts : [<span key={0}>{line}</span>];
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Quick Commands
        <Card className="glass border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Commands
            </CardTitle>
            <CardDescription>
              Common system administration commands
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {commonCommands.map((cmd) => (
                <Button
                  key={cmd.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCommonCommand(cmd.command)}
                  className="justify-start h-auto p-3 text-left"
                >
                  <div>
                    <div className="font-medium text-sm">{cmd.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {cmd.command}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card> */}

        {/* Main execution interface */}
        <Card className="glass border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-500" />
              Script Execution
            </CardTitle>
            <CardDescription>
              Execute commands or scripts on multiple servers simultaneously
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Server Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Badge variant="outline">{selectedServers.length}</Badge>
                  Target Servers
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={connectedServers.length === 0}
                  >
                    {selectedServers.length === connectedServers.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
              </div>

              {connectedServers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No connected servers available</p>
                  <p className="text-sm">
                    Check your server connections in the Servers tab
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {connectedServers.map((server) => (
                    <div
                      key={server.id}
                      className={`flex items-center space-x-3 p-4 border rounded-lg transition-all hover:shadow-md cursor-pointer ${
                        selectedServers.includes(server.id)
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleServerToggle(server.id)}
                    >
                      <Checkbox
                        id={server.id}
                        checked={selectedServers.includes(server.id)}
                        onCheckedChange={() => handleServerToggle(server.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0 pointer-events-none">
                        <div className="font-medium">{server.name}</div>
                        <p className="text-sm text-muted-foreground font-mono truncate">
                          {server.username}@{server.hostname}:{server.port}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pointer-events-none">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            server?.status === "connected"
                              ? "bg-green-500 animate-pulse"
                              : "bg-red-500"
                          }`}
                        />
                        <Badge variant="outline" className="text-xs">
                          {server?.status === "connected"
                            ? "Online"
                            : "Offline"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Command/Script Input */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  Command or Script
                </Label>
                {command && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={copyCommand}>
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy command</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-4">
                {/* Command Input */}
                <div className="relative">
                  <Textarea
                    placeholder="Enter your command here...

Examples:
• sudo systemctl restart nginx
• docker ps -a
• npm install && npm run build
• find /var/log -name '*.log' -mtime -1"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    rows={8}
                    className="font-mono text-sm resize-none terminal-style"
                  />
                  {/* {command && !scriptFile && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">
                        Preview:
                      </div>
                      <pre
                        className="text-sm font-mono"
                        dangerouslySetInnerHTML={{
                          __html: syntaxHighlight(command),
                        }}
                      />
                    </div>
                  )} */}
                </div>

                {/* Script Upload Section */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      Or upload a shell script instead
                    </div>
                    {scriptFile && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          {scriptFile.name}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setScriptFile(null);
                            setCommand("");
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    )}
                  </div>

                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".sh"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {!scriptFile && (
                    <div
                      className={`text-center py-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                        isDragOver
                          ? "border-blue-500 bg-blue-50/50 text-blue-700"
                          : "border-muted-foreground/25 text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload
                        className={`h-8 w-8 mx-auto mb-2 ${
                          isDragOver
                            ? "opacity-100 text-blue-500"
                            : "opacity-50"
                        }`}
                      />
                      <p className="font-medium">
                        {isDragOver
                          ? "Drop your shell script here"
                          : "Upload a shell script (.sh file)"}
                      </p>
                      <p className="text-sm mt-1">
                        {isDragOver
                          ? "Release to upload"
                          : "Drag and drop or click to browse files"}
                      </p>
                      <p className="text-xs mt-2 opacity-75">
                        Maximum file size: 1MB
                      </p>
                    </div>
                  )}

                  {command && scriptFile && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Script Preview: {scriptFile.name}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {command.split("\n").length} lines
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {new Blob([command]).size} bytes
                          </Badge>
                        </div>
                      </div>
                      <div className="relative border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <span className="text-sm font-mono text-muted-foreground">
                              {scriptFile.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={copyCommand}
                          >
                            {copied ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <div className="max-h-64 overflow-y-auto bg-black/90 text-green-400">
                          <pre className="text-sm p-4 font-mono whitespace-pre-wrap leading-relaxed">
                            {command.split("\n").map((line, index) => (
                              <div key={index} className="flex">
                                <span className="text-muted-foreground/50 mr-4 select-none w-8 text-right">
                                  {index + 1}
                                </span>
                                <span className="flex-1">
                                  {renderHighlightedLine(line)}
                                </span>
                              </div>
                            ))}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Execution Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label htmlFor="arguments" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Arguments
                </Label>
                <Input
                  id="arguments"
                  value={arguments_}
                  onChange={(e) => setArguments(e.target.value)}
                  placeholder="--verbose --config=/path"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeout
                </Label>
                <Select
                  value={timeout.toString()}
                  onValueChange={(v) => setTimeoutState(Number.parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                    <SelectItem value="600">10 minutes</SelectItem>
                    <SelectItem value="1800">30 minutes</SelectItem>
                    <SelectItem value="3600">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Priority
                </Label>
                <Select
                  value={priority.toString()}
                  onValueChange={(v) => setPriority(Number.parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Lowest</SelectItem>
                    <SelectItem value="2">2 - Very Low</SelectItem>
                    <SelectItem value="3">3 - Low</SelectItem>
                    <SelectItem value="4">4 - Below Normal</SelectItem>
                    <SelectItem value="5">5 - Normal</SelectItem>
                    <SelectItem value="6">6 - Above Normal</SelectItem>
                    <SelectItem value="7">7 - High</SelectItem>
                    <SelectItem value="8">8 - Very High</SelectItem>
                    <SelectItem value="9">9 - Critical</SelectItem>
                    <SelectItem value="10">10 - Highest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Execute Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {isExecuting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span>
                      Submitting jobs to {selectedServers.length} server
                      {selectedServers.length !== 1 ? "s" : ""}...
                    </span>
                  </div>
                ) : selectedServers.length > 0 && command.trim() ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>
                      Ready to execute on {selectedServers.length} server
                      {selectedServers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {(command.trim() ||
                  selectedServers.length > 0 ||
                  arguments_.trim() ||
                  timeout !== 300 ||
                  priority !== 5) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={resetForm}
                        variant="outline"
                        disabled={isExecuting}
                        className="flex items-center gap-2"
                        size="lg"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear all form fields</TooltipContent>
                  </Tooltip>
                )}
                <Button
                  onClick={handleExecute}
                  disabled={
                    selectedServers.length === 0 ||
                    !command.trim() ||
                    isExecuting
                  }
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  size="lg"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Execute Script
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
