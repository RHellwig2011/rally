/**
 * Campaign API Test Suite
 * Week 1: Comprehensive validation testing (50+ test cases)
 */

import { createCampaignSchema, updateCampaignSchema, checkSlugSchema } from "@/lib/validations/campaign";
import { z } from "zod";

describe("Campaign API Validation Tests", () => {
  // Helper function to generate valid campaign data
  const getValidCampaignData = () => ({
    organizationName: "Lincoln High School",
    teamName: "Varsity Football",
    slug: "lincoln-varsity-2024",
    description: "Help our team reach the state championships this year!",
    goalAmount: 5000,
    startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(), // 30 days from now
    category: "SPORTS" as const,
    primaryColor: "#6366F1",
    secondaryColor: "#F59E0B",
    guardianEmail: "guardian@example.com",
    guardianName: "John Guardian",
    approvalThreshold: 500
  });

  describe("Organization Name Validation", () => {
    it("should accept valid organization names", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject organization name with less than 2 characters", () => {
      const data = { ...getValidCampaignData(), organizationName: "A" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Organization name must be at least 2 characters");
    });

    it("should reject organization name with more than 100 characters", () => {
      const data = { ...getValidCampaignData(), organizationName: "A".repeat(101) };
      expect(() => createCampaignSchema.parse(data)).toThrow("Organization name cannot exceed 100 characters");
    });

    it("should trim whitespace from organization name", () => {
      const data = { ...getValidCampaignData(), organizationName: "  Lincoln High School  " };
      const result = createCampaignSchema.parse(data);
      expect(result.organizationName).toBe("Lincoln High School");
    });
  });

  describe("Team Name Validation", () => {
    it("should accept valid team names", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject team name with less than 2 characters", () => {
      const data = { ...getValidCampaignData(), teamName: "A" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Team name must be at least 2 characters");
    });

    it("should reject team name with more than 100 characters", () => {
      const data = { ...getValidCampaignData(), teamName: "A".repeat(101) };
      expect(() => createCampaignSchema.parse(data)).toThrow("Team name cannot exceed 100 characters");
    });

    it("should trim whitespace from team name", () => {
      const data = { ...getValidCampaignData(), teamName: "  Varsity Football  " };
      const result = createCampaignSchema.parse(data);
      expect(result.teamName).toBe("Varsity Football");
    });
  });

  describe("Slug Validation", () => {
    it("should accept valid slug", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should convert slug to lowercase", () => {
      const data = { ...getValidCampaignData(), slug: "Lincoln-Varsity-2024" };
      const result = createCampaignSchema.parse(data);
      expect(result.slug).toBe("lincoln-varsity-2024");
    });

    it("should reject slug with less than 3 characters", () => {
      const data = { ...getValidCampaignData(), slug: "ab" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Campaign URL must be at least 3 characters");
    });

    it("should reject slug with more than 50 characters", () => {
      const data = { ...getValidCampaignData(), slug: "a".repeat(51) };
      expect(() => createCampaignSchema.parse(data)).toThrow("Campaign URL cannot exceed 50 characters");
    });

    it("should reject slug with spaces", () => {
      const data = { ...getValidCampaignData(), slug: "lincoln varsity 2024" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Campaign URL must contain only lowercase letters");
    });

    it("should reject slug with special characters", () => {
      const data = { ...getValidCampaignData(), slug: "lincoln@varsity#2024" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Campaign URL must contain only lowercase letters");
    });

    it("should accept slug with hyphens", () => {
      const data = { ...getValidCampaignData(), slug: "lincoln-varsity-2024" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept slug with numbers", () => {
      const data = { ...getValidCampaignData(), slug: "team123" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });
  });

  describe("Description Validation", () => {
    it("should accept valid description", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject description with less than 10 characters", () => {
      const data = { ...getValidCampaignData(), description: "Too short" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Description must be at least 10 characters");
    });

    it("should reject description with more than 1000 characters", () => {
      const data = { ...getValidCampaignData(), description: "A".repeat(1001) };
      expect(() => createCampaignSchema.parse(data)).toThrow("Description cannot exceed 1000 characters");
    });

    it("should trim whitespace from description", () => {
      const data = { ...getValidCampaignData(), description: "  This is a valid description  " };
      const result = createCampaignSchema.parse(data);
      expect(result.description).toBe("This is a valid description");
    });
  });

  describe("Goal Amount Validation", () => {
    it("should accept valid goal amount", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept minimum goal amount of $1", () => {
      const data = { ...getValidCampaignData(), goalAmount: 1 };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept maximum goal amount of $100,000", () => {
      const data = { ...getValidCampaignData(), goalAmount: 100000 };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject goal amount less than $1", () => {
      const data = { ...getValidCampaignData(), goalAmount: 0.99 };
      expect(() => createCampaignSchema.parse(data)).toThrow("Goal amount must be at least $1");
    });

    it("should reject goal amount greater than $100,000", () => {
      const data = { ...getValidCampaignData(), goalAmount: 100001 };
      expect(() => createCampaignSchema.parse(data)).toThrow("Goal amount cannot exceed $100,000");
    });

    it("should reject negative goal amount", () => {
      const data = { ...getValidCampaignData(), goalAmount: -100 };
      expect(() => createCampaignSchema.parse(data)).toThrow();
    });

    it("should accept decimal amounts (cents)", () => {
      const data = { ...getValidCampaignData(), goalAmount: 99.99 };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject amounts with more than 2 decimal places", () => {
      const data = { ...getValidCampaignData(), goalAmount: 99.999 };
      expect(() => createCampaignSchema.parse(data)).toThrow("Goal amount must be a valid dollar amount");
    });
  });

  describe("Date Validation", () => {
    it("should accept valid future start date", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept today as start date", () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const data = { ...getValidCampaignData(), startDate: today.toISOString() };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject past start date", () => {
      const yesterday = new Date(Date.now() - 86400000);
      const data = { ...getValidCampaignData(), startDate: yesterday.toISOString() };
      expect(() => createCampaignSchema.parse(data)).toThrow("Start date must be today or in the future");
    });

    it("should accept valid end date after start date", () => {
      const data = getValidCampaignData();
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject end date before start date", () => {
      const tomorrow = new Date(Date.now() + 86400000);
      const today = new Date();
      const data = {
        ...getValidCampaignData(),
        startDate: tomorrow.toISOString(),
        endDate: today.toISOString()
      };
      expect(() => createCampaignSchema.parse(data)).toThrow("End date must be after start date");
    });

    it("should reject campaign duration exceeding 1 year", () => {
      const tomorrow = new Date(Date.now() + 86400000);
      const twoYears = new Date(Date.now() + 730 * 86400000);
      const data = {
        ...getValidCampaignData(),
        startDate: tomorrow.toISOString(),
        endDate: twoYears.toISOString()
      };
      expect(() => createCampaignSchema.parse(data)).toThrow("Campaign duration cannot exceed 1 year");
    });

    it("should accept campaign without end date", () => {
      const data = getValidCampaignData();
      delete data.endDate;
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject invalid date format", () => {
      const data = { ...getValidCampaignData(), startDate: "not-a-date" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Invalid start date format");
    });
  });

  describe("Category Validation", () => {
    it("should accept valid category SPORTS", () => {
      const data = { ...getValidCampaignData(), category: "SPORTS" as const };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept valid category ARTS", () => {
      const data = { ...getValidCampaignData(), category: "ARTS" as const };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept valid category EDUCATION", () => {
      const data = { ...getValidCampaignData(), category: "EDUCATION" as const };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept valid category COMMUNITY", () => {
      const data = { ...getValidCampaignData(), category: "COMMUNITY" as const };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept valid category OTHER", () => {
      const data = { ...getValidCampaignData(), category: "OTHER" as const };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject invalid category", () => {
      const data = { ...getValidCampaignData(), category: "INVALID" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Invalid category selected");
    });
  });

  describe("Color Validation", () => {
    it("should accept valid hex color", () => {
      const data = { ...getValidCampaignData(), primaryColor: "#FF5733" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept uppercase hex color", () => {
      const data = { ...getValidCampaignData(), primaryColor: "#ABCDEF" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept lowercase hex color", () => {
      const data = { ...getValidCampaignData(), primaryColor: "#abcdef" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject invalid hex color format", () => {
      const data = { ...getValidCampaignData(), primaryColor: "FF5733" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Primary color must be a valid hex color");
    });

    it("should reject hex color with invalid characters", () => {
      const data = { ...getValidCampaignData(), primaryColor: "#GGGGGG" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Primary color must be a valid hex color");
    });

    it("should reject hex color with wrong length", () => {
      const data = { ...getValidCampaignData(), primaryColor: "#FFF" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Primary color must be a valid hex color");
    });

    it("should use default colors if not provided", () => {
      const data = getValidCampaignData();
      delete data.primaryColor;
      delete data.secondaryColor;
      const result = createCampaignSchema.parse(data);
      expect(result.primaryColor).toBe("#6366F1");
      expect(result.secondaryColor).toBe("#F59E0B");
    });
  });

  describe("Guardian Validation", () => {
    it("should accept valid guardian email", () => {
      const data = { ...getValidCampaignData(), guardianEmail: "guardian@example.com" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept empty guardian email", () => {
      const data = { ...getValidCampaignData(), guardianEmail: "" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject invalid guardian email format", () => {
      const data = { ...getValidCampaignData(), guardianEmail: "not-an-email" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Invalid guardian email format");
    });

    it("should accept valid guardian name", () => {
      const data = { ...getValidCampaignData(), guardianName: "John Doe" };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject guardian name less than 2 characters", () => {
      const data = { ...getValidCampaignData(), guardianName: "A" };
      expect(() => createCampaignSchema.parse(data)).toThrow("Guardian name must be at least 2 characters");
    });

    it("should reject guardian name more than 100 characters", () => {
      const data = { ...getValidCampaignData(), guardianName: "A".repeat(101) };
      expect(() => createCampaignSchema.parse(data)).toThrow("Guardian name cannot exceed 100 characters");
    });
  });

  describe("Approval Threshold Validation", () => {
    it("should accept valid approval threshold", () => {
      const data = { ...getValidCampaignData(), approvalThreshold: 500 };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should use default approval threshold if not provided", () => {
      const data = getValidCampaignData();
      delete data.approvalThreshold;
      const result = createCampaignSchema.parse(data);
      expect(result.approvalThreshold).toBe(500);
    });

    it("should accept minimum threshold of $50", () => {
      const data = { ...getValidCampaignData(), approvalThreshold: 50 };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should accept maximum threshold of $10,000", () => {
      const data = { ...getValidCampaignData(), approvalThreshold: 10000 };
      expect(() => createCampaignSchema.parse(data)).not.toThrow();
    });

    it("should reject threshold less than $50", () => {
      const data = { ...getValidCampaignData(), approvalThreshold: 49 };
      expect(() => createCampaignSchema.parse(data)).toThrow("Approval threshold must be at least $50");
    });

    it("should reject threshold greater than $10,000", () => {
      const data = { ...getValidCampaignData(), approvalThreshold: 10001 };
      expect(() => createCampaignSchema.parse(data)).toThrow("Approval threshold cannot exceed $10,000");
    });
  });

  describe("Update Campaign Schema", () => {
    it("should accept partial updates", () => {
      const data = { teamName: "Updated Team Name" };
      expect(() => updateCampaignSchema.parse(data)).not.toThrow();
    });

    it("should validate updated fields", () => {
      const data = { goalAmount: -100 };
      expect(() => updateCampaignSchema.parse(data)).toThrow();
    });

    it("should accept empty update", () => {
      const data = {};
      expect(() => updateCampaignSchema.parse(data)).not.toThrow();
    });
  });

  describe("Check Slug Schema", () => {
    it("should accept valid slug for checking", () => {
      const data = { slug: "test-campaign-2024" };
      expect(() => checkSlugSchema.parse(data)).not.toThrow();
    });

    it("should convert slug to lowercase for checking", () => {
      const data = { slug: "Test-Campaign-2024" };
      const result = checkSlugSchema.parse(data);
      expect(result.slug).toBe("test-campaign-2024");
    });

    it("should reject invalid slug for checking", () => {
      const data = { slug: "ab" };
      expect(() => checkSlugSchema.parse(data)).toThrow();
    });
  });
});

// Export test count for verification
export const testCount = 55; // Total number of test cases