'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils/formatters';

interface RosterStatsProps {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  totalRaised: number;
  totalGoal: number;
}

export function RosterStats({
  totalMembers,
  activeMembers,
  pendingInvitations,
  totalRaised,
  totalGoal,
}: RosterStatsProps) {
  const progressPercentage = totalGoal > 0 ? Math.min((totalRaised / totalGoal) * 100, 100) : 0;

  return (
    <div className="rounded-card border border-white/10 bg-card shadow-card p-6">
      <h2 className="text-lg font-semibold font-display text-foreground mb-4">Team Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Total Members</p>
          <p className="text-2xl font-bold">{totalMembers}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-success">{activeMembers}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-[var(--bb-warning)]">{pendingInvitations}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Raised</p>
          <p className="text-2xl font-bold text-secondary">{formatCurrency(totalRaised)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Team Goal</p>
          <p className="text-2xl font-bold">{formatCurrency(totalGoal)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {totalGoal > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Team Progress</span>
            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-accent rounded-full h-3">
            <div
              className="bg-secondary shadow-glow-accent h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatCurrency(totalRaised)} raised</span>
            <span>{formatCurrency(totalGoal)} goal</span>
          </div>
        </div>
      )}
    </div>
  );
}