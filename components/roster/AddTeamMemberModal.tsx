'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  personalGoal: number | null;
  position?: string | null;
  grade?: string | null;
  profilePhotoUrl?: string | null;
  phoneNumber?: string | null;
}

interface AddTeamMemberModalProps {
  member?: TeamMember;
  onClose: () => void;
  onSave: (data: any) => void;
}

const memberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  personalGoal: z.number().min(1).max(50000).optional().nullable(),
  position: z.string().max(50, 'Position too long').optional().nullable(),
  grade: z.string().max(20, 'Grade too long').optional().nullable(),
  phoneNumber: z.string().regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number').optional().nullable(),
  profilePhotoUrl: z.string().url('Invalid URL').optional().nullable(),
});

export function AddTeamMemberModal({ member, onClose, onSave }: AddTeamMemberModalProps) {
  const isEditing = !!member;
  const [formData, setFormData] = useState({
    name: member?.name || '',
    email: member?.email || '',
    personalGoal: member?.personalGoal?.toString() || '',
    position: member?.position || '',
    grade: member?.grade || '',
    phoneNumber: member?.phoneNumber || '',
    profilePhotoUrl: member?.profilePhotoUrl || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      // Transform data for validation
      const dataToValidate = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        personalGoal: formData.personalGoal ? parseFloat(formData.personalGoal) : null,
        position: formData.position.trim() || null,
        grade: formData.grade.trim() || null,
        phoneNumber: formData.phoneNumber.trim() || null,
        profilePhotoUrl: formData.profilePhotoUrl.trim() || null,
      };

      // Validate
      const validatedData = memberSchema.parse(dataToValidate);

      // Submit (email is patched in place so amountRaised stays on this row)
      await onSave(validatedData);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        console.error('Failed to save team member:', error);
        toast.error('Failed to save team member');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[rgba(4,6,10,.72)] flex items-center justify-center z-[110] p-4">
      <div className="rounded-2xl border border-white/10 bg-[linear-gradient(165deg,var(--bb-night-4),#121826)] text-foreground shadow-sheet max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold font-display text-foreground">
              {isEditing ? 'Edit Team Member' : 'Add Team Member'}
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.name ? 'border-warning' : ''
                }`}
                placeholder="John Doe"
                required
              />
              {errors.name && <p className="text-warning text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.email ? 'border-warning' : ''
                }`}
                placeholder="john.doe@example.com"
                required
              />
              {errors.email && <p className="text-warning text-xs mt-1">{errors.email}</p>}
              {isEditing && (
                <p className="text-muted-foreground text-xs mt-1">
                  Changing email keeps this player&apos;s fundraising total on this record.
                </p>
              )}
            </div>

            {/* Personal Goal */}
            <div>
              <label htmlFor="personalGoal" className="block text-sm font-medium text-foreground mb-1">
                Personal Goal ($)
              </label>
              <input
                type="number"
                id="personalGoal"
                name="personalGoal"
                value={formData.personalGoal}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.personalGoal ? 'border-warning' : ''
                }`}
                placeholder="500"
                min="1"
                max="50000"
                step="1"
              />
              {errors.personalGoal && <p className="text-warning text-xs mt-1">{errors.personalGoal}</p>}
              <p className="text-muted-foreground text-xs mt-1">Optional. Between $1 and $50,000</p>
            </div>

            {/* Position */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-foreground mb-1">
                Position
              </label>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.position ? 'border-warning' : ''
                }`}
                placeholder="Forward, Goalkeeper, etc."
                maxLength={50}
              />
              {errors.position && <p className="text-warning text-xs mt-1">{errors.position}</p>}
            </div>

            {/* Grade */}
            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-foreground mb-1">
                Grade
              </label>
              <input
                type="text"
                id="grade"
                name="grade"
                value={formData.grade}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.grade ? 'border-warning' : ''
                }`}
                placeholder="12, Senior, College Freshman, etc."
                maxLength={20}
              />
              {errors.grade && <p className="text-warning text-xs mt-1">{errors.grade}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-foreground mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.phoneNumber ? 'border-warning' : ''
                }`}
                placeholder="+1234567890"
              />
              {errors.phoneNumber && <p className="text-warning text-xs mt-1">{errors.phoneNumber}</p>}
            </div>

            {/* Profile Photo URL */}
            <div>
              <label htmlFor="profilePhotoUrl" className="block text-sm font-medium text-foreground mb-1">
                Profile Photo URL
              </label>
              <input
                type="url"
                id="profilePhotoUrl"
                name="profilePhotoUrl"
                value={formData.profilePhotoUrl}
                onChange={handleInputChange}
                className={`w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus:border-secondary focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,124,90,.35)] ${
                  errors.profilePhotoUrl ? 'border-warning' : ''
                }`}
                placeholder="https://example.com/photo.jpg"
              />
              {errors.profilePhotoUrl && <p className="text-warning text-xs mt-1">{errors.profilePhotoUrl}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : isEditing ? 'Update' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}