import { z } from "zod";

/**
 * Campaign validation schemas following roadmap requirements
 * Week 1: Enhanced validation with comprehensive rules
 */

// Custom validation for slug format
const slugRegex = /^[a-z0-9-]+$/;
const hexColorRegex = /^#[0-9A-F]{6}$/i;

// Campaign creation schema with enhanced validation
export const createCampaignSchema = z.object({
  // Organization details (2-100 chars as per roadmap)
  organizationName: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name cannot exceed 100 characters")
    .trim(),

  // Team details (2-100 chars as per roadmap)
  teamName: z.string()
    .min(2, "Team name must be at least 2 characters")
    .max(100, "Team name cannot exceed 100 characters")
    .trim(),

  // Slug validation (3-50 chars, lowercase, alphanumeric + hyphen)
  slug: z.preprocess(
    (val) => typeof val === 'string' ? val.toLowerCase() : val,
    z.string()
      .min(3, "Campaign URL must be at least 3 characters")
      .max(50, "Campaign URL cannot exceed 50 characters")
      .regex(slugRegex, "Campaign URL must contain only lowercase letters, numbers, and hyphens")
  ),

  // Description (10-1000 chars as per roadmap)
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters")
    .trim(),

  // Goal amount (positive decimal, $1-$100,000 range)
  goalAmount: z.number()
    .positive("Goal amount must be greater than zero")
    .min(1, "Goal amount must be at least $1")
    .max(100000, "Goal amount cannot exceed $100,000")
    .multipleOf(0.01, "Goal amount must be a valid dollar amount"),

  // Date validation (start date must be in future, end date after start date)
  startDate: z.string()
    .datetime({ message: "Invalid start date format" })
    .refine((date) => {
      const startDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return startDate >= today;
    }, "Start date must be today or in the future"),

  endDate: z.string()
    .datetime({ message: "Invalid end date format" })
    .optional(),

  // Category validation
  category: z.enum(["SPORTS", "ARTS", "EDUCATION", "COMMUNITY", "OTHER"], {
    errorMap: () => ({ message: "Invalid category selected" })
  }),

  // Color validation (hex format required)
  primaryColor: z.string()
    .regex(hexColorRegex, "Primary color must be a valid hex color (e.g., #FF5733)")
    .default("#6366F1"),

  secondaryColor: z.string()
    .regex(hexColorRegex, "Secondary color must be a valid hex color (e.g., #FF5733)")
    .default("#F59E0B"),

  // Guardian details (optional)
  guardianEmail: z.string()
    .email("Invalid guardian email format")
    .optional()
    .or(z.literal("")),

  guardianName: z.string()
    .min(2, "Guardian name must be at least 2 characters")
    .max(100, "Guardian name cannot exceed 100 characters")
    .optional(),

  // Approval threshold (optional, positive)
  approvalThreshold: z.number()
    .positive("Approval threshold must be positive")
    .min(50, "Approval threshold must be at least $50")
    .max(10000, "Approval threshold cannot exceed $10,000")
    .optional()
    .default(500), // Default $500 as per original code
}).refine((data) => {
  // Validate that end date is after start date
  if (data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"]
}).refine((data) => {
  // Validate that campaign duration is reasonable (max 1 year)
  if (data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    return (end.getTime() - start.getTime()) <= oneYearInMs;
  }
  return true;
}, {
  message: "Campaign duration cannot exceed 1 year",
  path: ["endDate"]
});

// Update campaign schema (partial fields allowed)
export const updateCampaignSchema = z.object({
  organizationName: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name cannot exceed 100 characters")
    .trim()
    .optional(),

  teamName: z.string()
    .min(2, "Team name must be at least 2 characters")
    .max(100, "Team name cannot exceed 100 characters")
    .trim()
    .optional(),

  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters")
    .trim()
    .optional(),

  goalAmount: z.number()
    .positive("Goal amount must be greater than zero")
    .min(1, "Goal amount must be at least $1")
    .max(100000, "Goal amount cannot exceed $100,000")
    .multipleOf(0.01, "Goal amount must be a valid dollar amount")
    .optional(),

  endDate: z.string()
    .datetime({ message: "Invalid end date format" })
    .optional(),

  primaryColor: z.string()
    .regex(hexColorRegex, "Primary color must be a valid hex color")
    .optional(),

  secondaryColor: z.string()
    .regex(hexColorRegex, "Secondary color must be a valid hex color")
    .optional(),

  // Link this campaign to the Program it is a season of. Alumni and
  // year-over-year roster data hang off Program, so a campaign with no
  // programId can never contribute to either. Pass null to unlink.
  programId: z.string()
    .cuid("Invalid program id")
    .nullable()
    .optional(),

  // Which season this campaign covers. Used to order seasons within a program
  // and to identify alumni by graduation year.
  seasonYear: z.number()
    .int("Season year must be a whole number")
    .min(1900, "Season year must be 1900 or later")
    .max(2200, "Season year cannot exceed 2200")
    .nullable()
    .optional(),
});

// Schema for validating slug availability
export const checkSlugSchema = z.object({
  slug: z.preprocess(
    (val) => typeof val === 'string' ? val.toLowerCase() : val,
    z.string()
      .min(3, "Slug must be at least 3 characters")
      .max(50, "Slug cannot exceed 50 characters")
      .regex(slugRegex, "Slug must contain only lowercase letters, numbers, and hyphens")
  ),
});

// Schema for campaign status changes
export const updateCampaignStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"], {
    errorMap: () => ({ message: "Invalid campaign status" })
  })
});

// Export validation helper functions
export function validateCampaignDates(startDate: string, endDate?: string): boolean {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start date must be today or future
  if (start < today) {
    return false;
  }

  // If end date provided, must be after start date
  if (endDate) {
    const end = new Date(endDate);
    return end > start;
  }

  return true;
}

export function validateGoalAmount(amount: number): boolean {
  return amount >= 1 && amount <= 100000 && Number.isFinite(amount);
}

// Type exports for TypeScript
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CheckSlugInput = z.infer<typeof checkSlugSchema>;
export type UpdateCampaignStatusInput = z.infer<typeof updateCampaignStatusSchema>;