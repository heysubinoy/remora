import { NextResponse } from "next/server"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// GET /api/system/stats - Get system statistics
export async function GET() {
  try {
    await delay(100 + Math.random() * 150)

    // Mock statistics with some randomization
    const baseStats = {
      totalServers: 4,
      connectedServers: 2 + Math.floor(Math.random() * 3), // 2-4
      runningJobs: Math.floor(Math.random() * 5), // 0-4
      completedJobs: 15 + Math.floor(Math.random() * 10), // 15-24
      failedJobs: Math.floor(Math.random() * 3), // 0-2
    }

    // Add some derived metrics
    const stats = {
      ...baseStats,
      connectionRate: Math.round((baseStats.connectedServers / baseStats.totalServers) * 100),
      totalJobs: baseStats.runningJobs + baseStats.completedJobs + baseStats.failedJobs,
      successRate: Math.round((baseStats.completedJobs / (baseStats.completedJobs + baseStats.failedJobs)) * 100) || 0,
    }

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      message: "System statistics retrieved",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch system statistics",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
