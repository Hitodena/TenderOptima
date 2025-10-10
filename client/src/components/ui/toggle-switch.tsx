import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  size?: "sm" | "md" | "lg"
}

export function ToggleSwitch({ 
  checked, 
  onCheckedChange, 
  disabled = false,
  className,
  size = "md"
}: ToggleSwitchProps) {
  const sizeClasses = {
    sm: "h-5 w-7",
    md: "h-6 w-9", 
    lg: "h-7 w-11"
  }

  const thumbSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary border-primary" : "bg-white border-gray-300",
        sizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full shadow-lg ring-0 transition-transform",
          checked ? "translate-x-4 bg-white" : "translate-x-0.5 bg-gray-300",
          thumbSizeClasses[size]
        )}
      />
    </button>
  )
}
