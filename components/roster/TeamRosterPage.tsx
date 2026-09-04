'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TeamMemberCard } from './TeamMemberCard';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { RosterFilters } from './RosterFilters';
import { EmptyRosterState } from './EmptyRosterState';
import { RosterStats } from './RosterStats';
import { toast } from 'react-hot-toast';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  personalGoal: number | null;
  amountRaised: number;
  position?: string | null;
  grade?: string | null;
  profilePhotoUrl?: string | null;
  fundLinkCode: string;
  invitationStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REMOVED' | 'EMAIL_FAILED';
  onboardingLink?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamRosterPageProps {
  campaignId: string;
  campaignSlug: string;
  isLeader: boolean;
  isGuardian: boolean;
}

export function TeamRosterPage({
  campaignId,
  campaignSlug,
  isLeader,
  isGuardian
}: TeamRosterPageProps) {
  const router = useRouter();
  const { csrfToken } = useCsrfToken();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'amountRaised' | 'name' | 'date'>('amountRaised');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const canManage = isLeader || isGuardian;

  // Fetch team members
  const fetchMembers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        sortBy,
      });

      const response = await fetch(`/api/campaigns/${campaignId}/team-members?${params}`);
      const data = await response.json();

      // Gate on the payload, not just the HTTP status, and read the key the
      // endpoint actually returns (`teamMembers`). Reading a missing key and
      // defaulting to [] renders a full roster as an empty one with no error —
      // silence is the worst possible failure mode here.
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch team members');
      }
      if (!Array.isArray(data.teamMembers)) {
        throw new Error('Unexpected response from the team members endpoint');
      }

      setMembers(data.teamMembers);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load team members'
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId, searchTerm, statusFilter, sortBy]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Handle member update
  const handleUpdateMember = async (memberId: string, updates: Partial<TeamMember>) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/team-members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update member');
      }

      toast.success('Team member updated successfully');
      fetchMembers();
    } catch (error) {
      console.error('Failed to update member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update team member');
    }
  };

  // Handle member deletion
  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member? Their donation history will be preserved.')) {
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/team-members/${memberId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });

      if (!response.ok) throw new Error('Failed to remove member');

      toast.success('Team member removed successfully');
      fetchMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove team member');
    }
  };

  // Handle resend invitation
  const handleResendInvitation = async (memberId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/team-members/${memberId}/resend-invite`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(`Rate limit exceeded. You can resend in ${Math.ceil(data.retryAfter / 60)} minutes`);
        } else {
          throw new Error(data.error || 'Failed to resend invitation');
        }
        return;
      }

      toast.success('Invitation sent successfully');
      fetchMembers();
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      toast.error('Failed to resend invitation');
    }
  };

  // H7: copy the onboarding link so the coach can hand it to the player
  // directly (text, team chat, printed sheet) instead of relying on email.
  const handleCopyInviteLink = async (member: TeamMember) => {
    if (!member.onboardingLink) {
      toast.error('No invite link available for this player');
      return;
    }
    try {
      await navigator.clipboard.writeText(member.onboardingLink);
      toast.success(`Invite link copied for ${member.name}`);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
      toast.error('Could not copy the link — copy it manually instead');
    }
  };

  // Handle adding a new member
  const handleAddMember = async (memberData: any) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/team-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(memberData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(`Rate limit exceeded. You can add more members in ${Math.ceil(data.retryAfter / 60)} minutes`);
        } else {
          throw new Error(data.error || 'Failed to add member');
        }
        return;
      }

      toast.success('Team member added successfully');
      setShowAddModal(false);
      fetchMembers();
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add team member');
    }
  };

  const goToImport = () => {
    router.push(`/dashboard/${campaignId}/roster/import`);
  };

  // Calculate statistics
  const totalRaised = members.reduce((sum, m) => sum + m.amountRaised, 0);
  const totalGoal = members.reduce((sum, m) => sum + (m.personalGoal || 0), 0);
  const activeMembers = members.filter(m => m.invitationStatus === 'ACCEPTED').length;
  const pendingInvitations = members.filter(m => m.invitationStatus === 'PENDING').length;

  // Filter and sort members
  const filteredMembers = members
    .filter(member => {
      if (statusFilter !== 'all' && member.invitationStatus !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          member.name.toLowerCase().includes(search) ||
          member.email.toLowerCase().includes(search) ||
          member.position?.toLowerCase().includes(search) ||
          member.grade?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'amountRaised':
          return b.amountRaised - a.amountRaised;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <RosterStats
        totalMembers={members.length}
        activeMembers={activeMembers}
        pendingInvitations={pendingInvitations}
        totalRaised={totalRaised}
        totalGoal={totalGoal}
      />

      {/* Action Buttons */}
      {canManage && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all"
          >
            Add Team Member
          </button>
          <button
            onClick={goToImport}
            className="px-4 py-2 bg-success text-success-foreground rounded-lg hover:brightness-110 transition-all"
          >
            Import roster
          </button>
          <a
            href={`/api/campaigns/${campaignId}/import-roster`}
            download="team_roster_template.csv"
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Download CSV Template
          </a>
        </div>
      )}

      {/* Filters and Search */}
      <RosterFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Team Members Grid */}
      {filteredMembers.length === 0 ? (
        <EmptyRosterState
          hasMembers={members.length > 0}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          canManage={canManage}
          onAddMember={() => setShowAddModal(true)}
          onImportCSV={goToImport}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              campaignSlug={campaignSlug}
              canManage={canManage}
              onEdit={(member) => setSelectedMember(member as TeamMember)}
              onDelete={handleDeleteMember}
              onResendInvite={handleResendInvitation}
              onCopyInviteLink={(m) => {
                void handleCopyInviteLink(m as unknown as TeamMember);
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddTeamMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddMember}
        />
      )}

      {selectedMember && (
        <AddTeamMemberModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={(data) => handleUpdateMember(selectedMember.id, data)}
        />
      )}
    </div>
  );
}