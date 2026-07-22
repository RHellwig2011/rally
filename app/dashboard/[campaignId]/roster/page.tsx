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
import { formatCurrency } from "@/lib/utils";
import { useCsrfToken } from "@/hooks/useCsrfToken";

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

  if (isLoading && teamMembers.length === 0) {
    return (
      <div className="min-h-screen bg-muted">
        <nav className="border-b bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <span className="text-2xl font-bold text-foreground">Rally</span>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <div className="h-9 w-48 bg-accent rounded animate-pulse" />
              <div className="h-4 w-96 bg-accent rounded animate-pulse" />
            </div>
            <div className="h-11 w-40 bg-accent rounded animate-pulse" />
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="h-4 w-32 bg-accent rounded animate-pulse" />
                  <div className="h-5 w-5 bg-accent rounded-full animate-pulse" />
                </div>
                <div className="h-8 w-16 bg-accent rounded animate-pulse mb-2" />
                <div className="h-3 w-28 bg-accent rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="bg-white border rounded-lg p-6">
            <div className="h-6 w-48 bg-accent rounded animate-pulse mb-6" />
            <div className="overflow-x-auto">
              <div className="space-y-4">
                {/* Table Header */}
                <div className="flex gap-4 pb-3 border-b">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-4 flex-1 bg-accent rounded animate-pulse" />
                  ))}
                </div>
                {/* Table Rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4 py-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                      <div key={j} className="h-4 flex-1 bg-accent rounded animate-pulse" />
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
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Rally</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link href={`/dashboard/${params.campaignId}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Team Roster</h1>
            <p className="text-muted-foreground">
              Manage your team members and track their fundraising progress
            </p>
          </div>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Members
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {teamMembers.length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Active team members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Raised by Team
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatDollars(
                  teamMembers.reduce((sum, m) => sum + Number(m.amountRaised), 0)
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Combined fundraising</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
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
            <CardTitle className="flex items-center gap-2">
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
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Team Member
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Rank
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Amount Raised
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Personal Goal
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Donations
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member, index) => (
                      <tr key={member.id} className="border-b hover:bg-muted">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">#{index + 1}</span>
                            {index === 0 && <Trophy className="w-4 h-4 text-warning" />}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-foreground">{member.name}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-success">
                            {formatDollars(member.amountRaised)}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-muted-foreground">
                            {member.personalGoal != null
                              ? formatDollars(member.personalGoal)
                              : '-'}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-muted-foreground">{member.donationCount}</p>
                        </td>
                        <td className="py-4 px-4">
                          {member.invitationStatus === "ACCEPTED" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-light text-success-dark">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          ) : member.invitationStatus === "PENDING" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Mail className="w-3 h-3 mr-1" />
                              Invited
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-light text-warning-dark">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {member.invitationStatus === "EMAIL_FAILED"
                                ? "Email Failed"
                                : "Expired"}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
