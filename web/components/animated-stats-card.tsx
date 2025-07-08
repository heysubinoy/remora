"use client"

import { memo } from "react"
import type { LucideIcon } from "lucide-react"

interface AnimatedStatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  color: string
  bgColor: string
}

export const AnimatedStatsCard = memo(function AnimatedStatsCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
}: AnimatedStatsCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-105 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg ${bgColor} p-2 transition-transform duration-200 hover:scale-110`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold transition-all duration-500 ease-out">{value}</p>
          <p className="text-sm text-muted-foreground transition-colors duration-200">{title}</p>
        </div>
      </div>
    </div>
  )
})
