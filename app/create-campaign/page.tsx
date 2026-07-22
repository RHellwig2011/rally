"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCsrfToken } from "@/hooks/useCsrfToken";

// Campaign form data type
interface CampaignFormData {
  // Step 1: Organization Details
  organizationName: string;
  teamName: string;
  category: string;
  slug: string;
  goalAmount: string;
  startDate: string;
  endDate: string;

  // Step 2: Customization
  description: string;
  primaryColor: string;
  secondaryColor: string;

  // Step 3: Banking (simplified for MVP)
  guardianEmail: string;
  guardianName: string;
  approvalThreshold: string;
}

const STEPS = [
  { number: 1, title: "Organization Details" },
  { number: 2, title: "Customize Campaign" },
  { number: 3, title: "Banking Setup" },
  { number: 4, title: "Review & Launch" },
];

const CATEGORIES = [
  "SPORTS",
  "ARTS",
  "EDUCATION",
  "COMMUNITY",
  "OTHER",
];

export default function CreateCampaignPage() {
  const router = useRouter();
  const { csrfToken } = useCsrfToken();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CampaignFormData>({
    organizationName: "",
    teamName: "",
    category: "EDUCATION",
    slug: "",
    goalAmount: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    description: "",
    primaryColor: "#6366F1",
    secondaryColor: "#F59E0B",
    guardianEmail: "",
    guardianName: "",
    approvalThreshold: "500",
  });

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login?redirect=/create-campaign");
          return;
        }
        setIsCheckingAuth(false);
      } catch (err) {
        router.push("/login?redirect=/create-campaign");
      }
    };
    checkAuth();
  }, [router]);

  const updateFormData = (field: keyof CampaignFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
    setError(null);

    // Auto-generate slug from team name
    if (field === "teamName" && !formData.slug) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.organizationName.trim()) errors.organizationName = "Organization name is required";
      if (!formData.teamName.trim()) errors.teamName = "Team name is required";
      if (!formData.slug.trim()) errors.slug = "Campaign URL is required";
      if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
        errors.slug = "URL must contain only lowercase letters, numbers, and hyphens";
      }
      if (!formData.goalAmount || parseFloat(formData.goalAmount) <= 0) {
        errors.goalAmount = "Goal amount must be greater than 0";
      } else if (parseFloat(formData.goalAmount) > 100000) {
        errors.goalAmount = "Goal amount cannot exceed $100,000";
      }
      if (!formData.startDate) errors.startDate = "Start date is required";
      if (formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
        errors.endDate = "End date must be after start date";
      }
    } else if (step === 2) {
      if (!formData.description.trim() || formData.description.length < 10) {
        errors.description = "Description must be at least 10 characters";
      }
    } else if (step === 3) {
      if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
        errors.guardianEmail = "Invalid email format";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert date strings to ISO datetime format
      const startDateTime = new Date(formData.startDate + 'T00:00:00').toISOString();
      const endDateTime = formData.endDate ? new Date(formData.endDate + 'T23:59:59').toISOString() : undefined;

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          organizationName: formData.organizationName,
          teamName: formData.teamName,
          slug: formData.slug,
          description: formData.description,
          goalAmount: parseFloat(formData.goalAmount),
          startDate: startDateTime,
          endDate: endDateTime,
          category: formData.category,
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          guardianEmail: formData.guardianEmail || undefined,
          guardianName: formData.guardianName || undefined,
          approvalThreshold: formData.approvalThreshold ? parseFloat(formData.approvalThreshold) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          // Handle validation errors from server
          const serverErrors: Record<string, string> = {};
          data.details.forEach((err: any) => {
            serverErrors[err.field] = err.message;
          });
          setValidationErrors(serverErrors);
          setError("Please fix the errors above");
        } else {
          setError(data.error || "Failed to create campaign");
        }
        return;
      }

      // Success! Redirect to campaign dashboard
      router.push(`/dashboard/${data.campaign.id}`);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Campaign creation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      currentStep > step.number
                        ? "bg-success text-white"
                        : currentStep === step.number
                        ? "bg-primary text-white ring-4 ring-primary-100"
                        : "bg-accent text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center absolute top-12 whitespace-nowrap ${
                      currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition-all ${
                      currentStep > step.number ? "bg-success" : "bg-accent"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card className="mt-16">
          <CardHeader>
            <CardTitle className="text-2xl">
              {STEPS[currentStep - 1].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-warning-light border border-warning rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-warning mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning-dark">{error}</p>
                </div>
              </div>
            )}
            {/* Step 1: Organization Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="organizationName">Organization Name *</Label>
                  <Input
                    id="organizationName"
                    type="text"
                    autoComplete="organization"
                    placeholder="Lincoln High School"
                    value={formData.organizationName}
                    onChange={(e) => updateFormData("organizationName", e.target.value)}
                    className={`mt-2 h-12 ${validationErrors.organizationName ? "border-warning" : ""}`}
                  />
                  {validationErrors.organizationName && (
                    <p className="mt-1 text-sm text-warning">{validationErrors.organizationName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="teamName">Team/Group Name *</Label>
                  <Input
                    id="teamName"
                    type="text"
                    placeholder="Robotics Team"
                    value={formData.teamName}
                    onChange={(e) => updateFormData("teamName", e.target.value)}
                    className={`mt-2 h-12 ${validationErrors.teamName ? "border-warning" : ""}`}
                  />
                  {validationErrors.teamName && (
                    <p className="mt-1 text-sm text-warning">{validationErrors.teamName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => updateFormData("category", e.target.value)}
                    className="mt-2 flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="slug">Campaign URL</Label>
                  <div className="mt-2 flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">rally.com/raise/</span>
                    <Input
                      id="slug"
                      type="text"
                      placeholder="lincoln-high-robotics"
                      value={formData.slug}
                      onChange={(e) => updateFormData("slug", e.target.value)}
                      className={`flex-1 h-12 ${validationErrors.slug ? "border-warning" : ""}`}
                    />
                  </div>
                  {validationErrors.slug ? (
                    <p className="text-xs text-warning mt-1">{validationErrors.slug}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be your campaign's unique URL
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="goalAmount">Fundraising Goal *</Label>
                  <div className="mt-2 flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">$</span>
                    <Input
                      id="goalAmount"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="100000"
                      step="1"
                      placeholder="12000"
                      value={formData.goalAmount}
                      onChange={(e) => updateFormData("goalAmount", e.target.value)}
                      className={`flex-1 h-12 ${validationErrors.goalAmount ? "border-warning" : ""}`}
                    />
                  </div>
                  {validationErrors.goalAmount ? (
                    <p className="mt-1 text-sm text-warning">{validationErrors.goalAmount}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Maximum: $100,000</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormData("startDate", e.target.value)}
                      className="mt-2 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormData("endDate", e.target.value)}
                      className="mt-2 h-12"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Customization */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="description">Campaign Story *</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell donors about your team and what you're raising funds for..."
                    value={formData.description}
                    onChange={(e) => updateFormData("description", e.target.value)}
                    className={`mt-2 min-h-[200px] ${validationErrors.description ? "border-warning" : ""}`}
                  />
                  {validationErrors.description ? (
                    <p className="text-xs text-warning mt-1">{validationErrors.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.description.length} characters
                    </p>
                  )}
                </div>

                <div>
                  <Label>Brand Colors</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label htmlFor="primaryColor" className="text-xs text-muted-foreground">
                        Primary Color
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => updateFormData("primaryColor", e.target.value)}
                          className="w-16 h-10"
                        />
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => updateFormData("primaryColor", e.target.value)}
                          placeholder="#6366F1"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor" className="text-xs text-muted-foreground">
                        Secondary Color
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={formData.secondaryColor}
                          onChange={(e) => updateFormData("secondaryColor", e.target.value)}
                          className="w-16 h-10"
                        />
                        <Input
                          value={formData.secondaryColor}
                          onChange={(e) => updateFormData("secondaryColor", e.target.value)}
                          placeholder="#F59E0B"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Preview: Your brand colors
                  </p>
                  <div className="flex gap-2">
                    <div
                      className="w-20 h-20 rounded-lg"
                      style={{ backgroundColor: formData.primaryColor }}
                    />
                    <div
                      className="w-20 h-20 rounded-lg"
                      style={{ backgroundColor: formData.secondaryColor }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Banking Setup */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> For MVP demo purposes, we're using a simplified banking setup.
                    In production, you'll connect a real bank account via Stripe Connect.
                  </p>
                </div>

                <div>
                  <Label htmlFor="guardianEmail">Financial Overseer Email (Optional)</Label>
                  <Input
                    id="guardianEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="treasurer@email.com"
                    value={formData.guardianEmail}
                    onChange={(e) => updateFormData("guardianEmail", e.target.value)}
                    className={`mt-2 h-12 ${validationErrors.guardianEmail ? "border-warning" : ""}`}
                  />
                  {validationErrors.guardianEmail ? (
                    <p className="text-xs text-warning mt-1">{validationErrors.guardianEmail}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Add someone who can approve disbursement requests above the threshold
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="guardianName">Financial Overseer Name (Optional)</Label>
                  <Input
                    id="guardianName"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    value={formData.guardianName}
                    onChange={(e) => updateFormData("guardianName", e.target.value)}
                    className="mt-2 h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="approvalThreshold">Approval Threshold</Label>
                  <div className="mt-2 flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">$</span>
                    <Input
                      id="approvalThreshold"
                      type="number"
                      value={formData.approvalThreshold}
                      onChange={(e) => updateFormData("approvalThreshold", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disbursements over this amount require guardian approval
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review & Launch */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
                  <h3 className="text-xl font-bold text-primary-900 mb-2">
                    Review Your Campaign
                  </h3>
                  <p className="text-primary-700">
                    Please review all details before launching your campaign.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h4 className="font-semibold text-foreground mb-2">Organization Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Organization:</span>
                        <p className="font-medium">{formData.organizationName || "Not set"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Team:</span>
                        <p className="font-medium">{formData.teamName || "Not set"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Category:</span>
                        <p className="font-medium">{formData.category}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Goal:</span>
                        <p className="font-medium">${formData.goalAmount || "0"}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Campaign URL:</span>
                        <p className="font-medium text-primary">rally.com/raise/{formData.slug || "not-set"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-b pb-4">
                    <h4 className="font-semibold text-foreground mb-2">Campaign Story</h4>
                    <p className="text-sm text-foreground">
                      {formData.description || "No description provided"}
                    </p>
                  </div>

                  <div className="border-b pb-4">
                    <h4 className="font-semibold text-foreground mb-2">Financial Oversight</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Financial Overseer:</span>
                        <p className="font-medium">
                          {formData.guardianName || "Not set"}
                          {formData.guardianEmail && ` (${formData.guardianEmail})`}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Approval Threshold:</span>
                        <p className="font-medium">${formData.approvalThreshold}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-900">
                    <strong>Ready to launch?</strong> Once you create your campaign, you can start
                    sharing it with potential donors immediately!
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1 || isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button onClick={nextStep} disabled={isLoading}>
                  Next: {STEPS[currentStep].title}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="bg-success hover:bg-success/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Create Campaign
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
