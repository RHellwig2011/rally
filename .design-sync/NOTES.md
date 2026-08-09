# design-sync notes — bleacher-backers

Repo-specific gotchas for future syncs of this design system.

## This repo is an app, not a component library

`package.json` is `private: true` with no `main`/`module`/`exports`, and there is no `dist/`.
The converter therefore runs in **synth-entry mode**, synthesizing an entry that re-exports
every file under `cfg.srcDir` (`components/ui`). Consequences:

- There is no shipped `.d.ts` tree, so `[DTS] parsed 0 .d.ts files` is expected. Prop contracts
  are extracted from the `.tsx` sources instead and are weaker than a real build would give.
- `cfg.srcDir` **must** stay `components/ui`. The converter's default search order is
  `src` → `lib` → `components`, and this repo has a `lib/` full of non-component utility code
  that would be picked first and yield garbage.
- The 11 source files export **47 components** — shadcn primitives are compound
  (Card also exports CardHeader/CardTitle/CardDescription/CardContent/CardFooter,
  DropdownMenu exports ~15 parts). 47 is correct, not over-inclusion.

## Required: self-reference symlink

`package-build.mjs` resolves the package as `<node-modules>/<pkg>`, which does not exist for a
self-contained app. Without it the build dies with
`ENOENT: ... node_modules/bleacher-backers/package.json`.

```sh
ln -sfn /workspaces/rally node_modules/bleacher-backers
```

Recreate this after any fresh `npm ci` / clone — it lives in `node_modules`, so it is never committed.
Passing `--entry` instead is NOT a fix: it would force a single file as the entry and defeat synth mode.

## Required: compile the stylesheet before building

`app/globals.css` is Tailwind **source** (`@tailwind base/components/utilities`), not compiled CSS.
Pointing `cssEntry` at it ships a stylesheet with no utility classes and every component renders
unstyled. Regenerate the compiled entry whenever theme or component classes change:

```sh
npx tailwindcss -c tailwind.config.ts -i app/globals.css -o .design-sync/compiled/_tw.css
{ echo "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');"; \
  cat .design-sync/compiled/_tw.css; } > .design-sync/compiled/ds.css
rm .design-sync/compiled/_tw.css
```

The prepended `@import` supplies **Inter**, which the app loads via `next/font/google` (there is no
`.woff2` in the repo to ship). This surfaces as `[FONT_REMOTE]`, which is informational — no action.
`.design-sync/compiled/` is gitignored; the command above is the source of truth.

## Repo bug: nothing ever mounts the Toast system

`components/ui/use-toast.ts` exists and `app/player/profile/[teamMemberId]/page.tsx` calls
`toast({...})`, but `grep -rn "Toaster" app components` returns **zero hits** — no `Toaster`
component exists in this kit and nothing mounts a `ToastProvider`/`ToastViewport`. Those toast calls
therefore cannot render anywhere in the running app. The synced `Toast` card composes the full stack
itself, so the DS card is correct; the app is what is missing the mount point.

## Known repo gap: `destructive` is not a Tailwind color

`--destructive` / `--destructive-foreground` are defined in `app/globals.css`, but `destructive` is
**not registered** in `tailwind.config.ts` `theme.extend.colors`. Tailwind therefore never generates
`text-destructive` / `border-destructive`, and `<Alert variant="destructive">` renders with no red
styling — in the real app as well as in the synced cards.

This is a genuine defect in the repo's theme, not a sync problem. The preview renders it faithfully
and is graded `good` on that basis. Fixing it means adding `destructive` (and `destructive-foreground`)
to the Tailwind color theme, which changes live app appearance — left to the repo owners.
Scope is exactly this one token — verified: `success` and `warning` ARE registered in the Tailwind
theme and their utilities compile fine. Affected components:
- `Alert` variant="destructive" — renders with no red border/text.
- `Toast` variant="destructive" — renders visually identical to the default variant.
- `Button` variant="destructive" is NOT affected: it maps to `bg-warning`, and renders correctly red.

## Environment: Chromium needs system libraries

The render check needs Playwright + Chromium. In this container the browser binary installs fine but
fails to launch with `libatk-1.0.so.0: cannot open shared object file`. Fix once per machine:

```sh
sudo npx playwright install-deps chromium
```

## Authoring previews for THIS repo — hard-won rules

**The compiled CSS is a closed set.** `ds.css` is produced by Tailwind scanning `app/` and
`components/` — **not** `.design-sync/previews/`. A Tailwind class invented in a preview that the
repo never uses emits **no rule and fails silently**: the element falls back to the component's base
class and the cell looks plausible while being wrong. (Caught on `Textarea`: `min-h-[160px]` produced
nothing and the field silently collapsed to the base `min-h-[80px]`.) Rules:
- Prefer the exact arbitrary value the repo already uses (`min-h-[200px]` is real; `[160px]` is not).
- Standard utilities (`mt-2`, `flex-1`, `pl-10`, `w-4`) are always safe.
- If the repo never uses a size you need, use an inline `style` instead of inventing a bracket class.
- When checking whether a class exists, remember the CSS escapes `[`, `]` and `/`:
  `grep -o "min-h[^{,: ]*" .design-sync/compiled/ds.css | sort -u` (a naive grep for `min-h-\[80px\]` returns 0 and misleads).

**Land every `cfg.overrides` entry BEFORE the final `package-build.mjs`.** Overrides are part of the
per-component stamp, so adding one after a build re-keys those components and `preview-rebuild.mjs`
hard-fails them with `[CONFIG_STALE]`. Subagents may not run `package-build.mjs`, so a mid-fan-out
override change hard-blocks every agent owning an overridden component. (This happened on this run
with Dialog/DropdownMenu/Toast and cost a full rebuild.)
The manifest `preview-rebuild` reads is `ds-bundle/.stories-map.json` — **not** `_ds_sync.json`,
which has no `cfgSlice` fields and will mislead anyone debugging a `[CONFIG_STALE]`.

**Radix statics.** Overlays need no portal workaround — `package-capture` screenshots the whole
viewport (`fullPage:false`), so portaled content is captured even though it escapes the card wrapper.
- `DialogContent` previews must set `onOpenAutoFocus={(e)=>e.preventDefault()}`, or Radix focuses the
  first field and the still shows a blue text selection plus a heavy focus ring — it reads as broken.
- `DropdownMenu` previews should use `modal={false}`, else the auto-focused first item paints a
  `focus:bg-accent` highlight that misrepresents the resting menu.
- `Toast` must be pinned open with `duration={1000000}` (the repo's own `TOAST_REMOVE_DELAY`).
  **Never `Infinity`** — `setTimeout` clamps it to 0 and the toast dismisses instantly.
- Previews are static: use `defaultValue`, never `value` (a `value` with no `onChange` makes the
  field read-only and logs a React controlled-component warning).
- An icon-only ghost trigger photographs as a stray floating glyph — anchor it in realistic
  surrounding context (a bordered roster row) rather than letting it float alone in a cell.

**Component API realities (do not hunt for props that do not exist).**
- All six `Card` parts, plus `Input`, `Textarea`, `Label` and `Skeleton`, are thin `forwardRef`
  wrappers with **no variant props at all** — the only API is `className` + native element props.
  Grade them on state and composition, not on a variant axis.
- `CardTitle` uses `leading-none`, so a title that wraps to two lines nearly collides with the
  `CardDescription` beneath it. The preview column is ~310px, which fits ~18 characters at the
  default 24px — realistic team names like "Lincoln High Varsity Basketball" wrap and look broken.
  Keep default-title cells short or use the app's own `text-lg` override.
- `CardContent`/`CardFooter` carry `pt-0`, correct only directly beneath a sibling. A headerless card
  needs `className="pt-6"` or content jams against the top border.
- `CardFooter` has **zero usages** outside `components/ui` — the app puts action rows in bare `div`s
  inside `CardContent` instead. It also has no gap of its own; multi-button footers need `gap-3` plus
  `flex-1` on each button.
- `Progress` is hand-rolled, not Radix. It takes **raw dollars** (`value={1865} max={10000}`) and
  clamps to 0–100. Its `className` lands on the outer wrapper while the track stays hardcoded `h-3`,
  so the app's `h-2` override is a no-op.
- `Label`'s only live behaviour is `peer-disabled:opacity-70`, which requires the control to carry
  `className="peer"` **and** be a previous sibling — so it only fires in checkbox-then-label order,
  never in the usual label-above-input order.
- `ToastClose` is `opacity-0` until `group-hover`, so it is invisible in any static screenshot. That
  is correct shadcn behaviour — do not chase it.

## Known render warns

None outstanding. (Any warn line not listed here on a future sync is new — investigate it, then
either fix it or record it here.)

Two capture artifacts that are NOT defects:
- The stitched review sheet can repeat the first row's label graphic at the bottom. The raw per-cell
  PNGs under `_screenshots/review/raw/` are clean — grade from the raws if a sheet shows a phantom row.
- `Skeleton` list rows need `last:border-0 last:pb-0` when ported, or the final row keeps an orphan
  divider (visible only on the sheet).

## Re-sync risks — what can silently go stale

- **The compiled stylesheet.** `.design-sync/compiled/ds.css` is gitignored and NOT regenerated by
  the converter. If theme tokens or component classes change and the Tailwind command above is not
  re-run, the sync ships the previous look with no error. Always re-run it before `package-build.mjs`.
- **The symlink.** Gone after a fresh clone or a `node_modules` wipe; the build fails loudly, so this
  is annoying rather than dangerous.
- **Synth-entry component discovery.** Adding a file to `components/ui/` silently adds its exports to
  the DS. Adding a non-component PascalCase export there would also be picked up — prune with
  `componentSrcMap: {"<Name>": null}`.
- **Inter is fetched at runtime** from `fonts.googleapis.com` rather than shipped. If that host is
  blocked in the rendering environment, every card falls back to a system font with no error.
- **Only `components/ui` is synced.** The app-specific components (`DonationForm`, `Navigation`,
  `components/roster/*`) are deliberately out of scope — they are bound to app data and APIs.
