/**
 * Flexible roster column mapping.
 *
 * The original CSV importer (lib/utils/csv-parser.ts) demands exact headers
 * (`name`, `email`) and rejects anything else. Real roster exports never look
 * like that: Hudl, TeamSnap, ArbiterSports and school spreadsheets each use
 * their own headers, split first/last name, and frequently ship no email at all.
 *
 * This module maps arbitrary headers onto our fields so a coach can upload the
 * file they already have. Auto-detection proposes a mapping; the coach confirms
 * or corrects it before anything is written.
 */

export type RosterField =
  | 'firstName'
  | 'lastName'
  | 'name'
  | 'email'
  | 'phone'
  | 'parentEmail'
  | 'parentPhone'
  | 'graduationYear'
  | 'grade'
  | 'position'
  | 'jerseyNumber'
  | 'personalGoal';

export const ROSTER_FIELD_LABELS: Record<RosterField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  name: 'Full name',
  email: 'Player email',
  phone: 'Player phone',
  parentEmail: 'Parent/guardian email',
  parentPhone: 'Parent/guardian phone',
  graduationYear: 'Graduation year',
  grade: 'Grade',
  position: 'Position',
  jerseyNumber: 'Jersey number',
  personalGoal: 'Personal goal ($)',
};

/**
 * Header aliases seen in the wild, lowercased and stripped of non-alphanumerics.
 * Hudl exports use "Class"/"Grad Year" for graduation year and "#"/"Jersey" for
 * the number; TeamSnap splits the name; school spreadsheets vary freely.
 */
const HEADER_ALIASES: Record<RosterField, string[]> = {
  firstName: ['firstname', 'first', 'givenname', 'athletefirstname', 'playerfirstname'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'athletelastname', 'playerlastname'],
  name: ['name', 'fullname', 'athlete', 'athletename', 'player', 'playername', 'displayname'],
  email: ['email', 'emailaddress', 'athleteemail', 'playeremail', 'studentemail', 'primaryemail'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'athletephone', 'playerphone'],
  parentEmail: [
    'parentemail', 'guardianemail', 'parentguardianemail', 'parent1email',
    'motheremail', 'fatheremail', 'emergencycontactemail',
  ],
  parentPhone: [
    'parentphone', 'guardianphone', 'parentguardianphone', 'parent1phone',
    'motherphone', 'fatherphone', 'emergencycontactphone',
  ],
  graduationYear: [
    'graduationyear', 'gradyear', 'classof', 'class', 'classyear', 'yearofgraduation', 'seniorityyear',
  ],
  grade: ['grade', 'gradelevel', 'year', 'yearinschool'],
  position: ['position', 'pos', 'primaryposition', 'positions'],
  jerseyNumber: ['jerseynumber', 'jersey', 'number', 'no', 'uniformnumber', 'uniform'],
  personalGoal: ['personalgoal', 'goal', 'goalamount', 'targetamount', 'fundraisinggoal'],
};

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Propose a header -> field mapping. Only unambiguous matches are proposed; a
 * header that matches nothing is left unmapped for the coach to assign or ignore.
 * `#` is deliberately handled here because it normalizes to an empty string.
 */
export function autoDetectMapping(headers: string[]): Record<string, RosterField | null> {
  const mapping: Record<string, RosterField | null> = {};
  const claimed = new Set<RosterField>();

  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (header.trim() === '#') {
      if (!claimed.has('jerseyNumber')) {
        mapping[header] = 'jerseyNumber';
        claimed.add('jerseyNumber');
        continue;
      }
    }
    let matched: RosterField | null = null;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [RosterField, string[]][]) {
      if (claimed.has(field)) continue;
      if (aliases.includes(norm)) {
        matched = field;
        break;
      }
    }
    if (matched) claimed.add(matched);
    mapping[header] = matched;
  }
  return mapping;
}

/**
 * A roster is only importable if we can derive a name. Email is NOT required:
 * Hudl exports routinely omit it, and a player without an email is still a valid
 * roster entry — they just receive their onboarding link another way.
 */
export function validateMapping(mapping: Record<string, RosterField | null>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const fields = new Set(Object.values(mapping).filter(Boolean) as RosterField[]);
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasName = fields.has('name') || (fields.has('firstName') && fields.has('lastName'));
  if (!hasName) {
    errors.push(
      'Map a "Full name" column, or both "First name" and "Last name". Everything else is optional.'
    );
  }
  if (fields.has('name') && (fields.has('firstName') || fields.has('lastName'))) {
    errors.push('Map either "Full name" or the first/last name pair — not both.');
  }
  if (!fields.has('email') && !fields.has('parentEmail')) {
    warnings.push(
      'No email column mapped. Players will be imported, but no invitations can be sent until contact details are added.'
    );
  }
  if (!fields.has('graduationYear')) {
    warnings.push(
      'No graduation year mapped. These players will not be picked up by alumni identification in future seasons.'
    );
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** Two-digit and "Class of" forms both appear in real exports. */
export function parseGraduationYear(raw: unknown, referenceYear: number): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const explicit = text.match(/(19|20)\d{2}/);
  if (explicit) {
    const year = parseInt(explicit[0], 10);
    return year >= 1900 && year <= referenceYear + 12 ? year : null;
  }
  const twoDigit = text.match(/^'?(\d{2})$/);
  if (twoDigit) {
    const year = 2000 + parseInt(twoDigit[1], 10);
    return year <= referenceYear + 12 ? year : null;
  }
  return null;
}

/**
 * Derive a graduation year from a US grade level when the export has no grad-year
 * column. Assumes a school year that rolls over in June: a 12th grader in
 * September 2026 graduates in 2027.
 */
export function graduationYearFromGrade(
  grade: unknown,
  now: Date
): number | null {
  if (grade === null || grade === undefined) return null;
  const match = String(grade).match(/(\d{1,2})/);
  if (!match) return null;
  const level = parseInt(match[1], 10);
  if (level < 1 || level > 12) return null;

  const schoolYearEnd = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
  return schoolYearEnd + (12 - level);
}

export interface MappedRosterRow {
  name: string;
  email?: string;
  phone?: string;
  parentEmail?: string;
  parentPhone?: string;
  graduationYear?: number;
  grade?: string;
  position?: string;
  jerseyNumber?: string;
  personalGoal?: number;
  _row: number;
}

export interface MapRowsResult {
  rows: MappedRosterRow[];
  errors: { row: number; reason: string }[];
}

export function applyMapping(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, RosterField | null>,
  options: { now?: Date; deriveGradYearFromGrade?: boolean } = {}
): MapRowsResult {
  const now = options.now ?? new Date();
  const referenceYear = now.getFullYear();
  const rows: MappedRosterRow[] = [];
  const errors: { row: number; reason: string }[] = [];

  const byField = new Map<RosterField, string>();
  for (const [header, field] of Object.entries(mapping)) {
    if (field) byField.set(field, header);
  }

  const read = (row: Record<string, unknown>, field: RosterField): string => {
    const header = byField.get(field);
    if (!header) return '';
    const value = row[header];
    return value === null || value === undefined ? '' : String(value).trim();
  };

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // 1-indexed with a header line

    let name = read(raw, 'name');
    if (!name) {
      name = [read(raw, 'firstName'), read(raw, 'lastName')].filter(Boolean).join(' ').trim();
    }
    if (!name) {
      errors.push({ row: rowNumber, reason: 'No name — row skipped' });
      return;
    }

    const gradeText = read(raw, 'grade');
    let graduationYear = parseGraduationYear(read(raw, 'graduationYear'), referenceYear) ?? undefined;
    if (graduationYear === undefined && options.deriveGradYearFromGrade) {
      graduationYear = graduationYearFromGrade(gradeText, now) ?? undefined;
    }

    const goalText = read(raw, 'personalGoal').replace(/[$,]/g, '');
    const goal = goalText ? Number(goalText) : NaN;

    const email = read(raw, 'email').toLowerCase();
    const parentEmail = read(raw, 'parentEmail').toLowerCase();

    rows.push({
      name,
      email: email || undefined,
      phone: read(raw, 'phone') || undefined,
      parentEmail: parentEmail || undefined,
      parentPhone: read(raw, 'parentPhone') || undefined,
      graduationYear,
      grade: gradeText || undefined,
      position: read(raw, 'position') || undefined,
      jerseyNumber: read(raw, 'jerseyNumber') || undefined,
      personalGoal: Number.isFinite(goal) && goal > 0 ? goal : undefined,
      _row: rowNumber,
    });
  });

  return { rows, errors };
}
