'use client';

import React from 'react';

interface EmptyRosterStateProps {
  hasMembers: boolean;
  searchTerm: string;
  statusFilter: string;
  canManage: boolean;
  onAddMember: () => void;
  onImportCSV: () => void;
}

export function EmptyRosterState({
  hasMembers,
  searchTerm,
  statusFilter,
  canManage,
  onAddMember,
  onImportCSV,
}: EmptyRosterStateProps) {
  // Different messages based on context
  if (hasMembers && (searchTerm || statusFilter !== 'all')) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
        <p className="text-gray-600">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-12 text-center">
      <svg
        className="mx-auto h-16 w-16 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No team members yet
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Get started by adding team members one by one or importing multiple members from a CSV file.
      </p>

      {canManage && (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onAddMember}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg
              className="inline-block w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Add Team Member
          </button>
          <button
            onClick={onImportCSV}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg
              className="inline-block w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import from CSV
          </button>
        </div>
      )}

      {!canManage && (
        <p className="text-sm text-gray-500 mt-4">
          Contact your campaign leader to add team members.
        </p>
      )}
    </div>
  );
}