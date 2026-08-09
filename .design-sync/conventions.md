## How to build with this design system

This is the Bleacher Backers UI kit — shadcn/ui primitives (Radix + Tailwind) with a youth-sports
fundraising theme. Components are exported from `window.BleacherBackersUI`.

### Setup and wrapping

**No app-wide provider is required.** Every component here is a plain `forwardRef` wrapper and is
styled the moment `styles.css` is loaded. Do not invent a `ThemeProvider` — this kit has none.

Two exceptions, both Radix:
- **Toast** only renders inside `<ToastProvider>` with a `<ToastViewport />` sibling. `ToastViewport`
  is `position: fixed` to the screen corner; if you need it inline, override with a style.
- **Dialog / DropdownMenu** portal their content and are closed by default. Open them with
  `defaultOpen` (uncontrolled) or `open` (controlled).

Dark mode is the `class` strategy: put `class="dark"` on a wrapper, not a media query.

### The styling idiom: Tailwind utilities + semantic color names

Style your own layout with Tailwind utility classes. Use the **semantic** color names below rather
than raw palette values — they carry the brand and follow dark mode:

| Role | Classes |
|---|---|
| Brand / primary action | `bg-primary` `text-primary` `border-primary` `text-primary-foreground`, scale `primary-50/100/200/500/600/700/800/900` |
| Secondary (amber) | `bg-secondary` `text-secondary` `text-secondary-foreground` `border-secondary-100/200` |
| Positive | `bg-success` `text-success` `border-success` `bg-success-light` |
| Caution / danger | `bg-warning` `text-warning` |
| Surfaces | `bg-background` `bg-popover` `bg-muted` |
| Text | `text-foreground` `text-muted-foreground` `text-popover-foreground` |
| Lines & focus | `border-input` `border-primary` `border-success` `ring-offset-background` |

**`destructive` is not usable.** `--destructive` exists as a CSS variable but is NOT registered in
the Tailwind theme, so `text-destructive` / `bg-destructive` / `border-destructive` generate nothing
and render unstyled. For destructive UI use `variant="destructive"` on **Button** (it maps to
`bg-warning` and is correctly red). `Alert` and `Toast` `variant="destructive"` currently render flat
— prefer `variant="warning"` on Alert for danger states.

**The stylesheet is a closed set — this is the single most important rule here.** `styles.css` is a
compiled Tailwind build containing only the utilities this design system actually uses; it is not a
full Tailwind runtime. Common utilities (spacing, flex/grid, sizing, and the colors above) are
present. Anything the kit never used is simply absent — `bg-card`, `bg-accent`, `border-border` and
`ring-ring` are all defined in the Tailwind theme yet compile to **nothing**, and an arbitrary
bracket value you invent (`min-h-[137px]`) does too. A missing class fails **silently**: the element
falls back and still looks plausible. When you need a value outside the shipped set, use an inline
`style` — never assume an unusual class resolves.

Type is **Inter**, loaded by `styles.css`; do not add a font stack.

### Where the truth lives

Read these before styling — they beat any summary: `styles.css` and its `@import` closure
(`_ds_bundle.css` carries the component styles), plus each component's `<Name>.prompt.md` (usage) and
`<Name>.d.ts` (the props contract). Note most components — all six `Card` parts, `Input`, `Textarea`,
`Label`, `Skeleton` — have **no variant props at all**; their only API is `className` plus native
element props. `Button` and `Alert` are the ones with real variant axes.

### An idiomatic composition

```jsx
<Card>
  <CardHeader>
    <CardTitle>Lincoln High Basketball</CardTitle>
    <CardDescription>Spring tournament travel and new uniforms.</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex justify-between mb-2">
      <span className="font-semibold">$1,865 raised</span>
      <span className="text-muted-foreground">of $10,000</span>
    </div>
    {/* Progress takes raw amounts, not percentages */}
    <Progress value={1865} max={10000} />
  </CardContent>
  <CardFooter className="gap-3">
    <Button className="flex-1">Donate</Button>
    <Button variant="outline" className="flex-1">Share</Button>
  </CardFooter>
</Card>
```

`CardContent`/`CardFooter` carry `pt-0` for use under a sibling — a headerless card needs `pt-6`.
`CardFooter` has no gap of its own, so multi-button footers need `gap-3` plus `flex-1` per button.
