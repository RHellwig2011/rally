import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// BRIEF §3 "Buttons": 44px min-height, 10px radius, 600/14px Inter, spring
// transition, press to scale(.96). Primary is team red with an inset hairline
// plus a red drop-glow; hover lifts 2px and brightens. Focus is a red outline
// (the accent-green --ring is reserved for input focus): primary-300 at full
// alpha — #C8102E/55 was 1.68:1 on the night background (WCAG 2.2 SC 1.4.11
// wants >=3:1 for focus indicators); #F37287 is ~7:1 on the page and ~5.9:1
// on a #1B2334 card.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-semibold ring-offset-background transition-[transform,box-shadow,filter,background-color,color,border-color] duration-200 ease-spring active:scale-[.96] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,.12)_inset,0_8px_24px_rgba(200,16,46,.4)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,.16)_inset,0_12px_32px_rgba(200,16,46,.55)]",
        destructive:
          "bg-warning text-warning-foreground hover:-translate-y-0.5 hover:brightness-110",
        // Bordered neutral — BRIEF §3 calls this style "secondary"
        // (transparent, 1px foreground border, white/8 hover). `outline` is
        // the name the app's ~100 call sites actually use; `secondary` stays
        // as an alias so neither name silently loses its styling.
        outline:
          "border-foreground bg-transparent text-foreground hover:-translate-y-0.5 hover:bg-white/[0.08]",
        secondary:
          "border-foreground bg-transparent text-foreground hover:-translate-y-0.5 hover:bg-white/[0.08]",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        // Links are text: primary-300, not #C8102E (AA contrast on night).
        link: "text-primary-300 underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] px-5 py-2",
        sm: "min-h-[44px] rounded-lg px-3.5 text-[13px]",
        lg: "min-h-12 rounded-lg px-8 text-base",
        icon: "h-11 w-11 min-h-[44px] px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
