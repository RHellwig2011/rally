import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  // BRIEF §4 screen 11 "edge states": soft tinted backgrounds on the night
  // shell — error rgba(242,97,75,.08), warning rgba(232,163,61,.08) — rather
  // than the light-theme yellow-50/green-50 fills.
  "relative w-full rounded-[12px] border border-white/10 p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-white/[0.04] text-foreground",
        destructive:
          "border-destructive/40 bg-[rgba(242,97,75,.08)] text-destructive [&>svg]:text-destructive",
        warning:
          "border-[rgba(232,163,61,.45)] bg-[rgba(232,163,61,.08)] text-[var(--bb-warning)] [&>svg]:text-[var(--bb-warning)]",
        success:
          "border-secondary/40 bg-[rgba(34,196,139,.08)] text-success-dark [&>svg]:text-success-dark",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-display font-bold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
