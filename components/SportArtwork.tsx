import type { CSSProperties } from "react";

/**
 * SportArtwork — designed placeholder art for campaigns without a photo.
 *
 * This is deliberately ILLUSTRATION, not photography: line-art equipment
 * motifs (basketball, soccer, track, music…) over a navy→green duotone with
 * the design system's diagonal-hatch texture. It exists so a card or hero
 * never falls back to a bare letter on a flat gradient.
 *
 * A real uploaded photo (campaign.bannerImageUrl) should always take priority
 * over this — see CampaignCard. When a coach adds team photos, they replace
 * this automatically.
 *
 * The motif is chosen deterministically from `seed` (the team name) so a given
 * campaign always shows the same art, and a wall of cards shows variety.
 */

type Motif = "basketball" | "soccer" | "track" | "whistle" | "music" | "star";

// Category → motif. SPORTS rotates through the athletic motifs by seed; the
// others get a fixed on-theme motif.
const SPORT_MOTIFS: Motif[] = ["basketball", "soccer", "track", "whistle"];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

function pickMotif(seed: string, category?: string): Motif {
  switch ((category || "").toUpperCase()) {
    case "ARTS":
      return "music";
    case "EDUCATION":
      return "star";
    case "COMMUNITY":
      return "whistle";
    case "SPORTS":
    case "OTHER":
    default:
      return SPORT_MOTIFS[hashSeed(seed) % SPORT_MOTIFS.length];
  }
}

/** Line-art path(s) for each motif, drawn in a 0 0 100 100 viewBox. */
function MotifPaths({ motif }: { motif: Motif }) {
  switch (motif) {
    case "basketball":
      return (
        <>
          <circle cx="50" cy="50" r="30" />
          <path d="M20 50h60M50 20v60M29 29c14 12 28 12 42 0M29 71c14-12 28-12 42 0" />
        </>
      );
    case "soccer":
      return (
        <>
          <circle cx="50" cy="50" r="30" />
          <path d="M50 34l11 8-4 13H43l-4-13z" />
          <path d="M50 20v14M61 42l12-6M57 55l8 12M43 55l-8 12M39 42l-12-6" />
        </>
      );
    case "track":
      return (
        <>
          {/* stylized converging lanes */}
          <path d="M18 82c8-30 20-48 32-48s24 18 32 48" />
          <path d="M30 82c6-22 12-36 20-36s14 14 20 36" />
          <path d="M44 82c2-14 4-24 6-24s4 10 6 24" />
        </>
      );
    case "whistle":
      return (
        <>
          <path d="M32 44h26a12 12 0 1 1-12 16H40a8 8 0 0 1-8-8z" />
          <path d="M58 44V34h10" />
          <circle cx="46" cy="56" r="4" />
        </>
      );
    case "music":
      return (
        <>
          <path d="M40 66V32l26-6v34" />
          <circle cx="34" cy="66" r="6" />
          <circle cx="60" cy="60" r="6" />
        </>
      );
    case "star":
    default:
      return <path d="M50 24l8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3z" />;
  }
}

export function SportArtwork({
  seed,
  category,
  className,
  style,
}: {
  seed: string;
  category?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const motif = pickMotif(seed, category);
  // Nudge the gradient angle by seed so adjacent cards differ slightly.
  const angle = 120 + (hashSeed(seed) % 40);

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(${angle}deg, #234C93 0%, #1D3F7C 55%, #15613F 100%)`,
        ...style,
      }}
      aria-hidden
    >
      {/* diagonal hatch — the design system's signature texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 14px)",
        }}
      />
      {/* the motif, oversized and bled off the right edge */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          right: "-8%",
          bottom: "-10%",
          width: "70%",
          height: "auto",
        }}
      >
        <MotifPaths motif={motif} />
      </svg>
    </div>
  );
}

export default SportArtwork;
