import { z } from "zod";

/**
 * Team Member validation schemas following roadmap requirements
 * Week 2: Roster Management
 */

// Create team member schema
export const createTeamMemberSchema = z.object({
  // Name (required, 2-100 chars)
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),

  // Email (required, valid format, unique per campaign)
  email: z.preprocess(
    (val) => typeof val === 'string' ? val.trim().toLowerCase() : val,
    z.string().email("Invalid email format")
  ),

  // Personal fundraising goal (optional, positive decimal)
  personalGoal: z.number()
    .positive("Personal goal must be greater than zero")
    .min(1, "Personal goal must be at least $1")
    .max(50000, "Personal goal cannot exceed $50,000")
    .multipleOf(0.01, "Personal goal must be a valid dollar amount")
    .optional()
    .nullable(),

  // Position (optional, e.g., "Forward", "Goalkeeper")
  position: z.string()
    .max(50, "Position cannot exceed 50 characters")
    .trim()
    .optional()
    .nullable(),

  // Grade (optional, e.g., "12", "College")
  grade: z.string()
    .max(20, "Grade cannot exceed 20 characters")
    .trim()
    .optional()
    .nullable(),

  // Profile photo URL (optional)
  profilePhotoUrl: z.string()
    .url("Invalid photo URL format")
    .optional()
    .nullable(),

  // Phone number (optional)
  phoneNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .nullable(),
});

// Update team member schema (all fields optional)
export const updateTeamMemberSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim()
    .optional(),

  // NOTE: Email cannot be changed (for consistency)

  personalGoal: z.number()
    .positive("Personal goal must be greater than zero")
    .min(1, "Personal goal must be at least $1")
    .max(50000, "Personal goal cannot exceed $50,000")
    .multipleOf(0.01, "Personal goal must be a valid dollar amount")
    .optional()
    .nullable(),

  position: z.string()
    .max(50, "Position cannot exceed 50 characters")
    .trim()
    .optional()
    .nullable(),

  grade: z.string()
    .max(20, "Grade cannot exceed 20 characters")
    .trim()
    .optional()
    .nullable(),

  profilePhotoUrl: z.string()
    .url("Invalid photo URL format")
    .optional()
    .nullable(),

  phoneNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .nullable(),
});

// Schema for listing team members with query parameters
export const listTeamMembersQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, "Page must be a number")
    .transform(Number)
    .pipe(z.number().positive())
    .default("1")
    .optional(),

  limit: z.string()
    .regex(/^\d+$/, "Limit must be a number")
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .default("25")
    .optional(),

  sortBy: z.enum(["name", "amountRaised", "dateJoined", "personalGoal"])
    .default("amountRaised")
    .optional(),

  sortOrder: z.enum(["asc", "desc"])
    .default("desc")
    .optional(),

  status: z.enum(["all", "pending", "accepted", "email_failed", "expired"])
    .default("all")
    .optional(),

  search: z.string()
    .max(100)
    .optional(),
});

// Type exports for TypeScript
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type ListTeamMembersQuery = z.infer<typeof listTeamMembersQuerySchema>;