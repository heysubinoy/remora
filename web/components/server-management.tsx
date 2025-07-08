"use client"

import { TableCell } from "@/components/ui/table"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ServerForm } from "@/components/server-form"
import { AnimatedServerRow } from "@/components/animated-server-row"
import type { Server as ServerType } from "@/types"

interface ServerManagementProps {
  servers: ServerType[]
  onAdd: (server: Omit<ServerType, "id">) => void
  onUpdate: (id: string, updates: Partial<ServerType>) => void
  onDelete: (id: string) => void
  onTestConnection?: (serverId: string) => void
}

export function ServerManagement({ servers, onAdd, onUpdate, onDelete, onTestConnection }: ServerManagementProps) {
  const [editingServer, setEditingServer] = useState<ServerType | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const handleEdit = (server: ServerType) => {
    setEditingServer(server)
    setIsEditDialogOpen(true)
  }

  const handleAddSubmit = async (serverData: Omit<ServerType, "id">) => {
    await onAdd(serverData)
    setIsAddDialogOpen(false)
  }

  const handleEditSubmit = async (serverData: Omit<ServerType, "id">) => {
    if (editingServer) {
      await onUpdate(editingServer.id, serverData)
      setIsEditDialogOpen(false)
      setEditingServer(null)
    }
  }

  const connectedCount = servers.filter((s) => s.status === "connected").length
  const totalCount = servers.length

  return (
    <div className="space-y-6">
      <Card className="glass border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="transition-colors duration-200">Server Management</CardTitle>
              <CardDescription className="transition-colors duration-200">
                <span className="transition-all duration-300">
                  {connectedCount} of {totalCount} servers are connected
                </span>
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="transition-all duration-200 hover:scale-105">
              <Plus className="mr-2 h-4 w-4" /> Add Server
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Server Details</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Authentication</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="text-4xl opacity-50">🖥️</div>
                        <p>No servers configured</p>
                        <p className="text-sm">Add your first server to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  servers.map((server) => (
                    <AnimatedServerRow
                      key={server.id}
                      server={server}
                      onEdit={handleEdit}
                      onDelete={onDelete}
                      onTestConnection={onTestConnection}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Server</DialogTitle>
          </DialogHeader>
          <ServerForm onSubmit={handleAddSubmit} />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Server</DialogTitle>
          </DialogHeader>
          {editingServer && <ServerForm initialData={editingServer} onSubmit={handleEditSubmit} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
