import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format amount in cents to dollar string
 */
export function formatCurrency(amountInCents: number): string {
  const dollars = amountInCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", options || {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} ${diffInYears === 1 ? "year" : "years"} ago`;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(current: number, goal: number): number {
  if (goal === 0) return 0;
  return Math.min(Math.round((current / goal) * 100), 100);
}

/**
 * Generate a unique slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/--+/g, "-") // Replace multiple - with single -
    .trim();
}

/**
 * Generate a unique referral code
 */
export function generateReferralCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Mask sensitive data (e.g., last 4 of card/account)
 */
export function maskNumber(number: string, visibleDigits: number = 4): string {
  if (number.length <= visibleDigits) return number;
  const masked = "•".repeat(number.length - visibleDigits);
  return masked + number.slice(-visibleDigits);
}

/**
 * Calculate days remaining
 */
export function calculateDaysRemaining(endDate: Date | string): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  const now = new Date();
  const diffInMs = end.getTime() - now.getTime();
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffInDays);
}

/**
 * Get campaign status color
 */
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    ACTIVE: "bg-success-light text-success-dark",
    PAUSED: "bg-secondary-100 text-secondary-800",
    COMPLETED: "bg-primary-100 text-primary-800",
    ARCHIVED: "bg-gray-100 text-gray-600",
    PENDING: "bg-secondary-100 text-secondary-800",
    APPROVED: "bg-success-light text-success-dark",
    REJECTED: "bg-warning-light text-warning-dark",
  };

  return statusColors[status] || "bg-gray-100 text-gray-800";
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
