"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Server as APIServer, ServerRequest } from "@/lib/api";

interface ServerFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingServer: APIServer | null;
  serverForm: ServerRequest;
  serverErrors: Record<string, string>;
  hasServerErrors: boolean;
  onValueChange: (field: string, value: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ServerForm({
  isOpen,
  onOpenChange,
  editingServer,
  serverForm,
  serverErrors,
  hasServerErrors,
  onValueChange,
  onSubmit,
  onCancel,
}: ServerFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                onChange={(e) => onValueChange("name", e.target.value)}
                placeholder="Production Server"
              />
              {serverErrors.name && (
                <p className="text-sm text-red-600">{serverErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostname">Hostname/IP</Label>
              <Input
                id="hostname"
                value={serverForm.hostname}
                onChange={(e) => onValueChange("hostname", e.target.value)}
                placeholder="192.168.1.100"
              />
              {serverErrors.hostname && (
                <p className="text-sm text-red-600">{serverErrors.hostname}</p>
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
                  onValueChange("port", parseInt(e.target.value) || 22)
                }
                placeholder="22"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">Username</Label>
              <Input
                id="user"
                value={serverForm.user}
                onChange={(e) => onValueChange("user", e.target.value)}
                placeholder="ubuntu"
              />
              {serverErrors.user && (
                <p className="text-sm text-red-600">{serverErrors.user}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth_type">Authentication Type</Label>
            <Select
              value={serverForm.auth_type}
              onValueChange={(value) => onValueChange("auth_type", value)}
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
                onChange={(e) => onValueChange("password", e.target.value)}
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
                  onChange={(e) => onValueChange("pem_file", e.target.value)}
                  placeholder="./path/to/key.pem"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="private_key">Or Private Key Content</Label>
                <Textarea
                  id="private_key"
                  value={serverForm.private_key || ""}
                  onChange={(e) => onValueChange("private_key", e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----..."
                  rows={4}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={hasServerErrors}>
              {editingServer ? "Update Server" : "Add Server"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
