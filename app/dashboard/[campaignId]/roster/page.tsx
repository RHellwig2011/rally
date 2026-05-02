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

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  personalGoal?: string;
  amountRaised: string;
  emailVerified: boolean;
  referralCode?: string;
  donationCount: number;
  clickCount: number;
  createdAt: Date;
}

export default function RosterPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const router = useRouter();
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
        headers: { 'Content-Type': 'application/json' },
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

  const copyReferralLink = (referralCode: string) => {
    const link = `${window.location.origin}/raise/${params.campaignId}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(referralCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading && teamMembers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">Rally</span>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-11 w-40 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-28 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="bg-white border rounded-lg p-6">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
            <div className="overflow-x-auto">
              <div className="space-y-4">
                {/* Table Header */}
                <div className="flex gap-4 pb-3 border-b">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
                {/* Table Rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4 py-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                      <div key={j} className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Rally</span>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Roster</h1>
            <p className="text-gray-600">
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
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-900">{error}</p>
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
                    <span className="text-gray-600 mr-2">$</span>
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
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Members
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {teamMembers.length}
              </div>
              <p className="text-sm text-gray-500 mt-1">Active team members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Raised by Team
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(
                  teamMembers.reduce((sum, m) => sum + parseInt(m.amountRaised), 0)
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Combined fundraising</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Top Fundraiser
              </CardTitle>
              <Trophy className="w-5 h-5 text-warning" />
            </CardHeader>
            <CardContent>
              {teamMembers.length > 0 ? (
                <>
                  <div className="text-xl font-bold text-gray-900 truncate">
                    {teamMembers[0].name}
                  </div>
                  <p className="text-sm text-success mt-1">
                    {formatCurrency(parseInt(teamMembers[0].amountRaised))}
                  </p>
                </>
              ) : (
                <p className="text-gray-500">No members yet</p>
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
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No team members yet
                </h3>
                <p className="text-gray-600 mb-4">
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
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Rank
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Amount Raised
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Personal Goal
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Donations
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member, index) => (
                      <tr key={member.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">#{index + 1}</span>
                            {index === 0 && <Trophy className="w-4 h-4 text-warning" />}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">{member.name}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-gray-600">{member.email}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-success">
                            {formatCurrency(parseInt(member.amountRaised))}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-gray-600">
                            {member.personalGoal
                              ? formatCurrency(parseInt(member.personalGoal))
                              : '-'}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-gray-600">{member.donationCount}</p>
                        </td>
                        <td className="py-4 px-4">
                          {member.emailVerified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Mail className="w-3 h-3 mr-1" />
                              Invited
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {member.referralCode && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyReferralLink(member.referralCode!)}
                            >
                              {copiedCode === member.referralCode ? (
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
