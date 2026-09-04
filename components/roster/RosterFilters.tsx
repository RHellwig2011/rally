'use client';

import React from 'react';

interface RosterFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  sortBy: 'amountRaised' | 'name' | 'date';
  onSortChange: (value: 'amountRaised' | 'name' | 'date') => void;
}

export function RosterFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
}: RosterFiltersProps) {
  return (
    <div className="rounded-card border border-white/10 bg-card shadow-card p-4 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, email, position, or grade..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-white/10 bg-white/[0.05] text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)]"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground"
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
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.05] text-sm text-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)]"
          >
            <option value="all">All Status</option>
            <option value="ACCEPTED">Active</option>
            <option value="PENDING">Pending</option>
            <option value="DECLINED">Declined</option>
            <option value="EMAIL_FAILED">Email Failed</option>
            <option value="REMOVED">Removed</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label htmlFor="sortBy" className="sr-only">
            Sort by
          </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.05] text-sm text-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)]"
          >
            <option value="amountRaised">Amount Raised</option>
            <option value="name">Name</option>
            <option value="date">Date Added</option>
          </select>
        </div>
      </div>
    </div>
  );
}