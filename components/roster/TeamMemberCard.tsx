'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils/formatters';

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
}

interface TeamMemberCardProps {
  member: TeamMember;
  campaignSlug: string;
  canManage: boolean;
  onEdit: (member: TeamMember) => void;
  onDelete: (memberId: string) => void;
  onResendInvite: (memberId: string) => void;
}

export function TeamMemberCard({
  member,
  campaignSlug,
  canManage,
  onEdit,
  onDelete,
  onResendInvite,
}: TeamMemberCardProps) {
  const fundraisingLink = `/raise/${campaignSlug}/player/${member.fundLinkCode}`;
  const progressPercentage = member.personalGoal
    ? Math.min((member.amountRaised / member.personalGoal) * 100, 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'DECLINED':
        return 'bg-red-100 text-red-800';
      case 'EMAIL_FAILED':
        return 'bg-orange-100 text-orange-800';
      case 'REMOVED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return 'Active';
      case 'PENDING':
        return 'Invitation Sent';
      case 'DECLINED':
        return 'Declined';
      case 'EMAIL_FAILED':
        return 'Email Failed';
      case 'REMOVED':
        return 'Removed';
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {member.profilePhotoUrl ? (
            <Image
              src={member.profilePhotoUrl}
              alt={member.name}
              width={48}
              height={48}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-lg">
                {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-foreground">{member.name}</h3>
            {member.position && <p className="text-sm text-muted-foreground">{member.position}</p>}
            {member.grade && <p className="text-xs text-muted-foreground">Grade {member.grade}</p>}
          </div>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(member.invitationStatus)}`}>
          {getStatusLabel(member.invitationStatus)}
        </span>
      </div>

      {/* Progress Bar */}
      {member.personalGoal && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {formatCurrency(member.amountRaised)} of {formatCurrency(member.personalGoal)}
            </span>
          </div>
          <div className="w-full bg-accent rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {progressPercentage.toFixed(0)}% complete
          </div>
        </div>
      )}

      {/* Email and Link */}
      <div className="space-y-2 mb-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Email:</span>
          <span className="ml-2 text-foreground">{member.email}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Fundraising Link:</span>
          <Link
            href={fundraisingLink}
            target="_blank"
            className="ml-2 text-blue-600 hover:underline text-xs"
          >
            {fundraisingLink}
          </Link>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={fundraisingLink}
          target="_blank"
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center"
        >
          View Page
        </Link>

        {canManage && (
          <>
            <button
              onClick={() => onEdit(member)}
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors"
            >
              Edit
            </button>

            {member.invitationStatus === 'PENDING' && (
              <button
                onClick={() => onResendInvite(member.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-success text-white rounded hover:bg-success transition-colors"
              >
                Resend Invite
              </button>
            )}

            {member.invitationStatus !== 'REMOVED' && (
              <button
                onClick={() => onDelete(member.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-warning text-white rounded hover:bg-warning transition-colors"
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}