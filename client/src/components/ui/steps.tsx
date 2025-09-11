import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

export type StepState = "incomplete" | "current" | "complete";

export interface Step {
  label: string;
  state: StepState;
}

export interface StepsProps {
  steps: Step[];
  className?: string;
}

export function Steps({ steps, className }: StepsProps) {
  return (
    <div className={cn("flex w-full justify-between", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                {
                  "border-border bg-background text-muted-foreground": step.state === "incomplete",
                  "border-primary bg-primary text-primary-foreground": step.state === "current" || step.state === "complete",
                }
              )}
            >
              {step.state === "complete" ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <div className="mt-2 text-center text-xs font-medium">
              {step.label}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className="flex flex-1 items-center">
              <div
                className={cn("h-[2px] w-full", {
                  "bg-border": step.state === "incomplete",
                  "bg-primary": step.state === "complete",
                  "bg-gradient-to-r from-primary to-border": step.state === "current",
                })}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}