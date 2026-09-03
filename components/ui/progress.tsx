import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  /** Accessible name for the progressbar (aria-label). */
  label?: string;
  /**
   * Merged onto the track element. The track's height lives here, not on the
   * outer wrapper — pass e.g. trackClassName="h-2" for a slimmer bar (a bare
   * className="h-2" on the wrapper leaves the 10px track overflowing).
   */
  trackClassName?: string;
  /**
   * BRIEF §3 "Progress bar": the fill is accent green by default, with a
   * team-red variant used by the main campaign/athlete goal bars. Small
   * roster/participation mini-bars stay on "accent".
   */
  variant?: "accent" | "team";
}

// Fill treatments per variant — colour plus the matching glow.
const FILL_VARIANTS: Record<"accent" | "team", string> = {
  accent: "bg-secondary shadow-glow-accent",
  team: "bg-primary shadow-[0_0_12px_rgba(200,16,46,.7)]",
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    { className, value, max = 100, showLabel = false, label, trackClassName, variant = "accent", ...props },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("relative", className)}
        {...props}
      >
        {/* BRIEF §3 "Progress bar": 10px track on rgba(255,255,255,.10),
            glowing fill, fully pill-rounded. */}
        <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-white/10", trackClassName)}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-stadium",
              FILL_VARIANTS[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <span className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
