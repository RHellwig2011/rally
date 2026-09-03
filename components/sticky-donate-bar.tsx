"use client";

/**
 * Sticky bottom donate bar — BRIEF §4 screens 01/02 "sticky-bar".
 *
 * Hidden off-canvas until the watched give block (`watchId`) scrolls above
 * the viewport, then slides up with the spring easing and stays pinned: the
 * ask is never more than a thumb-reach away on a phone. Slides back down when
 * the real give block returns to view.
 *
 * Mobile-only (lg:hidden) — on desktop the sticky action column already keeps
 * a donate CTA on screen. While hidden the bar is aria-hidden and its CTA is
 * removed from the tab order.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StickyDonateBar({
  watchId,
  feeLine,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: {
  /** Id of the give block to watch; the bar appears once it scrolls past. */
  watchId: string;
  /** Small centered disclosure above the button, e.g. the $100 example net. */
  feeLine: string;
  ctaLabel: string;
  /** Navigate (team page) or scroll-into-view callback (athlete page). */
  ctaHref?: string;
  onCtaClick?: () => void;
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;

    // A plain scroll listener, not IntersectionObserver: IO only fires when
    // the intersection RATIO changes, so a give block that starts below the
    // fold and scrolls off the top (0% → 0%) never triggers a callback.
    // bottom < 0 is the whole rule — only when it scrolled off the TOP.
    const update = () => setOn(target.getBoundingClientRect().bottom < 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [watchId]);

  return (
    <div
      aria-hidden={!on}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(10,14,26,.94)] backdrop-blur-[10px]",
        "transition-transform duration-500 ease-spring motion-reduce:transition-none lg:hidden",
        on ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="mx-auto max-w-[480px] px-5 pb-3 pt-2.5">
        <p className="mb-2 text-center text-[11px] tabular text-muted-foreground">
          {feeLine}
        </p>
        {ctaHref ? (
          <Button asChild size="lg" className="h-12 w-full">
            <Link href={ctaHref} tabIndex={on ? 0 : -1}>
              <Heart className="mr-2 h-4 w-4" />
              {ctaLabel}
            </Link>
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 w-full"
            tabIndex={on ? 0 : -1}
            onClick={onCtaClick}
          >
            <Heart className="mr-2 h-4 w-4" />
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
