# BBC v3 "Stadium" — Implementation Brief

Source: `.design-sync/bbc-v3/c-stadium/*.html` (13 self-contained mockups, inline CSS).
Target: restyle the Next.js 14 + Tailwind + shadcn/ui app to match. This brief is the
single source of truth — implementers should NOT need to open the HTML files.

The design is a **dark "stadium night" theme everywhere** in the product, with light
"paper" documents embedded inside it (pricing breakdowns, consent forms). The app's
current light navy/gray/green theme is replaced.

---

## 1. DESIGN TOKENS

### Canonical night palette (use these exact values)

| Role | Value | Notes |
|---|---|---|
| page bg | `#0A0D14` | `--night`; some screens use `#070A12` / `#080B12` — treat as equivalent, standardize on `#0A0D14` |
| surface (card base) | `#12161F` | `--surface` |
| surface-2 (card top/raised) | `#181E2A` | `--surface2`; gradient cards run surface2 → surface |
| night2/night3 (alt gradient) | `#121826` / `#1B2334` | used by style-tile/component-sheet gradient cards |
| border (on dark) | `#262E3D` | subtle; some files use `#1F2740` / `#232C40` — standardize `#262E3D` |
| hairline (on dark) | `rgba(255,255,255,.10)` | `--line` on style-tile/components |
| text primary | `#EEF1F6` | `--ink`/`--txt` |
| text muted | `#8B93A3` | `--muted`/`--dim` |
| team red (brand) | `#C8102E` | `--team` — primary CTA, top rules, glows. Hot variant `#FF2E4D` (marketing only) |
| accent green | `#22C48B` | `--accent` — success/money-positive. Variants seen: `#2FBF8F`, `#2FD39A`, `#3ECF9C` (bright, for glowing totals), deep `#0E7C5A` |
| error | `#F2614B` | variants `#F0604F`, `#E5484D`; light-theme error `#B42318` |
| warning | `#E8A33D` | light-theme warning `#B45309` |

### Light "paper" document palette (embedded panels only)

paper `#FAFAF7`, surface `#FFFFFF`, ink `#10141C`, border `#E4E4DF`, muted `#5F6672`,
accent `#0E7C5A`, error `#B42318`, warning `#B45309`.

Paper panels: `border-radius:4px`, slight `transform:rotate(-.3deg)`, layered shadow
`0 1px 0 #d8d8d2, 0 20px 60px rgba(0,0,0,.55), 0 60px 120px rgba(0,0,0,.4)`, and a red
"tape" strip centered on top (`::before`, 120×26px, `rgba(200,16,46,.85)`, rotate .6deg).

### Radius / easing / shadows

- Cards: 14–16px (`--r-card:14px`, style tile uses 16px); controls/inputs/buttons: 10px; pills/chips: 999px.
- Ease: `cubic-bezier(.22,.8,.3,1)`; spring (hovers, presses): `cubic-bezier(.34,1.56,.64,1)`.
- Card shadow: `0 20px 50px rgba(0,0,0,.5)`; big sheets `0 30px 70/80px rgba(0,0,0,.55-.7)`.
- Every screen has a fixed **3px red top rule**: `position:fixed;top:0;height:3px;background:#C8102E;box-shadow:0 0 18px #C8102E;z-index:100`.

### Atmosphere (every night screen)

1. **Floodlight glows** — fixed inset layer:
   `radial-gradient(60% 34% at 10% -6%, rgba(200,16,46,.16), transparent 60%)`,
   `radial-gradient(60% 34% at 90% -6%, rgba(70,120,255,.10), transparent 60%)`,
   `radial-gradient(90% 50% at 50% 108%, rgba(34,196,139,.07), transparent 60%)`.
2. **Film grain** — fixed inset SVG feTurbulence data-URI overlay, opacity ~.05, `pointer-events:none`.
3. Buttons press with `transform:scale(.96)`; hovers `translateY(-2px)` with spring easing.
4. `prefers-reduced-motion: reduce` kills all animation/transition durations.

---

## 2. TYPOGRAPHY

Fonts via Google Fonts: **Archivo** (600/700/800 — display/headings/numbers-as-display)
and **Inter** (400/500/600 — body/UI). The app already loads Inter via next/font; add
Archivo the same way (`--font-display` already exists in tailwind.config — point it at Archivo).

- Display H1 (marketing/style tile): `800 clamp(56-64px, 9.5-11vw, 130-150px)/0.92 Archivo`,
  `letter-spacing:-.03em`, uppercase. Second row often outline style:
  `color:transparent; -webkit-text-stroke:2px var(--txt)`.
- Page H1 (dashboard/donation): `900 clamp(26-46px…)` uppercase with red stacked text-shadow:
  `0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)`.
- H2 section heads: `800 clamp(32px,4.5vw,52px)/1 Archivo`, uppercase, `letter-spacing:-.02em`.
- Card titles: `700 18-22px Archivo`, uppercase for component heads.
- Kickers/eyebrows: `600 11-12px Inter`, `letter-spacing:.14-.22em`, uppercase, team red
  with `text-shadow:0 0 14px rgba(200,16,46,.6)`.
- Body: 16px/1.5 Inter; small/meta 12-14px muted.
- All money/stats: `font-variant-numeric:tabular-nums`. Big money:
  `800 38px Archivo` (`.money-xl`) or `600 28px Inter` (`.stat .num`).

---

## 3. COMPONENT PATTERNS (exact CSS)

### Buttons
```
base: inline-flex center gap-8px; min-height:44px; padding:0 20px; radius:10px;
      font:600 14px Inter; transition spring .18s; active: scale(.96)
primary:  background:#C8102E; color:#fff;
          box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset, 0 8px 24px rgba(200,16,46,.4)
          hover: translateY(-2px) + brightness(1.08)
secondary: transparent; 1px border var(--txt); hover bg rgba(255,255,255,.08)
ghost:    transparent; color:muted; hover bg rgba(255,255,255,.06), color:txt
```

### Night card (the signature card)
```
background:linear-gradient(165deg,#1B2334,#121826);   /* or surface2→surface */
border:1px solid rgba(255,255,255,.10); border-radius:16px; padding:24-26px;
box-shadow:0 20px 50px rgba(0,0,0,.5); position:relative; overflow:hidden
::before: content:""; position:absolute; top:0;left:0;right:0; height:3px;
          background:#C8102E; box-shadow:0 0 12px #C8102E   /* red top strip */
```
Athlete/roster rows hover: `background:rgba(255,255,255,.05); transform:translateX(4px)`.

### Progress bar
```
track: height:10px; background:rgba(255,255,255,.10); radius:999px
fill:  background:#22C48B; radius:999px; box-shadow:0 0 12px rgba(34,196,139,.7)
       (team-red variant: #C8102E + red glow)
```

### Stat blocks
```
grid of 3, gap:14px; cell: border:1px solid line; radius:12px; padding:16px 18px;
background:rgba(255,255,255,.04); box-shadow:0 10px 26px rgba(0,0,0,.35)
.num: 600 28px Inter tabular-nums, subtle green text-glow
.lbl: 500 12px Inter muted
```

### Amount chips (donation)
```
pill: min-height:44px; padding:0 18px; radius:999px; border:1px solid line;
      background:rgba(255,255,255,.05); 600 14px Inter tabular-nums
selected[aria-pressed=true]: border+background #C8102E, color #fff,
      box-shadow:0 0 18px rgba(200,16,46,.5), scale(1.05)
```
Donation-screen big chips are instead gradient tiles (`linear-gradient(160deg,surface2,surface)`,
radius 14px, padding 16px) with selected state `border:#C8102E; box-shadow:0 0 0 1px #C8102E,
0 10px 34px rgba(200,16,46,.35), inset 0 0 22px rgba(200,16,46,.12)`.

### Inputs
```
height:44px; padding:0 12px; border:1px solid line; radius:10px;
background:rgba(255,255,255,.05); color:txt; 14px Inter
focus: border-color:accent; box-shadow:0 0 0 3px rgba(14,124,90,.35)
error: border-color:error; box-shadow:0 0 12px rgba(180,35,24,.4); err msg 12px #F27B72
label: 500 13px Inter, margin-bottom:6px
```

### Tables (roster/leaderboard)
```
th: 600 11-12px Inter uppercase letter-spacing:.06-.08em, muted,
    background:rgba(255,255,255,.03); padding:12-13px 16-22px
td: padding:11-13px 16-22px; border-bottom:1px solid line; tabular-nums
row hover: background:rgba(255,255,255,.04); last row no border
positive money column: accent green; fees/negative: error red
```

### Site header (app screens)
```
sticky top, background:rgba(10,13,20,.86); backdrop-filter:blur(10px);
border-bottom:1px solid border; z-50
inner: max-width:1200px; padding:12px 20px; flex gap:12px
wordmark: 800 17px Archivo, letter-spacing:-.02em, with red dot
team chip: pill, 1px border, 600 12px Inter, surface bg
```

### Modal / bottom sheet / toast
- Overlay: `rgba(4,6,10,.72)`. Modal: night gradient card, radius 16px, max-width 420px,
  enters translateY(18px) scale(.96) → none with spring.
- Bottom sheet: fixed bottom, radius 18px 18px 0 0, max-width 480px centered, grab handle
  40×4px pill, slides up spring .35s.
- Toast: night3 bg, 1px line border, radius 12px, padding 12px 16px, enters from
  translateY(10px) scale(.97).

### Tabs
Container: 1px border, radius 12px 12px 0 0. Tab: flex-1, min-height 44px, 600 13px,
muted; selected: color txt, `border-bottom:2px solid #C8102E`, bg rgba(255,255,255,.06).

### Ticker / marquee
Bordered strip (1px line top+bottom), Archivo 700 20px items separated by red
uppercase Inter 11px labels; track duplicated, `translateX(-50%)` loop, ~24-34s linear infinite.
(The app already has a `marquee` keyframe in tailwind.config doing exactly this.)

### "Paper" document panel (pricing breakdown, consent)
Light panel (tokens above) on the dark page: radius 4px, slight rotate(-.3deg), layered
shadows, red tape strip on top. Inside: ledger rows (flex space-between, dashed/border
dividers), total row with `800 clamp(26px,5vw,40px) Archivo` accent-green number, and an
optional rotated "stamp" (800 11px Archivo uppercase, 2px accent border, rotate(-2deg)).

---

## 4. PER-SCREEN NOTES

**00 style-tile** — token reference; nothing to build.

**01 team-campaign** (→ `app/raise/[slug]`): masthead with school kicker + huge uppercase
team name (2nd word outlined), photo scene w/ crest, raised amount (Archivo, tabular) +
progress bar + goal line, 3-stat grid, red Donate CTA w/ fee line beneath, coach quote
card, searchable roster list (rows: name/jersey/amount/mini-bar), recent gifts feed,
sticky bottom donate bar that appears on scroll, footer.

**02 athlete** (→ public team-member page): same chrome as 01; back link; athlete name hero;
photo pane with no-photo fallback (floating jersey w/ number + initials, privacy chip);
raised/bar/stats/donate block; personal note card; gifts feed; "more from this team"
mini-cards; sticky donate bar.

**03 donation** (→ `app/contribute/[token]` / donate flow): numbered steps (STEP 1/2/3
with red numeral), amount chip tiles + custom-amount row w/ `$` prefix, monthly toggle
switch, wallet buttons (Apple Pay black / Google Pay bordered) then collapsible card form,
anonymous checkbox w/ custom box, fee-transparent summary card (muted rows, dashed
dividers, total row 16px semibold; "team receives" in accent green).

**04 confirmation**: big animated check, "You gave $X" hero, kinetic progress showing the
campaign bar moving, honest-fees receipt rows, share CTA + bottom-sheet share sheet
(copy link pill confirmation), "give again" expandable panel, ticker footer.

**05 coach-dashboard** (→ `app/dashboard/[campaignId]`): sticky site header (wordmark +
team chip + coach avatar), hero w/ raised total (ghost outline numeral behind), days-left
pill, progress bar + pace flag, participation fraction + mini-bar, card grid (sparkline
card w/ hover dots, payout card w/ fee lines, activity feed), roster table (sortable th,
checkboxes, per-row "nudge" button that flips to sent state, filter pills, bulk action
bar appearing on selection).

**06 campaign-wizard** (→ `app/create-campaign`): header w/ breadcrumb + save-and-exit +
"saved" flash; left rail step list (numbered nodes w/ connecting bars, done=green fill,
current=red ring); right panel per step (pane fade-in); color swatch picker (selected:
outline + check), photo upload w/ thumb preview, live preview card of the public page
(with blinking LIVE badge), fee strip, char-counted textarea, tabs.

**07 athlete-home** (→ `app/player`): centered narrow column, team header, personal
progress card (gradient panel, red top strip), share-link card w/ copy, personal gifts
list, nudge/contacts entry. Same atmosphere bg (dual red radial glows + grain).

**08 onboarding/consent**: same shell as 07 but consent copy lives on an embedded light
"paper" document panel (see §3) — dark stadium outside, legible paper inside. Signature/
checkbox rows, guardian fields.

**09 marketing** (→ `app/page.tsx`): darkest palette (`#0A0E15`), jumbotron hero (huge
Archivo uppercase w/ outlined row, red glow), sport-name ticker, feature sections with
numbered section heads (`sec-num` = outlined 46px numeral), testimonial/pull-quote,
CTA band, footer. `--team-hot:#FF2E4D` accents.

**10 pricing**: marketing chrome; pricing tiers as night cards; fee comparison on an
embedded paper document: ledger rows, compare row highlighted `#FBF3E4`, green total,
red "stamp". Fee math fixtures: teamReceives = amount × 0.9205; comparison = goal × 0.77.

**11 edge states**: empty/error/loading variants of cards, roster, donation — skeleton
rows, error-soft backgrounds `rgba(242,97,75,.08)`, warning-soft `rgba(232,163,61,.08)`.

**12 components**: component sheet — buttons/chips/fields/toast/modal/sheet/tabs/table/
token card exactly as §3.

---

## 5. LIGHT vs DARK

- **Everything is dark "stadium night"** — all 12 screens. There is no light mode of the
  app shell in this design.
- **Light appears only as embedded "paper" documents**: the pricing/fee breakdown (10),
  the consent form (08), and receipt-ish panels. Build these as a scoped component/class
  (e.g. `.paper-panel`) using the light tokens, not by flipping the app theme.
- Shared across all: 3px red top rule, floodlight glows, grain, Archivo/Inter pairing,
  spring hover/press motion, tabular-nums money.
- The app currently has a `.dark` token set in globals.css and `darkMode:["class"]` —
  the practical path is to make the stadium night palette the DEFAULT `:root` surface
  tokens and treat the night design as the only theme.

## Mapping notes (app specifics)

- `tailwind.config.ts` brand scales must be re-pointed: primary→team red `#C8102E` family,
  secondary/success→accent green `#22C48B` family. Keep `success.dark`/`warning.light`
  compat keys (see existing comments). globals.css `:root` surface tokens go dark.
- Existing usages of `bg-background`, `text-foreground`, `bg-card` etc. then automatically
  render night — that is the cheapest correct conversion.
- `formatCurrency` caveat unchanged: money components receive dollars vs cents depending
  on endpoint — check imports, don't "fix" amounts during restyle.
- Demo figures in mockups are fixtures; wire to existing live data props.
