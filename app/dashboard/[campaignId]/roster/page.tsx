"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Mail,
  TrendingUp,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  Trophy,
  DollarSign,
  AlertCircle,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Kicker,
  PageTitle,
  SiteHeader,
  tableStyles,
} from "@/components/app-chrome";
import { formatCurrency } from "@/lib/utils";
import { useCsrfToken } from "@/hooks/useCsrfToken";

const { th: TH, td: TD, tr: TR } = tableStyles;

// Night-card silhouette used by the loading state.
const SKELETON_CARD =
  "rounded-card border border-white/10 bg-[linear-gradient(165deg,#1B2334,#121826)] p-6 shadow-card";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  // Dollar values (the team-members API divides cents by 100 before responding)
  personalGoal?: number | null;
  amountRaised: number;
  invitationStatus: "PENDING" | "ACCEPTED" | "EMAIL_FAILED" | "EXPIRED";
  fundLinkCode?: string | null;
  fundraisingLink?: string | null;
  donationCount: number;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
  } | null;
  createdAt: Date;
}

// formatCurrency expects cents; the team-members API returns dollars
const formatDollars = (dollars: number | string | null | undefined) =>
  formatCurrency(Math.round(Number(dollars ?? 0) * 100));

export default function RosterPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const router = useRouter();
  const { csrfToken } = useCsrfToken();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addMemberForm, setAddMemberForm] = useState({
    name: "",
    email: "",
    personalGoal: "",
  });
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    personalGoal: "",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, [params.campaignId]);

  const fetchTeamMembers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/campaigns/${params.campaignId}/team-members`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(data.error || 'Failed to fetch team members');
      }

      setTeamMembers(data.teamMembers);
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberForm.name || !addMemberForm.email) {
      setError("Name and email are required");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/campaigns/${params.campaignId}/team-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          name: addMemberForm.name,
          email: addMemberForm.email,
          personalGoal: addMemberForm.personalGoal ? parseFloat(addMemberForm.personalGoal) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add team member');
      }

      // Refresh team members list
      await fetchTeamMembers();

      // Close dialog and reset form
      setIsAddDialogOpen(false);
      setAddMemberForm({ name: "", email: "", personalGoal: "" });
    } catch (err) {
      console.error('Error adding team member:', err);
      setError(err instanceof Error ? err.message : 'Failed to add team member');
    } finally {
      setIsLoading(false);
    }
  };

  const copyFundraisingLink = (memberId: string, fundraisingLink: string) => {
    navigator.clipboard.writeText(fundraisingLink);
    setCopiedCode(memberId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openEdit = (member: TeamMember) => {
    setActionError(null);
    setEditMember(member);
    setEditForm({
      name: member.name,
      email: member.email,
      personalGoal:
        member.personalGoal != null ? String(member.personalGoal) : "",
    });
  };

  const handleUpdateMember = async () => {
    if (!editMember) return;
    if (!editForm.name || !editForm.email) {
      setActionError("Name and email are required");
      return;
    }

    try {
      setBusyMemberId(editMember.id);
      setActionError(null);

      const res = await fetch(
        `/api/campaigns/${params.campaignId}/team-members/${editMember.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            name: editForm.name,
            email: editForm.email,
            personalGoal: editForm.personalGoal
              ? parseFloat(editForm.personalGoal)
              : null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update team member");
      }

      setEditMember(null);
      await fetchTeamMembers();
    } catch (err) {
      console.error("Error updating team member:", err);
      setActionError(
        err instanceof Error ? err.message : "Failed to update team member"
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (
      !confirm(
        `Remove ${member.name} from the roster? Their donation history will be kept.`
      )
    ) {
      return;
    }

    try {
      setBusyMemberId(member.id);
      setError(null);

      const res = await fetch(
        `/api/campaigns/${params.campaignId}/team-members/${member.id}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": csrfToken },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove team member");
      }

      await fetchTeamMembers();
    } catch (err) {
      console.error("Error removing team member:", err);
      setError(
        err instanceof Error ? err.message : "Failed to remove team member"
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      setBusyMemberId(member.id);
      setError(null);

      const res = await fetch(
        `/api/campaigns/${params.campaignId}/team-members/${member.id}/resend-invite`,
        {
          method: "POST",
          headers: { "x-csrf-token": csrfToken },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend invitation");
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to resend invitation"
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  if (isLoading && teamMembers.length === 0) {
    return (
      <div className="min-h-screen">
        <SiteHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-11 w-40" />
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className={SKELETON_CARD}>
                <div className="flex justify-between items-center mb-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className={SKELETON_CARD}>
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="overflow-x-auto">
              <div className="space-y-4">
                {/* Table Header */}
                <div className="flex gap-4 border-b border-border pb-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                  ))}
                </div>
                {/* Table Rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4 py-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                      <Skeleton key={j} className="h-4 flex-1" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <SiteHeader>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${params.campaignId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </SiteHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Kicker tone="team">Roster</Kicker>
            <PageTitle className="mb-2 mt-2">Team Roster</PageTitle>
            <p className="text-muted-foreground">
              Manage your team members and track their fundraising progress
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="outline" asChild>
              <Link href={`/dashboard/${params.campaignId}/roster/import`}>
                <Upload className="w-4 h-4 mr-2" />
                Import roster
              </Link>
            </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Invite a new member to your team. They'll receive an email with instructions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="bg-warning-light border border-warning rounded-lg p-3">
                    <p className="text-sm text-warning-dark">{error}</p>
                  </div>
                )}
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={addMemberForm.name}
                    onChange={(e) =>
                      setAddMemberForm({ ...addMemberForm, name: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@email.com"
                    value={addMemberForm.email}
                    onChange={(e) =>
                      setAddMemberForm({ ...addMemberForm, email: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="personalGoal">Personal Fundraising Goal (Optional)</Label>
                  <div className="flex items-center mt-2">
                    <span className="text-muted-foreground mr-2">$</span>
                    <Input
                      id="personalGoal"
                      type="number"
                      placeholder="500"
                      value={addMemberForm.personalGoal}
                      onChange={(e) =>
                        setAddMemberForm({ ...addMemberForm, personalGoal: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={isLoading || !addMemberForm.name || !addMemberForm.email}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total Members
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {teamMembers.length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Active team members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total Raised by Team
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {formatDollars(
                  teamMembers.reduce((sum, m) => sum + Number(m.amountRaised), 0)
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Combined fundraising</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Top Fundraiser
              </CardTitle>
              <Trophy className="w-5 h-5 text-warning" />
            </CardHeader>
            <CardContent>
              {teamMembers.length > 0 ? (
                <>
                  <div className="text-xl font-bold text-foreground truncate">
                    {teamMembers[0].name}
                  </div>
                  <p className="text-sm text-success mt-1">
                    {formatDollars(teamMembers[0].amountRaised)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">No members yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-[0.04em]">
              <Users className="w-5 h-5" />
              Team Members ({teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No team members yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first team member
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/${params.campaignId}/roster/import`}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import roster
                    </Link>
                  </Button>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Team Member
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={TH}>Rank</th>
                      <th className={TH}>Name</th>
                      <th className={TH}>Email</th>
                      <th className={`${TH} text-right`}>Amount Raised</th>
                      <th className={`${TH} text-right`}>Personal Goal</th>
                      <th className={`${TH} text-right`}>Donations</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member, index) => (
                      <tr key={member.id} className={TR}>
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold tabular text-foreground">
                              #{index + 1}
                            </span>
                            {index === 0 && <Trophy className="w-4 h-4 text-[var(--bb-warning)]" />}
                          </div>
                        </td>
                        <td className={TD}>
                          <p className="font-semibold text-foreground">{member.name}</p>
                        </td>
                        <td className={TD}>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </td>
                        <td className={`${TD} text-right`}>
                          {/* Positive money column reads accent green — BRIEF §3 */}
                          <p className="font-semibold text-success-dark">
                            {formatDollars(member.amountRaised)}
                          </p>
                        </td>
                        <td className={`${TD} text-right`}>
                          <p className="text-sm text-muted-foreground">
                            {member.personalGoal != null
                              ? formatDollars(member.personalGoal)
                              : '-'}
                          </p>
                        </td>
                        <td className={`${TD} text-right`}>
                          <p className="text-sm text-muted-foreground">{member.donationCount}</p>
                        </td>
                        <td className={TD}>
                          {member.invitationStatus === "ACCEPTED" ? (
                            <span className="inline-flex items-center rounded-full border border-secondary/40 bg-[rgba(34,196,139,.12)] px-2.5 py-0.5 text-xs font-semibold text-success-dark">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          ) : member.invitationStatus === "PENDING" ? (
                            <span className="inline-flex items-center rounded-full border border-[rgba(232,163,61,.4)] bg-[rgba(232,163,61,.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--bb-warning)]">
                              <Mail className="w-3 h-3 mr-1" />
                              Invited
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-destructive/40 bg-[rgba(242,97,75,.12)] px-2.5 py-0.5 text-xs font-semibold text-destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {member.invitationStatus === "EMAIL_FAILED"
                                ? "Email Failed"
                                : "Expired"}
                            </span>
                          )}
                        </td>
                        <td className={TD}>
                          <div className="flex flex-wrap gap-2">
                          {member.fundraisingLink && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyFundraisingLink(member.id, member.fundraisingLink!)
                              }
                            >
                              {copiedCode === member.id ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <LinkIcon className="w-3 h-3 mr-1" />
                                  Copy Link
                                </>
                              )}
                            </Button>
                          )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(member)}
                              disabled={busyMemberId === member.id}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            {member.invitationStatus !== "ACCEPTED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendInvite(member)}
                                disabled={busyMemberId === member.id}
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Resend invite
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMember(member)}
                              disabled={busyMemberId === member.id}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={editMember !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditMember(null);
              setActionError(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit team member</DialogTitle>
              <DialogDescription>
                Email is updated on this record so fundraising already attributed
                to them stays attached.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {actionError && (
                <div className="bg-warning-light border border-warning rounded-lg p-3">
                  <p className="text-sm text-warning-dark">{actionError}</p>
                </div>
              )}
              <div>
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-goal">Personal Fundraising Goal (Optional)</Label>
                <div className="flex items-center mt-2">
                  <span className="text-muted-foreground mr-2">$</span>
                  <Input
                    id="edit-goal"
                    type="number"
                    placeholder="500"
                    value={editForm.personalGoal}
                    onChange={(e) =>
                      setEditForm({ ...editForm, personalGoal: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMember(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMember}
                disabled={
                  !!busyMemberId || !editForm.name || !editForm.email
                }
              >
                {busyMemberId ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
