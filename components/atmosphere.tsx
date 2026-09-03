/**
 * Stadium atmosphere layers — BRIEF §1 "Atmosphere (every night screen)".
 *
 * Three fixed, non-interactive overlays mounted once in app/layout.tsx so every
 * route gets them. All are `pointer-events-none` and `aria-hidden`; none hold
 * state, so they stay server components.
 *
 * Stacking: the mockups order these glow < grain < content < top rule by
 * giving the page wrapper `z-index:2`. There is no such wrapper here, and an
 * in-flow non-positioned element always paints *below* a positioned sibling —
 * so Floodlights and Grain use negative z-index instead. `body` carries the
 * background and `html` does not, so the body background propagates to the
 * canvas and these layers still render on top of it. TopRule is z-[100],
 * above app chrome but below Radix overlays.
 */

/** Fixed 3px team-red rule with glow across the top of every screen. */
export function TopRule() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{
        background: "var(--bb-team)",
        boxShadow: "0 0 18px var(--bb-team)",
      }}
    />
  );
}

/** Floodlight glows: red from stage left, cool blue from stage right, green wash from below. */
export function Floodlights() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[-2]"
      style={{
        backgroundImage: [
          "radial-gradient(60% 34% at 10% -6%, rgba(200,16,46,.16), transparent 60%)",
          "radial-gradient(60% 34% at 90% -6%, rgba(70,120,255,.10), transparent 60%)",
          "radial-gradient(90% 50% at 50% 108%, rgba(34,196,139,.07), transparent 60%)",
        ].join(","),
      }}
    />
  );
}

/**
 * Film grain: an inline feTurbulence SVG data-URI tiled at 120x120.
 * The `#` in the URI is percent-encoded so it survives as a CSS url().
 */
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[-1] opacity-[0.05]"
      style={{ backgroundImage: GRAIN_URI }}
    />
  );
}

/** All three layers, in paint order. Mounted once at the root. */
export function Atmosphere() {
  return (
    <>
      <Floodlights />
      <Grain />
      <TopRule />
    </>
  );
}
