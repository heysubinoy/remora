"use client";

import { memo, useState } from "react";
import {
  Edit,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  Shield,
  Key,
  Lock,
  AlertTriangle,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Server } from "@/types";
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

interface AnimatedServerRowProps {
  server: Server;
  onEdit: (server: Server) => void;
  onDelete: (id: string, force?: boolean) => void;
  onTestConnection?: (serverId: string) => void;
}

export const AnimatedServerRow = memo(function AnimatedServerRow({
  server,
  onEdit,
  onDelete,
  onTestConnection,
}: AnimatedServerRowProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      await onDelete(server.id, forceDelete);
      setIsDeleteDialogOpen(false);
      setForceDelete(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete server";
      setDeleteError(errorMessage);
      
      // If error mentions job history or active jobs, show force option
      if (errorMessage.includes("job history") || errorMessage.includes("active jobs")) {
        // Error will be displayed in dialog, user can then check force delete
      } else {
        // For other errors, close dialog and show error via toast (handled by parent)
        setIsDeleteDialogOpen(false);
        setForceDelete(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };
  const getStatusIcon = (status?: Server["status"]) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "disconnected":
        return <WifiOff className="h-4 w-4 text-gray-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status?: Server["status"]) => {
    const config = {
      connected: {
        variant: "default" as const,
        className:
          "bg-green-500 hover:bg-green-600 transition-colors duration-200",
      },
      disconnected: {
        variant: "secondary" as const,
        className: "transition-colors duration-200",
      },
      error: {
        variant: "destructive" as const,
        className: "transition-colors duration-200",
      },
    };

    const effectiveStatus = status || "disconnected";
    const { variant, className } = config[effectiveStatus];

    return (
      <Badge variant={variant} className={`capitalize ${className}`}>
        {effectiveStatus}
      </Badge>
    );
  };

  const getAuthIcon = (authType: Server["authType"]) => {
    switch (authType) {
      case "ssh-key":
        return <Key className="h-4 w-4" />;
      case "private-key":
        return <Shield className="h-4 w-4" />;
      case "password":
        return <Lock className="h-4 w-4" />;
      default:
        return <Key className="h-4 w-4" />;
    }
  };

  const getAuthLabel = (authType: Server["authType"]) => {
    switch (authType) {
      case "ssh-key":
        return "SSH Key";
      case "private-key":
        return "Private Key";
      case "password":
        return "Password";
      default:
        return "SSH Key";
    }
  };

  return (
    <TableRow
      key={server.id}
      className="transition-all duration-300 hover:bg-muted/50 animate-in fade-in-0 slide-in-from-left-1"
    >
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="transition-colors duration-200">{server.name}</span>
          <span className="text-sm text-muted-foreground font-mono">
            {server.username}@{server.hostname}:{server.port}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 transition-all duration-300">
          <div className="transition-transform duration-200 hover:scale-110">
            {getStatusIcon(server.status)}
          </div>
          {getStatusBadge(server.status)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="transition-transform duration-200 hover:scale-110">
            {getAuthIcon(server.authType)}
          </div>
          <span className="capitalize">{getAuthLabel(server.authType)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(server)}
            className="transition-all duration-200 hover:scale-105"
          >
            <Edit className="h-4 w-4" />
          </Button>

          {onTestConnection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTestConnection(server.id)}
              className="transition-all duration-200 hover:scale-105"
            >
              <Wifi className="h-4 w-4" />
            </Button>
          )}

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="transition-all duration-200 hover:scale-105 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Delete Server
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Are you sure you want to delete <strong>"{server.name}"</strong>?
                  </p>
                  
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Database className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          Job Deletion Warning
                        </p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                          This will also delete all job history associated with this server.
                          Active or running jobs will prevent deletion unless forced.
                        </p>
                      </div>
                    </div>
                  </div>

                  {deleteError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-red-800 dark:text-red-200">
                            Deletion Failed
                          </p>
                          <p className="text-red-700 dark:text-red-300 text-xs mt-1">
                            {deleteError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(deleteError?.includes("job history") || deleteError?.includes("active jobs")) && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="force-delete"
                        checked={forceDelete}
                        onCheckedChange={(checked) => setForceDelete(checked as boolean)}
                      />
                      <label
                        htmlFor="force-delete"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Force delete (remove all jobs)
                      </label>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={() => {
                    setDeleteError(null);
                    setForceDelete(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>Delete Server</>
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
});
