"use client";

import { memo, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

interface AnimatedStatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

// Hook for smooth number animation
function useAnimatedValue(targetValue: number, duration: number = 1000) {
  const [currentValue, setCurrentValue] = useState(targetValue);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (currentValue === targetValue) return;

    setIsAnimating(true);
    const startValue = currentValue;
    const difference = targetValue - startValue;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newValue = Math.round(startValue + difference * easeOut);

      setCurrentValue(newValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration, currentValue]);

  return { value: currentValue, isAnimating };
}

export const AnimatedStatsCard = memo(function AnimatedStatsCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
}: AnimatedStatsCardProps) {
  const { value: animatedValue, isAnimating } = useAnimatedValue(value, 800);

  return (
    <div className="bg-card border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-105 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-lg ${bgColor} p-2 transition-transform duration-200 hover:scale-110 ${
            isAnimating ? "animate-pulse" : ""
          }`}
        >
          <Icon className={`h-5 w-5 ${color} transition-all duration-300`} />
        </div>
        <div>
          <p
            className={`text-2xl font-bold transition-all duration-300 ${
              isAnimating ? "text-primary" : ""
            }`}
          >
            {animatedValue}
          </p>
          <p className="text-sm text-muted-foreground transition-colors duration-200">
            {title}
          </p>
        </div>
      </div>
    </div>
  );
});
