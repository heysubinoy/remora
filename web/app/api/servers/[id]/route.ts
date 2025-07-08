import { type NextRequest, NextResponse } from "next/server"
import type { Server } from "@/types"

// Import the servers array (in production, use a database)
// For demo purposes, we'll recreate the initial data here
let servers: Server[] = [
  {
    id: "srv-001",
    name: "Production Web Server",
    hostname: "prod-web-01.example.com",
    port: 22,
    username: "ubuntu",
    authType: "ssh-key",
    sshKeyPath: "/home/user/.ssh/prod-key.pem",
    status: "connected",
  },
  {
    id: "srv-002",
    name: "Development Server",
    hostname: "192.168.1.100",
    port: 22,
    username: "dev",
    authType: "private-key",
    privateKeyContent: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA2K...\n-----END RSA PRIVATE KEY-----",
    status: "connected",
  },
  {
    id: "srv-003",
    name: "Database Server",
    hostname: "db-01.example.com",
    port: 2222,
    username: "admin",
    authType: "password",
    password: "hashed_password_123",
    status: "disconnected",
  },
  {
    id: "srv-004",
    name: "Load Balancer",
    hostname: "lb-01.example.com",
    port: 22,
    username: "root",
    authType: "ssh-key",
    sshKeyPath: "/home/user/.ssh/lb-key.pem",
    status: "error",
  },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// GET /api/servers/[id] - Get specific server
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await delay(100 + Math.random() * 200)

    const server = servers.find((s) => s.id === params.id)

    if (!server) {
      return NextResponse.json(
        {
          success: false,
          error: "Server not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: server,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch server",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// PUT /api/servers/[id] - Update server
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await delay(200 + Math.random() * 400)

    const serverIndex = servers.findIndex((s) => s.id === params.id)

    if (serverIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Server not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    const body = await request.json()

    // Update server with new data
    servers[serverIndex] = {
      ...servers[serverIndex],
      ...body,
      id: params.id, // Ensure ID doesn't change
    }

    return NextResponse.json({
      success: true,
      data: servers[serverIndex],
      timestamp: new Date().toISOString(),
      message: "Server updated successfully",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update server",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// DELETE /api/servers/[id] - Delete server
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await delay(150 + Math.random() * 250)

    const initialLength = servers.length
    servers = servers.filter((s) => s.id !== params.id)

    if (servers.length === initialLength) {
      return NextResponse.json(
        {
          success: false,
          error: "Server not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
      message: "Server deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete server",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
