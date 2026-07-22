"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  Mail,
  MailX,
  DollarSign,
  Download,
  Search,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

/**
 * The alumni database.
 *
 * Every season's roster import creates a new TeamMember row, so the same
 * athlete shows up once per season they played. The API collapses those into
 * one record per human and flags who has already graduated. This page is the
 * campaign manager's view of that.
 *
 * Deliberately read-only: there is no "email all alumni" button here yet. See
 * the note at the bottom of the page.
 */

type AlumniStatus = "CURRENT" | "ALUMNI" | "UNKNOWN";

interface AlumniSeason {
  campaignId: string;
  campaignName: string | null;
  seasonYear: number | null;
  startDate: string | null;
  amountRaised: number;
}

interface AlumniRow {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  graduationYear: number | null;
  status: AlumniStatus;
  jerseyNumber: string | null;
  position: string | null;
  seasonsPlayed: AlumniSeason[];
  seasonCount: number;
  firstSeason: AlumniSeason | null;
  lastSeason: AlumniSeason | null;
  /** Cents — formatCurrency expects cents, so pass straight through. */
  lifetimeRaised: number;
  emailSuppressed: boolean;
  phoneSuppressed: boolean;
  suppressed: boolean;
  contactableByEmail: boolean;
  lastContactedAt: string | null;
}

interface AlumniSummary {
  totalPeople: number;
  totalAlumni: number;
  totalCurrent: number;
  totalUnknown: number;
  alumniWithContactableEmail: number;
  alumniSuppressed: number;
  /** Cents. */
  alumniLifetimeRaised: number;
  rosterRowsScanned: number;
}

interface ProgramSummary {
  id: string;
  organizationName: string;
  teamName: string;
  sport: string | null;
  slug: string;
}

interface ProgramListEntry {
  id: string;
  campaigns: { id: string }[];
}

const PAGE_SIZE = 50;

const STATUS_TABS: { id: string; label: string }[] = [
  { id: "alumni", label: "Alumni" },
  { id: "current", label: "Current" },
  { id: "unknown", label: "Unknown" },
  { id: "all", label: "All" },
];

function statusBadge(status: AlumniStatus) {
  switch (status) {
    case "ALUMNI":
      return "bg-primary-100 text-primary-800";
    case "CURRENT":
      return "bg-success-light text-success-dark";
    default:
      // Unknown is a prompt for a human decision, not an error.
      return "bg-gray-100 text-gray-600";
  }
}

function formatSeason(season: AlumniSeason | null): string {
  if (!season) return "—";
  if (season.seasonYear) return String(season.seasonYear);
  if (season.startDate) return String(new Date(season.startDate).getFullYear());
  return season.campaignName ?? "—";
}

export default function AlumniPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const { campaignId } = params;

  const [programId, setProgramId] = useState<string | null>(null);
  const [programResolved, setProgramResolved] = useState(false);
  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [alumni, setAlumni] = useState<AlumniRow[]>([]);
  const [summary, setSummary] = useState<AlumniSummary | null>(null);
  const [graduationYears, setGraduationYears] = useState<number[]>([]);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState("alumni");
  const [gradYear, setGradYear] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The campaign detail endpoint does not expose programId, so resolve it from
  // the programs list — which is already scoped to programs this user leads.
  useEffect(() => {
    let cancelled = false;

    const resolveProgram = async () => {
      try {
        const res = await fetch("/api/programs");
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load programs");
          return;
        }

        const match = (data.programs as ProgramListEntry[]).find((p) =>
          p.campaigns.some((c) => c.id === campaignId)
        );
        setProgramId(match?.id ?? null);
      } catch {
        if (!cancelled) setError("Failed to load programs");
      } finally {
        if (!cancelled) {
          setProgramResolved(true);
          setIsLoading(false);
        }
      }
    };

    resolveProgram();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("status", status);
    qs.set("limit", String(PAGE_SIZE));
    qs.set("offset", String(offset));
    if (search.trim()) qs.set("search", search.trim());
    if (gradYear) qs.set("graduationYear", gradYear);
    return qs.toString();
  }, [status, offset, search, gradYear]);

  const fetchAlumni = useCallback(async () => {
    if (!programId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${programId}/alumni?${queryString}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load alumni");
        return;
      }
      setAlumni(data.alumni);
      setSummary(data.summary);
      setProgram(data.program);
      setGraduationYears(data.graduationYears);
      setTotal(data.pagination.total);
    } catch {
      setError("Failed to load alumni");
    } finally {
      setIsLoading(false);
    }
  }, [programId, queryString]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const exportHref = useMemo(() => {
    if (!programId) return "#";
    const qs = new URLSearchParams();
    qs.set("status", status);
    qs.set("export", "csv");
    if (search.trim()) qs.set("search", search.trim());
    if (gradYear) qs.set("graduationYear", gradYear);
    return `/api/programs/${programId}/alumni?${qs.toString()}`;
  }, [programId, status, search, gradYear]);

  const header = (
    <nav className="bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Rally</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href={`/dashboard/${campaignId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );

  // --- Empty state: campaign is not linked to a program yet ----------------
  // Alumni only exist relative to a Program, because that is the entity that
  // spans seasons. A standalone campaign has no history to draw on.
  if (programResolved && !programId) {
    return (
      <div className="min-h-screen bg-muted">
        {header}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <LinkIcon className="w-7 h-7 text-primary-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                This campaign isn&apos;t linked to a program yet
              </h1>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                An alumni database is built from a <strong>program</strong> — the
                team that persists year after year — not from a single season. Once
                this campaign is linked to a program, every past season&apos;s roster
                becomes searchable here, and athletes who have already graduated are
                identified automatically from their graduation year.
              </p>
              <div className="bg-muted border border-border rounded-lg p-5 text-left">
                <p className="text-sm font-semibold text-foreground mb-2">
                  To link this campaign to a program:
                </p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>
                    Open the campaign settings and choose an existing program, or
                    create one for your team (for example &ldquo;Lincoln High
                    Varsity Basketball&rdquo;).
                  </li>
                  <li>
                    Import each past season&apos;s roster into its own campaign under
                    that program.
                  </li>
                  <li>
                    Make sure rosters include a graduation year — without it an
                    athlete stays <em>Unknown</em> rather than being guessed at.
                  </li>
                </ol>
              </div>
              {error && (
                <p className="text-sm text-warning mt-5 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!programResolved) {
    return (
      <div className="min-h-screen bg-muted">
        {header}
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const tiles = [
    {
      label: "Total alumni",
      value: summary ? summary.totalAlumni.toLocaleString() : "—",
      hint: summary
        ? `${summary.totalPeople.toLocaleString()} people across ${summary.rosterRowsScanned.toLocaleString()} roster rows`
        : "",
      icon: GraduationCap,
      tone: "text-primary-600 bg-primary-100",
    },
    {
      label: "Reachable by email",
      value: summary ? summary.alumniWithContactableEmail.toLocaleString() : "—",
      hint: summary
        ? `${summary.alumniSuppressed.toLocaleString()} opted out and excluded`
        : "",
      icon: Mail,
      tone: "text-success-dark bg-success-light",
    },
    {
      label: "Alumni lifetime raised",
      value: summary ? formatCurrency(summary.alumniLifetimeRaised) : "—",
      hint: "Across every season they played",
      icon: DollarSign,
      tone: "text-secondary-700 bg-secondary-100",
    },
    {
      label: "Unknown grad year",
      value: summary ? summary.totalUnknown.toLocaleString() : "—",
      hint: "Not classified — add a graduation year",
      icon: Users,
      tone: "text-gray-600 bg-gray-100",
    },
  ];

  return (
    <div className="min-h-screen bg-muted">
      {header}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni database</h1>
            <p className="text-muted-foreground mt-1">
              {program
                ? `${program.organizationName} — ${program.teamName}`
                : "Every athlete who has ever been on this program's roster."}
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={exportHref} download>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </a>
          </Button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {tiles.map((tile) => (
            <Card key={tile.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{tile.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {tile.value}
                    </p>
                    {tile.hint && (
                      <p className="text-xs text-muted-foreground mt-1">{tile.hint}</p>
                    )}
                  </div>
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${tile.tone}`}
                  >
                    <tile.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStatus(tab.id);
                      setOffset(0);
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      status === tab.id
                        ? "bg-primary text-white"
                        : "bg-white text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={gradYear}
                onChange={(e) => {
                  setGradYear(e.target.value);
                  setOffset(0);
                }}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground"
                aria-label="Filter by graduation year"
              >
                <option value="">All graduation years</option>
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    Class of {year}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name, email or phone"
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-warning bg-warning-light p-4 text-sm text-warning">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">
              {total.toLocaleString()} {total === 1 ? "person" : "people"}
              {status !== "all" && ` · ${status}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : alumni.length === 0 ? (
              <div className="text-center py-20 px-6">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium">No one matches these filters</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Athletes without a graduation year are listed under
                  &ldquo;Unknown&rdquo; rather than being assumed to have graduated.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Athlete</th>
                      <th className="px-6 py-3 font-medium">Class</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Seasons</th>
                      <th className="px-6 py-3 font-medium">Contact</th>
                      <th className="px-6 py-3 font-medium text-right">
                        Lifetime raised
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {alumni.map((row) => (
                      <tr
                        key={row.key}
                        className={
                          row.suppressed ? "bg-red-50/50" : "hover:bg-gray-50"
                        }
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">
                            {row.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[
                              row.jerseyNumber ? `#${row.jerseyNumber}` : null,
                              row.position,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground">
                          {row.graduationYear ?? (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                                row.status
                              )}`}
                            >
                              {row.status === "UNKNOWN"
                                ? "Unknown"
                                : row.status === "ALUMNI"
                                ? "Alumni"
                                : "Current"}
                            </span>
                            {row.suppressed && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-light text-warning border border-warning"
                                title="This person opted out of contact. Do not include them in any outreach."
                              >
                                <MailX className="w-3 h-3" />
                                Opted out
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground">
                          <div className="flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-muted-foreground" />
                            {row.seasonCount}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatSeason(row.firstSeason)}
                            {row.seasonCount > 1 &&
                              ` – ${formatSeason(row.lastSeason)}`}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {row.email ? (
                            <div
                              className={
                                row.emailSuppressed
                                  ? "text-red-600 line-through"
                                  : "text-gray-700"
                              }
                            >
                              {row.email}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No email</div>
                          )}
                          {row.phone && (
                            <div
                              className={`text-xs ${
                                row.phoneSuppressed
                                  ? "text-warning line-through"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {row.phone}
                            </div>
                          )}
                          {row.lastContactedAt && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Last contacted{" "}
                              {new Date(row.lastContactedAt).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {formatCurrency(row.lifetimeRaised)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(offset + 1, total)}–
              {Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || isLoading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total || isLoading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Why there is no send button here yet. */}
        <div className="mt-8 rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1.5">
            Contacting alumni
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bulk sending is intentionally not wired up on this page yet. Much of
            this contact data was collected while the athletes were minors, and
            anyone marked <strong>Opted out</strong> must be excluded from every
            send. Once the outreach service enforces suppression at send time,
            this page will get a send path that reuses it. In the meantime, export
            the CSV and note that the <em>Contactable by email</em> column already
            excludes opted-out addresses.
          </p>
        </div>
      </div>
    </div>
  );
}
