import { type NextRequest, NextResponse } from "next/server"
import type { Server } from "@/types"

// In-memory storage for demo (in production, use a database)
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

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// GET /api/servers - Fetch all servers
export async function GET() {
  try {
    // Simulate API delay
    await delay(200 + Math.random() * 300)

    // Randomly update some server statuses to simulate real-time changes
    servers = servers.map((server) => {
      if (Math.random() > 0.9) {
        // 10% chance to change status
        const statuses: Server["status"][] = ["connected", "disconnected", "error"]
        const currentIndex = statuses.indexOf(server.status)
        const newStatus = statuses[(currentIndex + 1) % statuses.length]
        return { ...server, status: newStatus }
      }
      return server
    })

    return NextResponse.json({
      success: true,
      data: servers,
      timestamp: new Date().toISOString(),
      message: `Retrieved ${servers.length} servers`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch servers",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// POST /api/servers - Create new server
export async function POST(request: NextRequest) {
  try {
    await delay(300 + Math.random() * 500)

    const body = await request.json()

    // Validate required fields
    const requiredFields = ["name", "hostname", "username", "authType"]
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        )
      }
    }

    // Validate authentication data
    if (body.authType === "ssh-key" && !body.sshKeyPath) {
      return NextResponse.json(
        {
          success: false,
          error: "SSH key path is required for ssh-key authentication",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    if (body.authType === "private-key" && !body.privateKeyContent) {
      return NextResponse.json(
        {
          success: false,
          error: "Private key content is required for private-key authentication",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    if (body.authType === "password" && !body.password) {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required for password authentication",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    // Create new server
    const newServer: Server = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: body.name,
      hostname: body.hostname,
      port: body.port || 22,
      username: body.username,
      authType: body.authType,
      sshKeyPath: body.sshKeyPath || undefined,
      privateKeyContent: body.privateKeyContent || undefined,
      password: body.password || undefined,
      status: "disconnected", // New servers start disconnected
    }

    servers.push(newServer)

    // Simulate connection attempt after a delay
    setTimeout(() => {
      const serverIndex = servers.findIndex((s) => s.id === newServer.id)
      if (serverIndex !== -1) {
        // 80% chance of successful connection
        servers[serverIndex].status = Math.random() > 0.2 ? "connected" : "error"
      }
    }, 2000)

    return NextResponse.json(
      {
        success: true,
        data: newServer,
        timestamp: new Date().toISOString(),
        message: "Server created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create server",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
