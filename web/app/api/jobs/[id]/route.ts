import { type NextRequest, NextResponse } from "next/server"

// Mock jobs data (same as in jobs/route.ts - in production use shared database)
let jobs = [
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
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// DELETE /api/jobs/[id] - Delete job
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await delay(100 + Math.random() * 200)

    const initialLength = jobs.length
    jobs = jobs.filter((j) => j.id !== params.id)

    if (jobs.length === initialLength) {
      return NextResponse.json(
        {
          success: false,
          error: "Job not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
      message: "Job deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete job",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// PATCH /api/jobs/[id] - Update job (for cancellation)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await delay(150 + Math.random() * 250)

    const jobIndex = jobs.findIndex((j) => j.id === params.id)

    if (jobIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Job not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    const body = await request.json()

    // Handle job cancellation
    if (body.action === "cancel") {
      if (jobs[jobIndex].status !== "running") {
        return NextResponse.json(
          {
            success: false,
            error: "Only running jobs can be cancelled",
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        )
      }

      jobs[jobIndex] = {
        ...jobs[jobIndex],
        status: "cancelled",
        duration: jobs[jobIndex].duration || 0,
      }

      return NextResponse.json({
        success: true,
        data: jobs[jobIndex],
        timestamp: new Date().toISOString(),
        message: "Job cancelled successfully",
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
        timestamp: new Date().toISOString(),
      },
      { status: 400 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update job",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
