"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUploadZone } from "@/components/file-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Key, Lock, Upload, FileText } from "lucide-react";
import type { Server } from "@/types";

interface ServerFormProps {
  initialData?: Server;
  onSubmit: (data: Omit<Server, "id">) => void;
}

export function ServerForm({ initialData, onSubmit }: ServerFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    hostname: initialData?.hostname || "",
    port: initialData?.port || 22,
    username: initialData?.username || "",
    authType: initialData?.authType || ("ssh-key" as const),
    sshKeyPath: initialData?.sshKeyPath || "",
    privateKeyContent: initialData?.privateKeyContent || "",
    password: "", // New field for password auth
    pem_file_url: initialData?.pem_file_url || "", // Add PEM file URL field
    status: initialData?.status || ("disconnected" as const),
  });

  const [authMethod, setAuthMethod] = useState<"file" | "content" | "password">(
    "file"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [keyFileContent, setKeyFileContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPemUrl, setUploadedPemUrl] = useState("");

  // Update auth method based on initial data
  useEffect(() => {
    if (initialData) {
      if (initialData.sshKeyPath) {
        setAuthMethod("file");
      } else if (initialData.privateKeyContent) {
        setAuthMethod("content");
        setKeyFileContent(initialData.privateKeyContent);
      }
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalData = { ...formData };

    // Set auth data based on selected method
    if (authMethod === "password") {
      finalData.authType = "password" as any; // Extend the type
      finalData.sshKeyPath = "";
      finalData.privateKeyContent = "";
    } else if (authMethod === "file") {
      finalData.authType = "ssh-key";
      finalData.privateKeyContent = "";
      // Use uploaded PEM URL if available, otherwise use sshKeyPath
      if (uploadedPemUrl) {
        finalData.pem_file_url = uploadedPemUrl;
        finalData.sshKeyPath = ""; // Clear local path since we're using uploaded file
      }
    } else if (authMethod === "content") {
      finalData.authType = "private-key";
      finalData.sshKeyPath = "";
      finalData.privateKeyContent = keyFileContent;
    }

    onSubmit(finalData);
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsUploading(true);
    
    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('pem_file', file);
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';
      const response = await fetch(`${serverUrl}/api/v1/pem-files/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload PEM file');
      }
      
      const result = await response.json();
      setUploadedPemUrl(result.pem_file_url);
      handleInputChange("sshKeyPath", file.name); // Store filename for display
      
      // Read file content for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setKeyFileContent(content);
      };
      reader.readAsText(file);
      
    } catch (error) {
      console.error('Upload failed:', error);
      // Handle upload error - could show a toast notification here
      alert('Failed to upload PEM file. Please try again.');
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setKeyFileContent("");
    setUploadedPemUrl("");
    handleInputChange("sshKeyPath", "");
  };

  const getAuthMethodIcon = (method: string) => {
    switch (method) {
      case "file":
        return <Upload className="h-4 w-4" />;
      case "content":
        return <FileText className="h-4 w-4" />;
      case "password":
        return <Lock className="h-4 w-4" />;
      default:
        return <Key className="h-4 w-4" />;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Server Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/10 p-1">
              <Key className="h-4 w-4 text-blue-500" />
            </div>
            Server Details
          </CardTitle>
          <CardDescription>
            Configure the basic connection details for your server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Production Web Server"
                required
                className="transition-all duration-200 focus:scale-105"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostname">Hostname/IP *</Label>
              <Input
                id="hostname"
                value={formData.hostname}
                onChange={(e) => handleInputChange("hostname", e.target.value)}
                placeholder="192.168.1.100 or server.example.com"
                required
                className="transition-all duration-200 focus:scale-105"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="port">SSH Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) =>
                  handleInputChange("port", Number.parseInt(e.target.value))
                }
                placeholder="22"
                min="1"
                max="65535"
                required
                className="transition-all duration-200 focus:scale-105"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                placeholder="ubuntu, admin, root"
                required
                className="transition-all duration-200 focus:scale-105"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-green-500/10 p-1">
              <Lock className="h-4 w-4 text-green-500" />
            </div>
            Authentication
          </CardTitle>
          <CardDescription>
            Choose how to authenticate with your server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authentication Method Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Authentication Method
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  value: "file",
                  label: "SSH Key File",
                  desc: "Upload .pem or .key file",
                },
                {
                  value: "content",
                  label: "Private Key",
                  desc: "Paste key content",
                },
                {
                  value: "password",
                  label: "Password",
                  desc: "Username & password",
                },
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setAuthMethod(method.value as any)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-left hover:scale-105 ${
                    authMethod === method.value
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        authMethod === method.value
                          ? "bg-primary/10"
                          : "bg-muted/50"
                      }`}
                    >
                      {getAuthMethodIcon(method.value)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{method.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {method.desc}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Authentication Content */}
          <div className="space-y-4">
            {authMethod === "file" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>SSH Key File</Label>
                  <FileUploadZone
                    onFileSelect={handleFileSelect}
                    onFileRemove={handleFileRemove}
                    selectedFile={selectedFile}
                    accept=".pem,.key,.ppk,.pub"
                    maxSize={5}
                  />
                  {isUploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Uploading PEM file...
                    </div>
                  )}
                  {uploadedPemUrl && !isUploading && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-white"></div>
                      </div>
                      File uploaded successfully
                    </div>
                  )}
                </div>

                {/* Alternative: Manual path input */}
                <div className="space-y-2">
                  <Label htmlFor="sshKeyPath">
                    Or enter file path manually
                  </Label>
                  <Input
                    id="sshKeyPath"
                    value={formData.sshKeyPath}
                    onChange={(e) =>
                      handleInputChange("sshKeyPath", e.target.value)
                    }
                    placeholder="/home/user/.ssh/id_rsa or /path/to/key.pem"
                    className="transition-all duration-200 focus:scale-105"
                  />
                </div>

                {/* Key preview */}
                {keyFileContent && (
                  <div className="space-y-2">
                    <Label>Key Preview</Label>
                    <div className="p-3 bg-muted/50 rounded-lg border max-h-32 overflow-y-auto">
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                        {keyFileContent.substring(0, 200)}
                        {keyFileContent.length > 200 && "..."}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {authMethod === "content" && (
              <div className="space-y-2">
                <Label htmlFor="privateKeyContent">Private Key Content *</Label>
                <Textarea
                  id="privateKeyContent"
                  value={keyFileContent}
                  onChange={(e) => setKeyFileContent(e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  rows={8}
                  required
                  className="font-mono text-sm transition-all duration-200 focus:scale-105"
                />
                <p className="text-xs text-muted-foreground">
                  Paste your complete private key including the BEGIN and END
                  lines
                </p>
              </div>
            )}

            {authMethod === "password" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      placeholder="Enter server password"
                      required
                      className="pr-10 transition-all duration-200 focus:scale-105"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        Security Note
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                        SSH key authentication is more secure than password
                        authentication. Consider using SSH keys for production
                        servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          className="transition-all duration-200 hover:scale-105 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          size="lg"
        >
          {initialData ? "Update Server" : "Add Server"}
        </Button>
      </div>
    </form>
  );
}
