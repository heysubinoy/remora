"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play } from "lucide-react";
import { Server as APIServer, JobRequest } from "@/lib/api";

interface JobFormProps {
  servers: APIServer[];
  jobForm: JobRequest & { timeout: number };
  jobErrors: Record<string, string>;
  hasJobErrors: boolean;
  onValueChange: (field: string, value: any) => void;
  onSubmit: () => void;
}

export function JobForm({
  servers,
  jobForm,
  jobErrors,
  hasJobErrors,
  onValueChange,
  onSubmit,
}: JobFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Submit New Job
        </CardTitle>
        <CardDescription>Execute commands on remote servers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="server">Target Server</Label>
            <Select
              value={jobForm.server_id}
              onValueChange={(value) => onValueChange("server_id", value)}
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
              <p className="text-sm text-red-600">{jobErrors.server_id}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (seconds)</Label>
            <Input
              id="timeout"
              type="number"
              value={jobForm.timeout}
              onChange={(e) =>
                onValueChange("timeout", parseInt(e.target.value) || 300)
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
            onChange={(e) => onValueChange("command", e.target.value)}
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
            onChange={(e) => onValueChange("args", e.target.value)}
            placeholder="e.g., -la, --help, status nginx"
          />
        </div>

        <Button
          onClick={onSubmit}
          className="w-full"
          disabled={hasJobErrors || !jobForm.server_id || !jobForm.command}
        >
          <Play className="w-4 h-4 mr-2" />
          Execute Job
        </Button>
      </CardContent>
    </Card>
  );
}
