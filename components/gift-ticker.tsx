/**
 * Gift ticker — BRIEF §3 "Ticker / marquee" and §4 screen 01.
 *
 * A bordered strip of live campaign items (recent gifts, donor count, days
 * left) scrolling in a seamless loop. The track renders the same sequence
 * twice and the `marquee` keyframe (tailwind.config) translates it exactly
 * -50%, so the loop has no seam. Pauses on hover; reduced motion stops it.
 *
 * The strip is `aria-hidden`: every item it shows also appears in the page
 * body (gifts feed, stat grid, bar meta), so screen readers lose nothing.
 */
import React from "react";

export interface GiftTickerItem {
  /** The bold ink value, e.g. "$50" or "8 days". */
  bold: string;
  /** Muted text before the value, e.g. the donor name in "Dana P. $50". */
  before?: string;
  /** Muted text after the value, e.g. "left" in "8 days left". */
  after?: string;
}

/** Minimum sequence length per half so short lists still fill wide screens. */
const MIN_SEQUENCE = 6;

export function GiftTicker({ items }: { items: GiftTickerItem[] }) {
  if (items.length === 0) return null;

  // Repeat short lists so one half of the track is always wider than the
  // viewport — otherwise the -50% loop exposes a gap.
  const sequence: GiftTickerItem[] = [];
  while (sequence.length < MIN_SEQUENCE) {
    sequence.push(...items);
  }

  const renderSequence = (half: string) =>
    sequence.map((item, i) => (
      <React.Fragment key={`${half}-${i}`}>
        <span className="whitespace-nowrap py-[9px] text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {item.before && <>{item.before} </>}
          <b className="font-semibold text-foreground">{item.bold}</b>
          {item.after && <> {item.after}</>}
        </span>
        <span aria-hidden="true" className="px-3.5 py-[9px] text-[11px] text-primary">
          •
        </span>
      </React.Fragment>
    ));

  return (
    <div
      aria-hidden="true"
      className="group relative z-10 overflow-hidden border-b border-white/10 bg-[#0A0D14]"
    >
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {renderSequence("a")}
        {renderSequence("b")}
      </div>
    </div>
  );
}
