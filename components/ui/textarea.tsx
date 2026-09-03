import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Matches the Input treatment in BRIEF §3.
          "flex min-h-[80px] w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(14,124,90,.35)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-warning aria-[invalid=true]:shadow-[0_0_12px_rgba(180,35,24,.4)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
