import { type NextRequest, NextResponse } from "next/server"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// POST /api/servers/[id]/test-connection - Test server connection
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Simulate connection test delay (1-3 seconds)
    await delay(1000 + Math.random() * 2000)

    // Simulate connection test results
    const connectionSuccess = Math.random() > 0.2 // 80% success rate
    const responseTime = Math.floor(50 + Math.random() * 200) // 50-250ms

    if (connectionSuccess) {
      return NextResponse.json({
        success: true,
        data: {
          status: "connected",
          responseTime,
          timestamp: new Date().toISOString(),
          details: {
            sshVersion: "OpenSSH_8.9p1",
            serverInfo: "Ubuntu 22.04.3 LTS",
            lastLogin: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          },
        },
        message: `Connection successful (${responseTime}ms)`,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Simulate various connection errors
      const errors = [
        "Connection timeout",
        "Authentication failed",
        "Host unreachable",
        "Permission denied",
        "Port closed",
      ]
      const error = errors[Math.floor(Math.random() * errors.length)]

      return NextResponse.json(
        {
          success: false,
          data: {
            status: "error",
            error,
            timestamp: new Date().toISOString(),
          },
          message: `Connection failed: ${error}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Connection test failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
