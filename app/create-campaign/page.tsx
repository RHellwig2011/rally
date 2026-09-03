"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  Palette,
  PartyPopper,
  Pencil,
  Plane,
  Receipt,
  Rocket,
  Shirt,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Kicker, SiteHeader, TeamChip } from "@/components/app-chrome";
import { useCsrfToken } from "@/hooks/useCsrfToken";

// BRIEF §3 amount-chip / option-tile states. Unselected tiles sit on the night
// wash; the selected one takes the team-red border, inner glow and drop halo.
// The focus ring matches the Button base (primary-300 — full-alpha red is too
// dim on the night shell for a focus indicator).
const OPTION_TILE =
  "rounded-xl border transition-all duration-200 ease-spring active:scale-[.97] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const OPTION_TILE_OFF =
  "border-white/10 bg-white/[0.04] text-foreground hover:-translate-y-0.5 hover:border-white/25";
const OPTION_TILE_ON =
  "border-primary bg-[rgba(200,16,46,.14)] text-foreground shadow-[0_0_0_1px_#C8102E,0_10px_34px_rgba(200,16,46,.35),inset_0_0_22px_rgba(200,16,46,.12)]";

/**
 * Guided campaign setup.
 *
 * Six short screens instead of one long form — the target user is a coach or
 * team parent filling this in on a phone, so each step asks for one thing in
 * plain language and validates before moving on.
 *
 * The payload this builds is exactly what `createCampaignSchema`
 * (lib/validations/campaign.ts) accepts. Colors, guardian and approval
 * threshold are deliberately omitted: the schema defaults them, and they
 * belong in the dashboard's advanced settings rather than in a first-run flow.
 */

type Category = "SPORTS" | "ARTS" | "EDUCATION" | "COMMUNITY" | "OTHER";

interface WizardData {
  teamName: string;
  organizationName: string;
  category: Category;
  goalAmount: string;
  description: string;
  slug: string;
  /** Once the coach edits the URL by hand we stop regenerating it from the team name. */
  slugTouched: boolean;
  startDate: string;
  endDate: string;
}

const TOTAL_STEPS = 6;

const STEPS: { title: string; subtitle: string }[] = [
  { title: "Tell us about your team", subtitle: "Just the basics — you can change any of this later." },
  { title: "Your fundraising goal", subtitle: "A number to rally everyone around." },
  { title: "Tell your supporters why", subtitle: "This is what people read before they give." },
  { title: "Your team's web address", subtitle: "The link you'll text, post and hand out." },
  { title: "When does it run?", subtitle: "A deadline gives supporters a reason to act now." },
  { title: "Review & launch", subtitle: "One last look before we build your page." },
];

const CATEGORIES: { value: Category; label: string; hint: string; Icon: typeof Trophy }[] = [
  { value: "SPORTS", label: "Sports", hint: "Teams, leagues, clubs", Icon: Trophy },
  { value: "ARTS", label: "Arts & music", hint: "Band, theater, choir", Icon: Palette },
  { value: "EDUCATION", label: "School", hint: "Robotics, academics, clubs", Icon: GraduationCap },
  { value: "COMMUNITY", label: "Community", hint: "Youth groups, service", Icon: Users },
  { value: "OTHER", label: "Something else", hint: "We'll still cheer for it", Icon: Sparkles },
];

const GOAL_PRESETS = [2500, 5000, 10000];

const STORY_TEMPLATES: {
  id: string;
  label: string;
  Icon: typeof Shirt;
  build: (team: string) => string;
}[] = [
  {
    id: "uniforms",
    label: "New uniforms",
    Icon: Shirt,
    build: (team) =>
      `Our ${team} players have been wearing the same uniforms for years, and it's time for a fresh set. ` +
      `Every donation goes straight toward jerseys, warm-ups and gear so our kids can take the field looking like the team they are. ` +
      `Thank you for backing them.`,
  },
  {
    id: "travel",
    label: "Travel to a tournament",
    Icon: Plane,
    build: (team) =>
      `${team} earned a spot in a tournament this season, and we'd love for every player to make the trip. ` +
      `Your donation helps cover travel, lodging and meals so that no family has to sit this one out because of cost. ` +
      `Thank you for helping us get there together.`,
  },
  {
    id: "fees",
    label: "Season fees",
    Icon: Receipt,
    build: (team) =>
      `Playing for ${team} costs more than it should — registration, referees, field time and equipment add up fast. ` +
      `We're raising money so that every kid who wants to play can play, no matter what their family can afford. ` +
      `Thank you for being part of our season.`,
  },
];

const SLUG_RE = /^[a-z0-9-]+$/;
const STORAGE_KEY = "bleacher-backers:new-campaign";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/** Team name -> URL-safe slug: lowercase, hyphenated, invalid characters dropped. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/** Local calendar date as YYYY-MM-DD, which is what `<input type="date">` wants. */
function toDateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(dateInput: string, days: number): string {
  const [y, m, d] = dateInput.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

/**
 * The zod schema takes a UTC ISO datetime and compares it against the server's
 * midnight-today. Pinning the calendar date to midday UTC keeps "today" on the
 * right side of that comparison regardless of the coach's timezone offset —
 * anchoring to local midnight would land the previous UTC day east of Greenwich
 * and get rejected as a past start date.
 */
function toIsoStart(dateInput: string): string {
  return `${dateInput}T12:00:00.000Z`;
}

function toIsoEnd(dateInput: string): string {
  return `${dateInput}T23:59:00.000Z`;
}

function formatFriendlyDate(dateInput: string): string {
  if (!dateInput) return "";
  const [y, m, d] = dateInput.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(amount: string): string {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return "$0";
  return `$${parsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const EMPTY_DATA: WizardData = {
  teamName: "",
  organizationName: "",
  category: "SPORTS",
  goalAmount: "",
  description: "",
  slug: "",
  slugTouched: false,
  startDate: "",
  endDate: "",
};

/** Which step owns each field, so server-side validation errors can send the coach back to it. */
const FIELD_STEP: Record<string, number> = {
  teamName: 1,
  organizationName: 1,
  category: 1,
  goalAmount: 2,
  description: 3,
  slug: 4,
  startDate: 5,
  endDate: 5,
};

export default function CreateCampaignPage() {
  const { csrfToken } = useCsrfToken();

  const [authState, setAuthState] = useState<"checking" | "authed" | "anon">("checking");
  const [user, setUser] = useState<{ email: string; firstName: string; emailVerified: boolean } | null>(null);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);

  const hydrated = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // Session check. A hard redirect here is hostile to someone who just typed a
  // team name in, so an unauthenticated visitor gets a gentle screen instead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (cancelled) return;
        if (!res.ok) {
          setAuthState("anon");
          return;
        }
        const json = await res.json();
        setUser(json?.user ?? null);
        setAuthState("authed");
      } catch {
        if (!cancelled) setAuthState("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore in-progress work. Runs once, before the save effect is allowed to
  // write, so a refresh mid-wizard doesn't cost the coach their answers.
  useEffect(() => {
    const today = toDateInputValue(new Date());
    let restored: WizardData | null = null;
    let restoredStep = 1;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.data) {
          restored = { ...EMPTY_DATA, ...parsed.data };
          restoredStep = Math.min(Math.max(Number(parsed.step) || 1, 1), TOTAL_STEPS);
        }
      }
    } catch {
      // Corrupt or unavailable storage is not worth blocking setup over.
    }

    const next = restored ?? { ...EMPTY_DATA };
    // A saved start date from a previous day would fail the API's
    // today-or-future check, so roll it forward.
    if (!next.startDate || next.startDate < today) next.startDate = today;
    if (next.endDate && next.endDate <= next.startDate) next.endDate = "";

    setData(next);
    setStep(restoredStep);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current || created) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step }));
    } catch {
      // Private-mode storage failures are non-fatal.
    }
  }, [data, step, created]);

  // Live availability check, debounced so typing doesn't hammer the endpoint.
  useEffect(() => {
    const slug = data.slug.trim();
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    if (slug.length < 3 || slug.length > 50 || !SLUG_RE.test(slug)) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/campaigns/check-slug?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted) return;
        setSlugStatus(json?.available ? "available" : "taken");
      } catch {
        if (!controller.signal.aborted) setSlugStatus("idle");
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [data.slug]);

  const update = useCallback(<K extends keyof WizardData>(field: K, value: WizardData[K]) => {
    setFormError(null);
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
    setData((prev) => {
      const next = { ...prev, [field]: value };
      // Keep the URL in step with the team name until the coach takes it over.
      if (field === "teamName" && !prev.slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }, []);

  const validate = useCallback(
    (target: number): Record<string, string> => {
      const found: Record<string, string> = {};
      const today = toDateInputValue(new Date());

      if (target === 1) {
        const team = data.teamName.trim();
        if (!team) found.teamName = "We need a name to put on your page.";
        else if (team.length < 2) found.teamName = "That's a little short — try at least 2 characters.";
        else if (team.length > 100) found.teamName = "That's a bit long. Keep it under 100 characters.";

        const org = data.organizationName.trim();
        if (!org) found.organizationName = "Who is your team a part of? School, club or league name works.";
        else if (org.length < 2) found.organizationName = "That's a little short — try at least 2 characters.";
        else if (org.length > 100) found.organizationName = "That's a bit long. Keep it under 100 characters.";
      }

      if (target === 2) {
        const goal = Number.parseFloat(data.goalAmount);
        if (!data.goalAmount.trim() || !Number.isFinite(goal)) {
          found.goalAmount = "Pick an amount, or tap one of the suggestions above.";
        } else if (goal < 1) {
          found.goalAmount = "Your goal needs to be at least $1.";
        } else if (goal > 100000) {
          found.goalAmount = "The most we can set right now is $100,000.";
        }
      }

      if (target === 3) {
        const story = data.description.trim();
        if (story.length < 10) found.description = "Add a sentence or two — supporters give more when they know why.";
        else if (story.length > 1000) found.description = "That's over 1,000 characters. Trim it down a little.";
      }

      if (target === 4) {
        const slug = data.slug.trim();
        if (!slug) found.slug = "Your page needs a web address.";
        else if (slug.length < 3) found.slug = "A little longer, please — at least 3 characters.";
        else if (slug.length > 50) found.slug = "Keep it under 50 characters so it's easy to share.";
        else if (!SLUG_RE.test(slug)) found.slug = "Use lowercase letters, numbers and hyphens only.";
        else if (slugStatus === "taken") found.slug = "That one's already taken — try another.";
      }

      if (target === 5) {
        if (!data.startDate) {
          found.startDate = "Pick a start date.";
        } else if (data.startDate < today) {
          found.startDate = "Start dates need to be today or later.";
        }
        if (data.endDate) {
          if (data.endDate <= data.startDate) {
            found.endDate = "Your end date needs to come after your start date.";
          } else if (data.endDate > addDays(data.startDate, 365)) {
            found.endDate = "Campaigns can run for up to a year.";
          }
        }
      }

      return found;
    },
    [data, slugStatus]
  );

  const goToStep = useCallback((target: number) => {
    setStep(target);
    setErrors({});
    setFormError(null);
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  const handleNext = useCallback(() => {
    const found = validate(step);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    goToStep(Math.min(step + 1, TOTAL_STEPS));
  }, [validate, step, goToStep]);

  const handleBack = useCallback(() => {
    goToStep(Math.max(step - 1, 1));
  }, [goToStep, step]);

  const handleSubmit = useCallback(async () => {
    // Re-run every step so nothing edited out of order slips through, but
    // land the coach on the first screen that actually needs attention.
    for (let s = 1; s <= 5; s++) {
      const found = validate(s);
      if (Object.keys(found).length > 0) {
        setStep(s);
        setErrors(found);
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);
    setNeedsEmailVerification(false);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          organizationName: data.organizationName.trim(),
          teamName: data.teamName.trim(),
          slug: data.slug.trim(),
          description: data.description.trim(),
          goalAmount: Number.parseFloat(data.goalAmount),
          startDate: toIsoStart(data.startDate),
          ...(data.endDate ? { endDate: toIsoEnd(data.endDate) } : {}),
          category: data.category,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.code === "EMAIL_NOT_VERIFIED") {
          setNeedsEmailVerification(true);
          return;
        }

        if (Array.isArray(json?.details) && json.details.length > 0) {
          const mapped: Record<string, string> = {};
          let earliestStep = TOTAL_STEPS;
          for (const detail of json.details) {
            const field = String(detail.field ?? "");
            mapped[field] = String(detail.message ?? "Please check this.");
            const owner = FIELD_STEP[field];
            if (owner && owner < earliestStep) earliestStep = owner;
          }
          setErrors(mapped);
          setStep(earliestStep);
          return;
        }

        if (res.status === 400 && typeof json?.error === "string" && /url/i.test(json.error)) {
          setErrors({ slug: "That one's already taken — try another." });
          setSlugStatus("taken");
          setStep(4);
          return;
        }

        setFormError(json?.error || "We couldn't create your campaign just now. Please try again.");
        return;
      }

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to do — the wizard is finished either way.
      }
      setCreated({ id: json.campaign.id, slug: json.campaign.slug });
    } catch {
      setFormError("Something went wrong on our end. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, csrfToken, data]);

  /* ----------------------------- gate screens ----------------------------- */

  if (authState === "checking") {
    return (
      <Shell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Getting things ready…</p>
        </div>
      </Shell>
    );
  }

  if (authState === "anon") {
    return (
      <Shell>
        <Card className="mx-auto max-w-lg">
          <CardContent className="space-y-5 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[rgba(200,16,46,.14)]">
              <UserPlus className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold text-foreground">
                First, let&apos;s get you an account
              </h1>
              <p className="text-muted-foreground">
                Setting up a campaign takes about three minutes. We just need an account first so we
                can keep your team&apos;s page and your donations safe.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="h-12 w-full">
                <Link href="/signup?redirect=/create-campaign">Create a free account</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 w-full">
                <Link href="/login?redirect=/create-campaign">I already have one</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (created) {
    return (
      <Shell>
        <SuccessScreen campaign={created} teamName={data.teamName.trim()} />
      </Shell>
    );
  }

  /* -------------------------------- wizard -------------------------------- */

  const stepMeta = STEPS[step - 1];

  return (
    <Shell
      crumb="New campaign"
      rail={<StepRail current={step} onSelect={goToStep} />}
    >
      <div ref={headingRef} className="mb-6 scroll-mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <Kicker tone="team">
            Step {step} of {TOTAL_STEPS}
          </Kicker>
          <span className="text-xs tabular text-muted-foreground">
            {Math.round((step / TOTAL_STEPS) * 100)}% done
          </span>
        </div>
        <Progress value={step} max={TOTAL_STEPS} />
      </div>

      <Card>
        {/* Each step pane fades in on entry (BRIEF §4 screen 06 "pane fade-in").
            Keying on `step` restarts the animation as the coach advances. */}
        <CardContent key={step} className="animate-fade-in p-5 sm:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-black uppercase leading-[1.05] tracking-[-0.02em] text-foreground [text-shadow:0_2px_0_rgba(200,16,46,.4),0_6px_0_rgba(200,16,46,.14),0_18px_44px_rgba(200,16,46,.18)] sm:text-[32px]">
              {stepMeta.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{stepMeta.subtitle}</p>
          </div>

          {formError && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 border-l-[3px] border-l-destructive bg-[rgba(242,97,75,.08)] p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <p className="text-sm font-medium text-foreground">{formError}</p>
            </div>
          )}

          {needsEmailVerification && (
            <VerifyEmailCard email={user?.email ?? ""} csrfToken={csrfToken} />
          )}

          {/* Step 1 — who are you? */}
          {step === 1 && (
            <div className="space-y-6">
              <Field
                id="teamName"
                label="What's your team called?"
                hint="However people already say it — “Lincoln Varsity Soccer”, “The Wildcats”."
                error={errors.teamName}
              >
                <Input
                  id="teamName"
                  value={data.teamName}
                  onChange={(e) => update("teamName", e.target.value)}
                  placeholder="Lincoln Varsity Soccer"
                  maxLength={100}
                  autoComplete="off"
                  className={`h-12 text-base ${errors.teamName ? "border-warning" : ""}`}
                />
              </Field>

              <Field
                id="organizationName"
                label="And who are you a part of?"
                hint="Your school, club or league. This shows up on your page and on receipts."
                error={errors.organizationName}
              >
                <Input
                  id="organizationName"
                  value={data.organizationName}
                  onChange={(e) => update("organizationName", e.target.value)}
                  placeholder="Lincoln High School"
                  maxLength={100}
                  autoComplete="organization"
                  className={`h-12 text-base ${errors.organizationName ? "border-warning" : ""}`}
                />
              </Field>

              <div>
                <Label className="text-base font-semibold">What kind of team is this?</Label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {CATEGORIES.map(({ value, label, hint, Icon }) => {
                    const selected = data.category === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => update("category", value)}
                        aria-pressed={selected}
                        className={`flex min-h-[104px] flex-col items-start gap-1 p-4 text-left ${OPTION_TILE} ${
                          selected ? OPTION_TILE_ON : OPTION_TILE_OFF
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        <span className="text-xs leading-tight text-muted-foreground">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — the goal */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold">How much are you hoping to raise?</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Most teams start with a round number. You can adjust it any time.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {GOAL_PRESETS.map((preset) => {
                    const selected = data.goalAmount === String(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => update("goalAmount", String(preset))}
                        aria-pressed={selected}
                        className={`flex h-14 items-center justify-center text-lg font-semibold tabular ${OPTION_TILE} ${
                          selected ? OPTION_TILE_ON : OPTION_TILE_OFF
                        }`}
                      >
                        ${preset.toLocaleString()}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      update("goalAmount", "");
                      document.getElementById("goalAmount")?.focus();
                    }}
                    className="flex h-14 items-center justify-center rounded-xl border border-dashed border-white/20 bg-transparent text-base font-medium text-muted-foreground transition-all duration-200 ease-spring hover:-translate-y-0.5 hover:border-white/35 hover:text-foreground active:scale-[.97]"
                  >
                    A different amount
                  </button>
                </div>
              </div>

              <Field id="goalAmount" label="Your goal" error={errors.goalAmount}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="goalAmount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    step={1}
                    value={data.goalAmount}
                    onChange={(e) => update("goalAmount", e.target.value)}
                    placeholder="5000"
                    className={`h-14 pl-9 text-lg font-semibold ${errors.goalAmount ? "border-warning" : ""}`}
                  />
                </div>
              </Field>

              {/* Fee strip — BRIEF §4 screen 06 ".feestrip" */}
              <div className="flex items-start gap-3 rounded-lg border border-secondary/35 bg-[rgba(34,196,139,.08)] p-4 text-[13px] font-medium">
                <Target className="mt-0.5 h-5 w-5 flex-shrink-0 text-secondary" />
                <p className="text-foreground">
                  Bleacher Backers takes a small platform fee — you keep the rest. Every donation
                  shows its exact breakdown in your dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Step 3 — the story */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold">Need a starting point?</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap one and edit it — a few personal details go a long way.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {STORY_TEMPLATES.map(({ id, label, Icon, build }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update("description", build(data.teamName.trim() || "our team"))}
                      className={`flex items-center gap-3 p-3 text-left sm:flex-col sm:items-start ${OPTION_TILE} ${OPTION_TILE_OFF}`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0 text-primary" />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Field
                id="description"
                label="Why are you raising money?"
                error={errors.description}
              >
                <Textarea
                  id="description"
                  value={data.description}
                  onChange={(e) => update("description", e.target.value)}
                  maxLength={1000}
                  placeholder={
                    "Example: Our girls' basketball team made the state tournament for the first time in twelve years. " +
                    "We're raising money for travel, hotel rooms and meals so every player can make the trip — no family left behind. " +
                    "Thank you for backing our kids."
                  }
                  className={`min-h-[190px] text-base leading-relaxed ${
                    errors.description ? "border-warning" : ""
                  }`}
                />
              </Field>

              <div className="-mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {data.description.trim().length < 10
                    ? "At least 10 characters."
                    : "Looking good."}
                </span>
                <span
                  className={
                    data.description.length > 900 ? "font-medium text-warning" : "text-muted-foreground"
                  }
                >
                  {data.description.length} / 1000
                </span>
              </div>
            </div>
          )}

          {/* Step 4 — the URL */}
          {step === 4 && (
            <div className="space-y-6">
              <Field
                id="slug"
                label="This is the link you'll share"
                hint="We made one from your team name — change it if you'd like something shorter."
                error={errors.slug}
              >
                <div
                  className={`flex items-center overflow-hidden rounded-lg border bg-white/[0.05] focus-within:border-secondary focus-within:ring-[3px] focus-within:ring-[rgba(14,124,90,.35)] ${
                    errors.slug || slugStatus === "taken" ? "border-warning" : "border-white/10"
                  }`}
                >
                  <span className="hidden select-none whitespace-nowrap py-3 pl-3 text-sm text-muted-foreground sm:inline">
                    bleacherbackers.com/raise/
                  </span>
                  <Input
                    id="slug"
                    value={data.slug}
                    onChange={(e) => {
                      setData((prev) => ({ ...prev, slugTouched: true }));
                      update("slug", slugify(e.target.value));
                    }}
                    placeholder="lincoln-varsity-soccer"
                    maxLength={50}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-12 border-0 bg-transparent pl-2 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="w-10 flex-shrink-0 pr-3">
                    {slugStatus === "checking" && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                    {slugStatus === "available" && <Check className="h-5 w-5 text-success" />}
                    {slugStatus === "taken" && <AlertCircle className="h-5 w-5 text-warning" />}
                  </div>
                </div>
              </Field>

              {/* Live preview of the public page — BRIEF §4 screen 06
                  ".preview-card": blinking LIVE dot, red rule, goal bar at 0. */}
              <div className="overflow-hidden rounded-card border border-border bg-[linear-gradient(160deg,#1A2130,#12161F)] shadow-sheet">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="h-[7px] w-[7px] animate-pulse rounded-full bg-secondary shadow-[0_0_10px_rgba(34,196,139,.9)]"
                  />
                  Live preview
                </div>
                <div className="h-[3px] bg-primary shadow-[0_0_16px_#C8102E]" />
                <div className="p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {data.organizationName || "Your organization"}
                  </p>
                  <p className="mt-1 font-display text-[21px] font-extrabold tracking-[-0.02em] text-foreground">
                    {data.teamName || "Your team"}
                  </p>
                  <p className="mt-4 font-display text-[30px] font-black tabular text-foreground">
                    $0
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      of {formatMoney(data.goalAmount)} goal
                    </span>
                  </p>
                  <div className="mt-2.5 h-[9px] overflow-hidden rounded-full border border-border bg-[#0D1119]">
                    <div className="h-full w-0 rounded-full bg-primary shadow-[0_0_14px_#C8102E]" />
                  </div>
                  <p className="mt-4 break-all text-center text-[11px] text-muted-foreground">
                    bleacherbackers.com/raise/{data.slug || "your-team"}
                  </p>
                </div>
              </div>

              {!errors.slug && slugStatus === "available" && (
                <p className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  That address is free — it&apos;s yours.
                </p>
              )}
              {!errors.slug && slugStatus === "taken" && (
                <p className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertCircle className="h-4 w-4" />
                  Already taken, try another — adding your city or year usually does it.
                </p>
              )}
            </div>
          )}

          {/* Step 5 — the dates */}
          {step === 5 && (
            <div className="space-y-6">
              <Field
                id="startDate"
                label="When should it start?"
                hint="Today is fine — nothing goes public until you launch it yourself."
                error={errors.startDate}
              >
                <Input
                  id="startDate"
                  type="date"
                  value={data.startDate}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => update("startDate", e.target.value)}
                  className={`h-12 text-base ${errors.startDate ? "border-warning" : ""}`}
                />
              </Field>

              <div>
                <Label className="text-base font-semibold">How long should it run?</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Most teams run 4–6 weeks. A deadline is what gets people off the fence.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "4 weeks", days: 28 },
                    { label: "6 weeks", days: 42 },
                    { label: "8 weeks", days: 56 },
                  ].map(({ label, days }) => {
                    const value = data.startDate ? addDays(data.startDate, days) : "";
                    const selected = !!value && data.endDate === value;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => update("endDate", value)}
                        aria-pressed={selected}
                        className={`h-12 text-sm font-semibold ${OPTION_TILE} ${
                          selected ? OPTION_TILE_ON : OPTION_TILE_OFF
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => update("endDate", "")}
                    aria-pressed={!data.endDate}
                    className={`h-12 text-sm font-semibold ${OPTION_TILE} ${
                      !data.endDate ? OPTION_TILE_ON : OPTION_TILE_OFF
                    }`}
                  >
                    No end date
                  </button>
                </div>
              </div>

              <Field
                id="endDate"
                label="End date (optional)"
                hint="Leave it empty to keep the campaign open-ended."
                error={errors.endDate}
              >
                <Input
                  id="endDate"
                  type="date"
                  value={data.endDate}
                  min={data.startDate ? addDays(data.startDate, 1) : undefined}
                  onChange={(e) => update("endDate", e.target.value)}
                  className={`h-12 text-base ${errors.endDate ? "border-warning" : ""}`}
                />
              </Field>
            </div>
          )}

          {/* Step 6 — review */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <ReviewRow label="Team" value={data.teamName} onEdit={() => goToStep(1)} />
                <ReviewRow label="Part of" value={data.organizationName} onEdit={() => goToStep(1)} />
                <ReviewRow
                  label="Type"
                  value={CATEGORIES.find((c) => c.value === data.category)?.label ?? data.category}
                  onEdit={() => goToStep(1)}
                />
                <ReviewRow label="Goal" value={formatMoney(data.goalAmount)} onEdit={() => goToStep(2)} />
                <ReviewRow label="Your why" value={data.description} onEdit={() => goToStep(3)} multiline />
                <ReviewRow
                  label="Link"
                  value={`bleacherbackers.com/raise/${data.slug}`}
                  onEdit={() => goToStep(4)}
                />
                <ReviewRow
                  label="Runs"
                  value={
                    data.endDate
                      ? `${formatFriendlyDate(data.startDate)} — ${formatFriendlyDate(data.endDate)}`
                      : `Starts ${formatFriendlyDate(data.startDate)} · no end date`
                  }
                  onEdit={() => goToStep(5)}
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-[rgba(200,16,46,.10)] p-4">
                <Rocket className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <p className="text-sm text-foreground">
                  We&apos;ll save this as a <strong>draft</strong>. Nobody can see it or donate until
                  you launch it from your dashboard — so there&apos;s no risk in creating it now.
                </p>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                size="lg"
                className="h-14 w-full text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Building your page…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create my campaign
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            {step === 1 ? (
              <Button variant="ghost" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Not now
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}

            {step < TOTAL_STEPS && (
              <Button onClick={handleNext} size="lg" className="h-12 min-w-[9rem]">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Your answers are saved on this device as you go, so you can come back to them.
      </p>
    </Shell>
  );
}

/* ------------------------------- sub-views ------------------------------- */

function Shell({
  children,
  rail,
  crumb,
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  crumb?: string;
}) {
  return (
    <div className="min-h-screen">
      {/* BRIEF §4 screen 06: header carries a breadcrumb chip next to the wordmark. */}
      <SiteHeader
        sticky={false}
        left={crumb ? <TeamChip className="hidden sm:inline-flex">{crumb}</TeamChip> : undefined}
      />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          {rail ? <div className="lg:sticky lg:top-6">{rail}</div> : null}
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}

/**
 * Step rail — BRIEF §4 screen 06. Numbered nodes joined by connecting bars:
 * completed steps fill green, the current step carries the team-red ring.
 * Horizontal scroll strip on small screens, vertical rail from `lg` up.
 */
function StepRail({
  current,
  onSelect,
}: {
  current: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="-mx-4 flex gap-0 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {STEPS.map((meta, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        const last = number === STEPS.length;
        return (
          <li
            key={meta.title}
            className="flex flex-none items-center gap-3 lg:flex-col lg:items-stretch lg:gap-0"
          >
            <button
              type="button"
              onClick={() => onSelect(number)}
              disabled={number > current}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-3 pr-4 text-left disabled:cursor-not-allowed lg:pr-0"
            >
              <span
                className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl border font-display text-[17px] font-black tabular transition-all duration-300 ease-spring ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(200,16,46,.28),0_0_26px_rgba(200,16,46,.55)]"
                    : done
                      ? "border-secondary bg-transparent text-secondary"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-5 w-5" /> : number}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors lg:whitespace-normal ${
                  active || done ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {meta.title}
              </span>
            </button>
            {!last && (
              <span
                aria-hidden="true"
                className="relative ml-0 h-0.5 w-10 flex-none overflow-hidden rounded-sm bg-border lg:ml-[22px] lg:h-6 lg:w-0.5"
              >
                <i
                  className={`absolute inset-0 origin-left bg-secondary shadow-[0_0_10px_rgba(34,196,139,.8)] transition-transform duration-700 ease-stadium lg:origin-top ${
                    done ? "scale-x-100 lg:scale-y-100" : "scale-x-0 lg:scale-y-0"
                  }`}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-base font-semibold text-foreground">
        {label}
      </Label>
      {hint && !error && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-warning">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  multiline = false,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-0.5 break-words font-medium text-foreground ${
            multiline ? "whitespace-pre-wrap text-sm leading-relaxed" : ""
          }`}
        >
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-shrink-0 items-center gap-1 text-sm font-medium text-primary-300 hover:underline"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    </div>
  );
}

/**
 * Shown when POST /api/campaigns answers 403 EMAIL_NOT_VERIFIED. The resend
 * endpoint intentionally returns the same generic message whether or not the
 * address exists, so the confirmation copy here stays vague on purpose.
 */
function VerifyEmailCard({ email, csrfToken }: { email: string; csrfToken: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const resend = async () => {
    if (!email) {
      setState("error");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-primary/40 bg-[rgba(200,16,46,.10)] p-5">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="font-display font-bold uppercase tracking-[0.02em] text-foreground">One quick thing: confirm your email</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Because campaigns collect real money, we need to know your inbox is really yours. Click
              the link we sent{email ? ` to ${email}` : ""}, then come back and tap{" "}
              <strong>Create my campaign</strong> again. Everything you&apos;ve filled in is saved.
            </p>
          </div>

          {state === "sent" ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Sent. Give it a minute, and check your spam folder just in case.
            </p>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={resend}
                disabled={state === "sending"}
                className="h-11"
              >
                {state === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Resend verification email"
                )}
              </Button>
              {state === "error" && (
                <p className="text-sm font-medium text-warning">
                  We couldn&apos;t send it just now. Please try again in a moment.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({
  campaign,
  teamName,
}: {
  campaign: { id: string; slug: string };
  teamName: string;
}) {
  const steps = [
    {
      Icon: UserPlus,
      title: "Add your players",
      body: "Each player gets their own fundraising link. This is the single biggest thing you can do — teams with players added raise far more.",
    },
    {
      Icon: Sparkles,
      title: "Share your link",
      body: "Team group chat, email list, socials. Your page works on any phone.",
    },
    {
      Icon: Rocket,
      title: "Go live when you're ready",
      body: "Your campaign starts as a Draft, so it's private and can't accept donations yet. Launch it from your dashboard the moment you're set.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-secondary/40 bg-[rgba(34,196,139,.12)] shadow-[0_0_40px_rgba(34,196,139,.35)]">
          <PartyPopper className="h-8 w-8 text-secondary" />
        </div>
        <h1 className="font-display text-3xl font-black uppercase tracking-[-0.02em] text-foreground [text-shadow:0_2px_0_rgba(34,196,139,.4),0_16px_44px_rgba(34,196,139,.25)]">
          Your campaign page is ready!
        </h1>
        <p className="mt-2 text-muted-foreground">
          {teamName ? `${teamName} is` : "You're"} all set up. Here&apos;s what to do next.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {steps.map(({ Icon, title, body }, index) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-[rgba(200,16,46,.14)]">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {index + 1}. {title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button asChild size="lg" className="h-14 w-full text-base">
          <Link href={`/dashboard/${campaign.id}`}>
            <UserPlus className="mr-2 h-5 w-5" />
            Add my players
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-12 w-full">
          <Link href={`/raise/${campaign.slug}`}>
            <CalendarDays className="mr-2 h-4 w-4" />
            See my page
          </Link>
        </Button>
      </div>
    </div>
  );
}
