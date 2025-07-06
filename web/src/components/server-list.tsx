"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Server,
  Wifi,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Server as APIServer } from "@/lib/api";
import { ServerForm } from "./server-form";

interface ServerListProps {
  servers: APIServer[];
  loading: boolean;
  isServerDialogOpen: boolean;
  onServerDialogOpenChange: (open: boolean) => void;
  editingServer: APIServer | null;
  serverForm: any;
  serverErrors: Record<string, string>;
  hasServerErrors: boolean;
  onServerValueChange: (field: string, value: any) => void;
  onSubmitServer: () => void;
  onCancelServer: () => void;
  onEditServer: (server: APIServer) => void;
  onDeleteServer: (serverId: string) => void;
  onTestConnection: (serverId: string) => void;
}

export function ServerList({
  servers,
  loading,
  isServerDialogOpen,
  onServerDialogOpenChange,
  editingServer,
  serverForm,
  serverErrors,
  hasServerErrors,
  onServerValueChange,
  onSubmitServer,
  onCancelServer,
  onEditServer,
  onDeleteServer,
  onTestConnection,
}: ServerListProps) {
  const getStatusBadge = (isActive: boolean) => {
    const status = isActive ? "online" : "offline";
    const variants = {
      online: "bg-green-100 text-green-800 border-green-200",
      offline: "bg-red-100 text-red-800 border-red-200",
    };

    const icons = {
      online: <CheckCircle className="w-3 h-3" />,
      offline: <XCircle className="w-3 h-3" />,
    };

    return (
      <Badge
        className={`${
          variants[status as keyof typeof variants]
        } flex items-center gap-1`}
      >
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
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
        <ServerForm
          isOpen={isServerDialogOpen}
          onOpenChange={onServerDialogOpenChange}
          editingServer={editingServer}
          serverForm={serverForm}
          serverErrors={serverErrors}
          hasServerErrors={hasServerErrors}
          onValueChange={onServerValueChange}
          onSubmit={onSubmitServer}
          onCancel={onCancelServer}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
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
                    <TableCell className="font-medium">{server.name}</TableCell>
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
                      <Badge variant="outline">{server.auth_type}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(server.is_active)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onTestConnection(server.id)}
                        >
                          <Wifi className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditServer(server)}
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
                              <AlertDialogTitle>Delete Server</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{server.name}"?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteServer(server.id)}
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
  );
}
