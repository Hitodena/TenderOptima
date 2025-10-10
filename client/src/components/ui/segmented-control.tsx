import * as React from "react"
import { cn } from "@/lib/utils"

interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function SegmentedControl({ 
  value, 
  onValueChange, 
  options, 
  className 
}: SegmentedControlProps) {
  return (
    <div className={cn(
      "flex items-center gap-8",
      className
    )}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "relative px-1 py-2 text-sm transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "border-b-3 border-transparent",
            value === option.value
              ? "text-primary font-bold border-b-primary"
              : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
