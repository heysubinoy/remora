import { type NextRequest, NextResponse } from "next/server"
import type { Job } from "@/types"

// In-memory storage for demo
let jobs: Job[] = [
  {
    id: "job-001",
    serverId: "srv-001",
    serverName: "Production Web Server",
    command: "sudo systemctl restart nginx && sudo systemctl status nginx",
    status: "completed",
    created: new Date("2024-01-15T10:30:00"),
    duration: 2.5,
    exitCode: 0,
  },
  {
    id: "job-002",
    serverId: "srv-002",
    serverName: "Development Server",
    command: "npm install && npm run build && npm run test",
    status: "running",
    created: new Date("2024-01-15T11:15:00"),
    duration: 45.2,
    exitCode: null,
  },
  {
    id: "job-003",
    serverId: "srv-001",
    serverName: "Production Web Server",
    command: "df -h && free -m && ps aux | head -20",
    status: "failed",
    created: new Date("2024-01-15T09:45:00"),
    duration: 1.1,
    exitCode: 1,
  },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// GET /api/jobs - Fetch all jobs
export async function GET() {
  try {
    await delay(150 + Math.random() * 200)

    // Update running jobs to simulate progress
    jobs = jobs.map((job) => {
      if (job.status === "running") {
        const newDuration = job.duration + 2 + Math.random() * 3

        // Some jobs might complete
        if (Math.random() > 0.8) {
          const exitCode = Math.random() > 0.8 ? 1 : 0
          return {
            ...job,
            status: exitCode === 0 ? "completed" : ("failed" as Job["status"]),
            duration: newDuration,
            exitCode,
          }
        }

        return { ...job, duration: newDuration }
      }
      return job
    })

    // Sort by creation date (newest first)
    const sortedJobs = [...jobs].sort((a, b) => b.created.getTime() - a.created.getTime())

    return NextResponse.json({
      success: true,
      data: sortedJobs,
      timestamp: new Date().toISOString(),
      message: `Retrieved ${jobs.length} jobs`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch jobs",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// POST /api/jobs - Execute new job
export async function POST(request: NextRequest) {
  try {
    await delay(300 + Math.random() * 400)

    const body = await request.json()
    const { serverIds, command, timeout, arguments: args } = body

    if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Server IDs are required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Command is required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    // Mock server data for job creation
    const mockServers = [
      { id: "srv-001", name: "Production Web Server" },
      { id: "srv-002", name: "Development Server" },
      { id: "srv-003", name: "Database Server" },
      { id: "srv-004", name: "Load Balancer" },
    ]

    const newJobs: Job[] = []

    for (const serverId of serverIds) {
      const server = mockServers.find((s) => s.id === serverId)
      if (!server) continue

      const finalCommand = args ? `${command} ${args}` : command

      const job: Job = {
        id: `job-${Date.now()}-${serverId}-${Math.random().toString(36).substr(2, 9)}`,
        serverId,
        serverName: server.name,
        command: finalCommand,
        status: "running",
        created: new Date(),
        duration: 0,
        exitCode: null,
      }

      newJobs.push(job)
      jobs.unshift(job) // Add to beginning
    }

    return NextResponse.json(
      {
        success: true,
        data: newJobs,
        timestamp: new Date().toISOString(),
        message: `Started ${newJobs.length} job(s)`,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute jobs",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
