"use client"

import { memo } from "react"
import { Edit, Trash2, Wifi, WifiOff, AlertCircle, Shield, Key, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { Server } from "@/types"
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

interface AnimatedServerRowProps {
  server: Server
  onEdit: (server: Server) => void
  onDelete: (id: string) => void
  onTestConnection?: (serverId: string) => void
}

export const AnimatedServerRow = memo(function AnimatedServerRow({
  server,
  onEdit,
  onDelete,
  onTestConnection,
}: AnimatedServerRowProps) {
  const getStatusIcon = (status: Server["status"]) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />
      case "disconnected":
        return <WifiOff className="h-4 w-4 text-gray-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: Server["status"]) => {
    const config = {
      connected: {
        variant: "default" as const,
        className: "bg-green-500 hover:bg-green-600 transition-colors duration-200",
      },
      disconnected: { variant: "secondary" as const, className: "transition-colors duration-200" },
      error: { variant: "destructive" as const, className: "transition-colors duration-200" },
    }

    const { variant, className } = config[status]

    return (
      <Badge variant={variant} className={`capitalize ${className}`}>
        {status}
      </Badge>
    )
  }

  const getAuthIcon = (authType: Server["authType"]) => {
    switch (authType) {
      case "ssh-key":
        return <Key className="h-4 w-4" />
      case "private-key":
        return <Shield className="h-4 w-4" />
      case "password":
        return <Lock className="h-4 w-4" />
      default:
        return <Key className="h-4 w-4" />
    }
  }

  const getAuthLabel = (authType: Server["authType"]) => {
    switch (authType) {
      case "ssh-key":
        return "SSH Key"
      case "private-key":
        return "Private Key"
      case "password":
        return "Password"
      default:
        return "SSH Key"
    }
  }

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
          <div className="transition-transform duration-200 hover:scale-110">{getStatusIcon(server.status)}</div>
          {getStatusBadge(server.status)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="transition-transform duration-200 hover:scale-110">{getAuthIcon(server.authType)}</div>
          <span className="capitalize">{getAuthLabel(server.authType)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="transition-all duration-200 hover:scale-105 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Server</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{server.name}"? This action cannot be undone and will also remove all
                  associated jobs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(server.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  )
})
