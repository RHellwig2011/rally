"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Info,
  Loader2,
  Table2,
  Upload,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import {
  ROSTER_FIELD_LABELS,
  RosterField,
  applyMapping,
  validateMapping,
  MappedRosterRow,
} from "@/lib/utils/roster-mapping";

/**
 * Roster import wizard.
 *
 * Three steps, because the failure mode we care about is a coach importing 60
 * players into the wrong columns and only finding out later: choose a source,
 * confirm how we read the columns against real rows, then confirm and commit.
 *
 * On Hudl specifically: Hudl publishes no roster API and its terms prohibit
 * scraping, so the only legitimate path is the coach exporting their own roster
 * and uploading the file. This page therefore never offers to "connect" to
 * Hudl, and says why in plain language rather than leaving the coach to wonder
 * where the integration button is.
 */

type SourceChoice = "hudl" | "csv" | "paste";
type Step = 1 | 2 | 3 | 4;

type Mapping = Record<string, RosterField | null>;

interface PreviewResponse {
  success: boolean;
  fileName: string | null;
  detectedSource: "HUDL_CSV" | "GENERIC_CSV" | "MANUAL_PASTE";
  headers: string[];
  suggestedMapping: Mapping;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  rowCount: number;
  sampleRows: MappedRosterRow[];
  rows: Record<string, string>[];
  error?: string;
}

interface RowResult {
  row: number;
  name: string;
  email?: string;
  outcome: "created" | "updated" | "skipped" | "failed";
  reason?: string;
}

interface CommitResponse {
  success: boolean;
  summary: { total: number; created: number; updated: number; skipped: number; failed: number };
  results: RowResult[];
  warnings: string[];
  notice: string;
  error?: string;
}

const FIELD_OPTIONS = Object.entries(ROSTER_FIELD_LABELS) as [RosterField, string][];

const SAMPLE_LIMIT = 5;

/** Columns worth showing in the sample preview, in reading order. */
const SAMPLE_COLUMNS: { key: keyof MappedRosterRow; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "graduationYear", label: "Grad year" },
  { key: "jerseyNumber", label: "Jersey" },
  { key: "position", label: "Position" },
];

function ErrorNote({ children }: { children: React.ReactNode }) {
  // Note: the shared Alert's "destructive" variant maps to an unregistered
  // Tailwind colour in this project and renders unstyled, so red is explicit.
  return (
    <div className="flex gap-2 rounded-lg border border-warning bg-warning-light p-3 text-sm text-warning">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export default function RosterImportPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const router = useRouter();
  const { csrfToken } = useCsrfToken();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<SourceChoice>("hudl");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [deriveGradYear, setDeriveGradYear] = useState(false);
  const [attested, setAttested] = useState(false);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [result, setResult] = useState<CommitResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sample rows and validation are recomputed from the coach's *current*
   * mapping, not the server's suggestion, so the table below the dropdowns
   * always shows what would actually be imported.
   */
  const liveValidation = useMemo(() => validateMapping(mapping), [mapping]);

  const liveSample = useMemo(() => {
    if (!preview) return [] as MappedRosterRow[];
    return applyMapping(preview.rows.slice(0, SAMPLE_LIMIT), mapping, {
      deriveGradYearFromGrade: deriveGradYear,
    }).rows;
  }, [preview, mapping, deriveGradYear]);

  const gradeMapped = useMemo(
    () => Object.values(mapping).includes("grade"),
    [mapping]
  );

  /** Step 1 -> 2: parse the roster server-side and get a proposed mapping. */
  const runPreview = async () => {
    setError(null);
    setIsLoading(true);

    try {
      let res: Response;

      if (source === "paste") {
        if (!pastedText.trim()) {
          setError("Paste your roster rows first, including the header row.");
          return;
        }
        res = await fetch(
          `/api/campaigns/${params.campaignId}/roster-import/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": csrfToken,
            },
            body: JSON.stringify({ pastedText }),
          }
        );
      } else {
        if (!file) {
          setError("Choose the roster file you exported.");
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(
          `/api/campaigns/${params.campaignId}/roster-import/preview`,
          {
            method: "POST",
            headers: { "x-csrf-token": csrfToken },
            body: formData,
          }
        );
      }

      const data: PreviewResponse = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error || "We could not read that roster.");
        return;
      }

      setPreview(data);
      setMapping(data.suggestedMapping);
      setStep(2);
    } catch {
      setError("Something went wrong reading that roster. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * A field can only come from one column. Assigning a field that is already
   * taken moves it, rather than silently importing whichever column happens to
   * be read last.
   */
  const setHeaderField = (header: string, field: RosterField | null) => {
    setMapping((current) => {
      const next: Mapping = { ...current };
      if (field) {
        for (const key of Object.keys(next)) {
          if (key !== header && next[key] === field) next[key] = null;
        }
      }
      next[header] = field;
      return next;
    });
  };

  /** Step 3 -> result: write the roster. */
  const runCommit = async () => {
    if (!preview) return;
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/campaigns/${params.campaignId}/roster-import/commit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            mapping,
            rows: preview.rows,
            source: preview.detectedSource,
            fileName: preview.fileName ?? undefined,
            deriveGradYearFromGrade: deriveGradYear,
            attestation: attested,
          }),
        }
      );

      const data: CommitResponse = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error || "The import did not go through.");
        return;
      }

      setResult(data);
      setStep(4);
    } catch {
      setError("Something went wrong importing that roster. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = ["Source", "Match columns", "Confirm"];

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="mx-auto max-w-5xl px-4">
        <Link
          href={`/dashboard/${params.campaignId}/roster`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to roster
        </Link>

        <h1 className="text-3xl font-bold text-foreground">Import your roster</h1>
        <p className="mt-2 text-muted-foreground">
          Upload the roster you already have. Nothing is saved until you confirm
          how the columns line up.
        </p>

        {/* Step indicator */}
        <div className="mt-6 mb-8 flex items-center gap-2">
          {stepLabels.map((label, index) => {
            const number = (index + 1) as Step;
            const active = step === number;
            const done = step > number;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    done
                      ? "bg-success text-white"
                      : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : number}
                </div>
                <span
                  className={`text-sm ${
                    active ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {index < stepLabels.length - 1 && (
                  <ArrowRight className="mx-2 h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {/* ---------------- Step 1: where is the roster from ---------------- */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Hudl: an upload of the coach's own export. Deliberately NOT an
                account connection — see the note rendered below. */}
            <Card
              className={`cursor-pointer transition ${
                source === "hudl" ? "border-primary ring-1 ring-primary" : ""
              }`}
              onClick={() => setSource("hudl")}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={source === "hudl"}
                    onChange={() => setSource("hudl")}
                    className="mt-1.5 h-4 w-4"
                    aria-label="Hudl roster export"
                  />
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Upload your Hudl roster export
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Recommended if your team is already on Hudl.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {source === "hudl" && (
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-4 text-sm text-foreground">
                    <p className="font-medium text-foreground">
                      How to get the file
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>In Hudl, open your team.</li>
                      <li>
                        Go to <strong>Team &rsaquo; Manage Team &rsaquo; Athletes</strong>.
                      </li>
                      <li>
                        Choose <strong>Export</strong> — Hudl downloads an{" "}
                        <strong>.xlsx</strong> file.
                      </li>
                      <li>Upload that file below.</li>
                    </ol>
                  </div>

                  {/* Honesty note: we do not talk to Hudl's servers, and we are
                      not going to imply otherwise with a "Connect" button. */}
                  <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      Hudl does not offer a public roster API, so there is no way
                      to link your Hudl account to us directly. Exporting the file
                      yourself is the supported path — your export stays between
                      you and us.
                    </p>
                  </div>

                  <FilePicker
                    accept=".xlsx,.xlsm,.csv"
                    file={file}
                    onChange={setFile}
                    inputRef={fileInputRef}
                    hint="Hudl exports a .xlsx file. A .csv works too."
                  />
                </CardContent>
              )}
            </Card>

            <Card
              className={`cursor-pointer transition ${
                source === "csv" ? "border-primary ring-1 ring-primary" : ""
              }`}
              onClick={() => setSource("csv")}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={source === "csv"}
                    onChange={() => setSource("csv")}
                    className="mt-1.5 h-4 w-4"
                    aria-label="Spreadsheet or CSV"
                  />
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Table2 className="h-5 w-5 text-muted-foreground" />
                      Any other spreadsheet or CSV
                    </CardTitle>
                    <CardDescription className="mt-1">
                      TeamSnap, SportsEngine, a school list, your own
                      spreadsheet — the columns can be named anything.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {source === "csv" && (
                <CardContent>
                  <FilePicker
                    accept=".xlsx,.xlsm,.csv,.tsv"
                    file={file}
                    onChange={setFile}
                    inputRef={fileInputRef}
                    hint=".xlsx or .csv, up to 5 MB and 1,000 rows."
                  />
                </CardContent>
              )}
            </Card>

            <Card
              className={`cursor-pointer transition ${
                source === "paste" ? "border-primary ring-1 ring-primary" : ""
              }`}
              onClick={() => setSource("paste")}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={source === "paste"}
                    onChange={() => setSource("paste")}
                    className="mt-1.5 h-4 w-4"
                    aria-label="Paste rows"
                  />
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardPaste className="h-5 w-5 text-muted-foreground" />
                      Paste rows
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Copy the cells straight out of Excel or Google Sheets.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {source === "paste" && (
                <CardContent>
                  <Label htmlFor="paste-area">
                    Include the header row so we know what each column is
                  </Label>
                  <Textarea
                    id="paste-area"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={8}
                    className="mt-2 font-mono text-xs"
                    placeholder={
                      "FirstName\tLastName\tEmail\tGraduationYear\nJordan\tRivera\tjordan@example.com\t2027"
                    }
                  />
                </CardContent>
              )}
            </Card>

            <div className="flex justify-end pt-2">
              <Button onClick={runPreview} disabled={isLoading || !csrfToken}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reading roster
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- Step 2: match the columns ---------------- */}
        {step === 2 && preview && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Check how we read your columns</CardTitle>
                <CardDescription>
                  We found {preview.headers.length} columns and{" "}
                  {preview.rowCount} {preview.rowCount === 1 ? "row" : "rows"}
                  {preview.fileName ? ` in ${preview.fileName}` : ""}. Correct
                  anything we guessed wrong. Columns set to “Don’t import” are
                  ignored.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveValidation.errors.map((message) => (
                  <ErrorNote key={message}>{message}</ErrorNote>
                ))}
                {liveValidation.warnings.map((message) => (
                  <div
                    key={message}
                    className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>{message}</div>
                  </div>
                ))}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Your column</th>
                        <th className="py-2 pr-4 font-medium">First value</th>
                        <th className="py-2 font-medium">Import as</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.headers.map((header) => (
                        <tr key={header} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium text-foreground">
                            {header}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {preview.rows[0]?.[header] || (
                              <span className="italic text-muted-foreground">empty</span>
                            )}
                          </td>
                          <td className="py-2">
                            <select
                              aria-label={`Import ${header} as`}
                              value={mapping[header] ?? ""}
                              onChange={(e) =>
                                setHeaderField(
                                  header,
                                  e.target.value
                                    ? (e.target.value as RosterField)
                                    : null
                                )
                              }
                              className="w-full max-w-xs rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Don’t import</option>
                              {FIELD_OPTIONS.map(([field, label]) => (
                                <option key={field} value={field}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {gradeMapped && (
                  <label className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={deriveGradYear}
                      onChange={(e) => setDeriveGradYear(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      Work out each player’s graduation year from their grade.
                      Useful when your file has “11th” but no class year — grad
                      year is what links players to your program across seasons.
                    </span>
                  </label>
                )}
              </CardContent>
            </Card>

            {/* Real data under the mapping, so a wrong guess is obvious. */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  What the first {Math.min(SAMPLE_LIMIT, preview.rowCount)} rows
                  will import as
                </CardTitle>
              </CardHeader>
              <CardContent>
                {liveSample.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No rows can be read with the current column matching. Check
                    that a name column is selected above.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          {SAMPLE_COLUMNS.map((column) => (
                            <th key={column.key} className="py-2 pr-4 font-medium">
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liveSample.map((row) => (
                          <tr key={row._row} className="border-b last:border-0">
                            {SAMPLE_COLUMNS.map((column) => {
                              const value = row[column.key];
                              return (
                                <td
                                  key={column.key}
                                  className="py-2 pr-4 text-foreground"
                                >
                                  {value === undefined || value === "" ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    String(value)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!liveValidation.valid || liveSample.length === 0}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- Step 3: confirm + attestation ---------------- */}
        {step === 3 && preview && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ready to import</CardTitle>
                <CardDescription>
                  {preview.rowCount} {preview.rowCount === 1 ? "row" : "rows"}
                  {preview.fileName ? ` from ${preview.fileName}` : ""}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-4 text-sm text-foreground">
                  <p className="font-medium text-foreground">What happens next</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      Players already on your roster are matched by email, or by
                      name and graduation year. We only fill in details you are
                      missing — nothing you have edited gets overwritten.
                    </li>
                    <li>New players are added with their own fundraising link.</li>
                    <li>
                      <strong>No emails or texts are sent.</strong> Inviting
                      players is a separate step you control from the roster
                      page.
                    </li>
                  </ul>
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-sm text-foreground">
                    I coach or administer this team, and I am allowed to share
                    this roster and its contact details with Bleacher Backers.
                    <span className="mt-1 block text-muted-foreground">
                      Rosters list minors. We record who imported each roster and
                      when, so this is worth being sure about.
                    </span>
                  </span>
                </label>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={runCommit} disabled={!attested || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  `Import ${preview.rowCount} ${
                    preview.rowCount === 1 ? "row" : "rows"
                  }`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- Result ---------------- */}
        {step === 4 && result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Import finished
                </CardTitle>
                <CardDescription>{result.notice}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Added" value={result.summary.created} tone="green" />
                  <Stat label="Updated" value={result.summary.updated} tone="blue" />
                  <Stat label="Skipped" value={result.summary.skipped} tone="gray" />
                  <Stat
                    label="Not imported"
                    value={result.summary.failed}
                    tone={result.summary.failed > 0 ? "red" : "gray"}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Row by row</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Row</th>
                        <th className="py-2 pr-4 font-medium">Player</th>
                        <th className="py-2 pr-4 font-medium">Result</th>
                        <th className="py-2 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((row) => (
                        <tr key={row.row} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{row.row}</td>
                          <td className="py-2 pr-4 text-foreground">
                            {row.name || (
                              <span className="italic text-muted-foreground">
                                no name
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <OutcomeBadge outcome={row.outcome} />
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {row.reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setPreview(null);
                  setResult(null);
                  setFile(null);
                  setPastedText("");
                  setAttested(false);
                  setMapping({});
                }}
              >
                Import another file
              </Button>
              <Link href={`/dashboard/${params.campaignId}/roster`}>
                <Button>
                  Go to roster
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilePicker({
  accept,
  file,
  onChange,
  inputRef,
  hint,
}: {
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  hint: string;
}) {
  return (
    <div>
      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary hover:bg-muted"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        {file ? (
          <p className="text-sm font-medium text-foreground">{file.name}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Click to choose your roster file
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "gray" | "red";
}) {
  const tones = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    gray: "bg-gray-50 text-gray-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-lg p-4 ${tones[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: RowResult["outcome"] }) {
  const styles: Record<RowResult["outcome"], string> = {
    created: "bg-green-100 text-green-800",
    updated: "bg-blue-100 text-blue-800",
    skipped: "bg-gray-100 text-gray-700",
    failed: "bg-red-100 text-red-700",
  };
  const labels: Record<RowResult["outcome"], string> = {
    created: "Added",
    updated: "Updated",
    skipped: "Skipped",
    failed: "Not imported",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[outcome]}`}
    >
      {labels[outcome]}
    </span>
  );
}
