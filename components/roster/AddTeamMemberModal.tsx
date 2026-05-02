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

      // For editing, remove email from data (not allowed to change)
      if (isEditing) {
        delete (validatedData as any).email;
      }

      // Submit
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
              {isEditing ? 'Edit Team Member' : 'Add Team Member'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="John Doe"
                required
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isEditing}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                } ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="john.doe@example.com"
                required
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              {isEditing && (
                <p className="text-gray-500 text-xs mt-1">Email cannot be changed after creation</p>
              )}
            </div>

            {/* Personal Goal */}
            <div>
              <label htmlFor="personalGoal" className="block text-sm font-medium text-gray-700 mb-1">
                Personal Goal ($)
              </label>
              <input
                type="number"
                id="personalGoal"
                name="personalGoal"
                value={formData.personalGoal}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.personalGoal ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="500"
                min="1"
                max="50000"
                step="1"
              />
              {errors.personalGoal && <p className="text-red-500 text-xs mt-1">{errors.personalGoal}</p>}
              <p className="text-gray-500 text-xs mt-1">Optional. Between $1 and $50,000</p>
            </div>

            {/* Position */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.position ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Forward, Goalkeeper, etc."
                maxLength={50}
              />
              {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position}</p>}
            </div>

            {/* Grade */}
            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">
                Grade
              </label>
              <input
                type="text"
                id="grade"
                name="grade"
                value={formData.grade}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.grade ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="12, Senior, College Freshman, etc."
                maxLength={20}
              />
              {errors.grade && <p className="text-red-500 text-xs mt-1">{errors.grade}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="+1234567890"
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>}
            </div>

            {/* Profile Photo URL */}
            <div>
              <label htmlFor="profilePhotoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Profile Photo URL
              </label>
              <input
                type="url"
                id="profilePhotoUrl"
                name="profilePhotoUrl"
                value={formData.profilePhotoUrl}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.profilePhotoUrl ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="https://example.com/photo.jpg"
              />
              {errors.profilePhotoUrl && <p className="text-red-500 text-xs mt-1">{errors.profilePhotoUrl}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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