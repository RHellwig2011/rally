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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Team Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-600">Total Members</p>
          <p className="text-2xl font-bold">{totalMembers}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeMembers}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingInvitations}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Total Raised</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalRaised)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Team Goal</p>
          <p className="text-2xl font-bold">{formatCurrency(totalGoal)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {totalGoal > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Team Progress</span>
            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatCurrency(totalRaised)} raised</span>
            <span>{formatCurrency(totalGoal)} goal</span>
          </div>
        </div>
      )}
    </div>
  );
}