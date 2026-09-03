import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // BRIEF §3 "Inputs": 44px tall, 10px radius, hairline border over a
          // rgba(255,255,255,.05) fill, focus flips the border to accent green
          // with a 3px deep-green halo (no offset ring).
          "flex h-11 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(14,124,90,.35)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-warning aria-[invalid=true]:shadow-[0_0_12px_rgba(180,35,24,.4)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
