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
  hideWhenVisibleId,
  feeLine,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: {
  /** Id of the give block to watch; the bar appears once it scrolls past. */
  watchId: string;
  /**
   * Id of an element that suppresses the bar while it is on screen — e.g. the
   * live donation form on the athlete page, which sits BELOW the watched give
   * block, so without this the bar would hover over the card form the donor
   * is filling in.
   */
  hideWhenVisibleId?: string;
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
    const suppressor = hideWhenVisibleId
      ? document.getElementById(hideWhenVisibleId)
      : null;

    // A plain scroll listener, not IntersectionObserver: IO only fires when
    // the intersection RATIO changes, so a give block that starts below the
    // fold and scrolls off the top (0% → 0%) never triggers a callback.
    // bottom < 0 is the whole rule — only when it scrolled off the TOP.
    const update = () => {
      const past = target.getBoundingClientRect().bottom < 0;
      // The suppressor counts as "in use" once its top is into the upper 60%
      // of the viewport — the donor is looking at the form, so the redundant
      // CTA bar gets out of the way. (A bottom-edge threshold would suppress
      // the bar the instant the form peeks into view, which on short pages
      // kills the bar entirely.)
      const suppressed = suppressor
        ? suppressor.getBoundingClientRect().top < window.innerHeight * 0.6
        : false;
      setOn(past && !suppressed);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [watchId, hideWhenVisibleId]);

  return (
    <div
      aria-hidden={!on}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(10,13,20,.94)] backdrop-blur-[10px]",
        // Stadium ease for the slide: the spring overshoots past y=0 mid-
        // transition, briefly exposing page content under a bar that is
        // supposed to sit flush on the bottom edge.
        "transition-transform duration-500 ease-stadium motion-reduce:transition-none lg:hidden",
        on ? "translate-y-0" : "translate-y-full"
      )}
    >
      {/* max() keeps the CTA clear of the iOS home indicator. */}
      <div className="mx-auto max-w-[480px] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
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
