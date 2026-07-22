"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSlugValidation } from "@/hooks/useSlugValidation";
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

interface FieldTouched {
  [key: string]: boolean;
}

const STEPS = [
  { number: 1, title: "Organization Details", description: "Basic information about your team" },
  { number: 2, title: "Customize Campaign", description: "Make it unique to your team" },
  { number: 3, title: "Banking Setup", description: "Configure payment settings" },
  { number: 4, title: "Review & Launch", description: "Final review before going live" },
];

const CATEGORIES = [
  { value: "SPORTS", label: "Sports", icon: "⚽" },
  { value: "ARTS", label: "Arts", icon: "🎨" },
  { value: "EDUCATION", label: "Education", icon: "📚" },
  { value: "COMMUNITY", label: "Community", icon: "🤝" },
  { value: "OTHER", label: "Other", icon: "✨" },
];

export default function EnhancedCreateCampaignPage() {
  const router = useRouter();
  const { csrfToken } = useCsrfToken();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [fieldTouched, setFieldTouched] = useState<FieldTouched>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>({
    organizationName: "",
    teamName: "",
    category: "SPORTS",
    slug: "",
    goalAmount: "",
    startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    endDate: "",
    description: "",
    primaryColor: "#6366F1",
    secondaryColor: "#F59E0B",
    guardianEmail: "",
    guardianName: "",
    approvalThreshold: "500",
  });

  // Use real-time slug validation hook
  const slugValidation = useSlugValidation(formData.slug);

  // Auto-save form data to localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('campaignDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed);
      } catch (e) {
        console.error('Failed to load saved draft');
      }
    }
  }, []);

  // Save draft periodically
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      localStorage.setItem('campaignDraft', JSON.stringify(formData));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    }, 1000);

    setSaveStatus('saving');
    return () => clearTimeout(saveTimer);
  }, [formData]);

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

  const updateFormData = useCallback((field: keyof CampaignFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Mark field as touched for validation
    setFieldTouched(prev => ({ ...prev, [field]: true }));

    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
    setError(null);

    // Auto-generate slug from team name
    if (field === "teamName") {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 50);

      // Only auto-generate if user hasn't manually edited the slug
      if (!fieldTouched.slug) {
        setFormData(prev => ({ ...prev, slug: autoSlug }));
      }
    }
  }, [fieldTouched.slug]);

  const validateField = (field: keyof CampaignFormData, value: string): string | null => {
    switch (field) {
      case 'organizationName':
        if (!value.trim()) return "Organization name is required";
        if (value.length < 2) return "Must be at least 2 characters";
        if (value.length > 100) return "Cannot exceed 100 characters";
        break;

      case 'teamName':
        if (!value.trim()) return "Team name is required";
        if (value.length < 2) return "Must be at least 2 characters";
        if (value.length > 100) return "Cannot exceed 100 characters";
        break;

      case 'slug':
        if (!value.trim()) return "Campaign URL is required";
        if (value.length < 3) return "Must be at least 3 characters";
        if (value.length > 50) return "Cannot exceed 50 characters";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Must contain only lowercase letters, numbers, and hyphens";
        }
        break;

      case 'goalAmount':
        const amount = parseFloat(value);
        if (!value || isNaN(amount)) return "Goal amount is required";
        if (amount < 1) return "Must be at least $1";
        if (amount > 100000) return "Cannot exceed $100,000";
        if (!/^\d+(\.\d{0,2})?$/.test(value)) return "Invalid format (max 2 decimal places)";
        break;

      case 'description':
        if (!value.trim()) return "Campaign story is required";
        if (value.length < 10) return "Must be at least 10 characters";
        if (value.length > 1000) return "Cannot exceed 1,000 characters";
        break;

      case 'guardianEmail':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return "Invalid email format";
        }
        break;

      case 'startDate':
        if (!value) return "Start date is required";
        const start = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (start < today) return "Start date must be today or later";
        break;

      case 'endDate':
        if (value) {
          const end = new Date(value);
          const start = new Date(formData.startDate);
          if (end <= start) return "End date must be after start date";
          const oneYear = 365 * 24 * 60 * 60 * 1000;
          if (end.getTime() - start.getTime() > oneYear) {
            return "Campaign cannot exceed 1 year";
          }
        }
        break;
    }
    return null;
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    const fieldsToValidate: (keyof CampaignFormData)[] = [];

    if (step === 1) {
      fieldsToValidate.push('organizationName', 'teamName', 'slug', 'goalAmount', 'startDate');
      if (formData.endDate) fieldsToValidate.push('endDate');
    } else if (step === 2) {
      fieldsToValidate.push('description');
    } else if (step === 3) {
      if (formData.guardianEmail) fieldsToValidate.push('guardianEmail');
    }

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        errors[field] = error;
      }
    });

    // Check slug availability
    if (step === 1 && formData.slug && !errors.slug) {
      if (slugValidation.error && !slugValidation.isChecking) {
        errors.slug = slugValidation.error;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('campaignDraft');
    window.location.reload();
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          organizationName: formData.organizationName.trim(),
          teamName: formData.teamName.trim(),
          slug: formData.slug.toLowerCase().trim(),
          description: formData.description.trim(),
          goalAmount: parseFloat(formData.goalAmount),
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
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
        if (response.status === 429) {
          setError("You've created too many campaigns. Please try again later.");
          return;
        }

        if (data.details) {
          // Handle validation errors from server
          const serverErrors: Record<string, string> = {};
          data.details.forEach((err: any) => {
            serverErrors[err.field] = err.message;
          });
          setValidationErrors(serverErrors);

          // Find which step has errors and navigate there
          if (serverErrors.organizationName || serverErrors.teamName || serverErrors.slug || serverErrors.goalAmount) {
            setCurrentStep(1);
          } else if (serverErrors.description) {
            setCurrentStep(2);
          }

          setError("Please fix the errors and try again");
        } else {
          setError(data.error || "Failed to create campaign");
        }
        return;
      }

      // Success! Clear draft and redirect
      localStorage.removeItem('campaignDraft');
      router.push(`/dashboard/${data.campaign.id}?welcome=true`);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
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

  // Calculate form completion percentage
  const calculateProgress = () => {
    const requiredFields = [
      'organizationName', 'teamName', 'slug', 'goalAmount',
      'startDate', 'description'
    ];
    const filledFields = requiredFields.filter(field =>
      formData[field as keyof CampaignFormData]?.toString().trim()
    );
    return Math.round((filledFields.length / requiredFields.length) * 100);
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Rally</span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Save Status Indicator */}
              {saveStatus && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving draft...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 text-success" />
                      Draft saved
                    </>
                  )}
                </span>
              )}

              {/* Clear Draft Button */}
              {calculateProgress() > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDraft}
                  className="text-sm"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Start Over
                </Button>
              )}

              <Button variant="ghost" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-foreground">Create Your Campaign</h1>
            <span className="text-sm text-muted-foreground">{calculateProgress()}% Complete</span>
          </div>
          <div className="w-full bg-accent rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>

        {/* Progress Steps - Mobile Optimized */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] md:min-w-0">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      currentStep > step.number
                        ? "bg-success text-white"
                        : currentStep === step.number
                        ? "bg-primary text-white ring-4 ring-primary/20"
                        : "bg-accent text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="mt-2 text-center absolute top-12 w-20">
                    <span
                      className={`text-xs font-medium block ${
                        currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </span>
                    {currentStep === step.number && (
                      <span className="text-xs text-muted-foreground mt-1 hidden md:block">
                        {step.description}
                      </span>
                    )}
                  </div>
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
        <Card className="mt-20 md:mt-16">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">
              Step {currentStep}: {STEPS[currentStep - 1].title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {STEPS[currentStep - 1].description}
            </p>
          </CardHeader>
          <CardContent>
            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-warning-light border border-warning rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-warning mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warning-dark">{error}</p>
                  {Object.keys(validationErrors).length > 0 && (
                    <ul className="mt-2 text-sm text-warning-dark list-disc list-inside">
                      {Object.entries(validationErrors).map(([field, message]) => (
                        <li key={field}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Organization Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Organization Name */}
                <div>
                  <Label htmlFor="organizationName">
                    Organization Name *
                    {fieldTouched.organizationName && !validationErrors.organizationName && formData.organizationName && (
                      <CheckCircle className="w-4 h-4 text-success inline ml-2" />
                    )}
                  </Label>
                  <Input
                    id="organizationName"
                    placeholder="Lincoln High School"
                    value={formData.organizationName}
                    onChange={(e) => updateFormData("organizationName", e.target.value)}
                    onBlur={() => setFieldTouched(prev => ({ ...prev, organizationName: true }))}
                    className={`mt-2 ${
                      fieldTouched.organizationName && validationErrors.organizationName
                        ? "border-warning focus:ring-warning"
                        : fieldTouched.organizationName && formData.organizationName && !validationErrors.organizationName
                        ? "border-success focus:ring-success"
                        : ""
                    }`}
                    aria-invalid={!!validationErrors.organizationName}
                    aria-describedby="organizationName-error"
                  />
                  {fieldTouched.organizationName && validationErrors.organizationName && (
                    <p id="organizationName-error" className="mt-1 text-sm text-warning">
                      {validationErrors.organizationName}
                    </p>
                  )}
                </div>

                {/* Team Name */}
                <div>
                  <Label htmlFor="teamName">
                    Team/Group Name *
                    {fieldTouched.teamName && !validationErrors.teamName && formData.teamName && (
                      <CheckCircle className="w-4 h-4 text-success inline ml-2" />
                    )}
                  </Label>
                  <Input
                    id="teamName"
                    placeholder="Varsity Football Team"
                    value={formData.teamName}
                    onChange={(e) => updateFormData("teamName", e.target.value)}
                    onBlur={() => setFieldTouched(prev => ({ ...prev, teamName: true }))}
                    className={`mt-2 ${
                      fieldTouched.teamName && validationErrors.teamName
                        ? "border-warning"
                        : fieldTouched.teamName && formData.teamName && !validationErrors.teamName
                        ? "border-success"
                        : ""
                    }`}
                  />
                  {fieldTouched.teamName && validationErrors.teamName && (
                    <p className="mt-1 text-sm text-warning">{validationErrors.teamName}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => updateFormData("category", cat.value)}
                        className={`p-3 rounded-lg border-2 transition-all text-center ${
                          formData.category === cat.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-border"
                        }`}
                      >
                        <span className="text-2xl mb-1 block">{cat.icon}</span>
                        <span className="text-sm font-medium">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campaign URL with Real-time Validation */}
                <div>
                  <Label htmlFor="slug">
                    Campaign URL *
                    {slugValidation.isChecking && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground inline ml-2" />
                    )}
                    {!slugValidation.isChecking && slugValidation.isAvailable && formData.slug && (
                      <CheckCircle className="w-4 h-4 text-success inline ml-2" />
                    )}
                    {!slugValidation.isChecking && slugValidation.error && (
                      <XCircle className="w-4 h-4 text-warning inline ml-2" />
                    )}
                  </Label>
                  <div className="mt-2 flex flex-col md:flex-row md:items-center gap-2">
                    <span className="text-sm text-muted-foreground">rally.com/raise/</span>
                    <Input
                      id="slug"
                      placeholder="lincoln-varsity-2024"
                      value={formData.slug}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                        updateFormData("slug", value);
                        setFieldTouched(prev => ({ ...prev, slug: true }));
                      }}
                      onBlur={() => setFieldTouched(prev => ({ ...prev, slug: true }))}
                      className={`flex-1 ${
                        slugValidation.error || validationErrors.slug
                          ? "border-warning"
                          : slugValidation.isAvailable && formData.slug
                          ? "border-success"
                          : ""
                      }`}
                      maxLength={50}
                    />
                  </div>
                  {(slugValidation.error || validationErrors.slug) && (
                    <p className="text-xs text-warning mt-1">
                      {slugValidation.error || validationErrors.slug}
                    </p>
                  )}
                  {slugValidation.isAvailable && formData.slug && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      This URL is available!
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.slug.length}/50 characters
                  </p>
                </div>

                {/* Goal Amount */}
                <div>
                  <Label htmlFor="goalAmount">
                    Fundraising Goal *
                    {fieldTouched.goalAmount && !validationErrors.goalAmount && formData.goalAmount && (
                      <CheckCircle className="w-4 h-4 text-success inline ml-2" />
                    )}
                  </Label>
                  <div className="mt-2 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="goalAmount"
                      type="number"
                      step="0.01"
                      placeholder="5000"
                      value={formData.goalAmount}
                      onChange={(e) => updateFormData("goalAmount", e.target.value)}
                      onBlur={() => setFieldTouched(prev => ({ ...prev, goalAmount: true }))}
                      className={`pl-8 ${
                        fieldTouched.goalAmount && validationErrors.goalAmount
                          ? "border-warning"
                          : fieldTouched.goalAmount && formData.goalAmount && !validationErrors.goalAmount
                          ? "border-success"
                          : ""
                      }`}
                      min="1"
                      max="100000"
                    />
                  </div>
                  {fieldTouched.goalAmount && validationErrors.goalAmount && (
                    <p className="mt-1 text-sm text-warning">{validationErrors.goalAmount}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum $1, Maximum $100,000
                  </p>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormData("startDate", e.target.value)}
                      onBlur={() => setFieldTouched(prev => ({ ...prev, startDate: true }))}
                      className={`mt-2 ${
                        fieldTouched.startDate && validationErrors.startDate
                          ? "border-warning"
                          : ""
                      }`}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {fieldTouched.startDate && validationErrors.startDate && (
                      <p className="mt-1 text-sm text-warning">{validationErrors.startDate}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormData("endDate", e.target.value)}
                      onBlur={() => setFieldTouched(prev => ({ ...prev, endDate: true }))}
                      className={`mt-2 ${
                        fieldTouched.endDate && validationErrors.endDate
                          ? "border-warning"
                          : ""
                      }`}
                      min={formData.startDate}
                    />
                    {fieldTouched.endDate && validationErrors.endDate && (
                      <p className="mt-1 text-sm text-warning">{validationErrors.endDate}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Customization */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Campaign Story */}
                <div>
                  <Label htmlFor="description">
                    Campaign Story *
                    {fieldTouched.description && !validationErrors.description && formData.description.length >= 10 && (
                      <CheckCircle className="w-4 h-4 text-success inline ml-2" />
                    )}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Tell donors about your team and what you're raising funds for. Share your goals, achievements, and how the funds will be used..."
                    value={formData.description}
                    onChange={(e) => updateFormData("description", e.target.value)}
                    onBlur={() => setFieldTouched(prev => ({ ...prev, description: true }))}
                    className={`mt-2 min-h-[200px] ${
                      fieldTouched.description && validationErrors.description
                        ? "border-warning"
                        : fieldTouched.description && formData.description.length >= 10
                        ? "border-success"
                        : ""
                    }`}
                    maxLength={1000}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {fieldTouched.description && validationErrors.description ? (
                      <p className="text-xs text-warning">{validationErrors.description}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Make it personal and compelling!
                      </p>
                    )}
                    <span className={`text-xs ${
                      formData.description.length > 900 ? "text-orange-600" :
                      formData.description.length > 1000 ? "text-warning" :
                      "text-muted-foreground"
                    }`}>
                      {formData.description.length}/1000
                    </span>
                  </div>
                </div>

                {/* Brand Colors */}
                <div>
                  <Label>Brand Colors</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
                          className="w-16 h-10 cursor-pointer"
                        />
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => {
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                              updateFormData("primaryColor", e.target.value);
                            }
                          }}
                          placeholder="#6366F1"
                          className="flex-1 font-mono"
                          maxLength={7}
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
                          className="w-16 h-10 cursor-pointer"
                        />
                        <Input
                          value={formData.secondaryColor}
                          onChange={(e) => {
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                              updateFormData("secondaryColor", e.target.value);
                            }
                          }}
                          placeholder="#F59E0B"
                          className="flex-1 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Color Preview */}
                <div className="bg-muted rounded-lg p-6">
                  <p className="text-sm font-medium text-foreground mb-4">
                    Preview: Your Campaign Page Colors
                  </p>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div
                        className="w-24 h-24 rounded-lg shadow-sm flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: formData.primaryColor }}
                      >
                        Primary
                      </div>
                      <div
                        className="w-24 h-24 rounded-lg shadow-sm flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: formData.secondaryColor }}
                      >
                        Secondary
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <div
                        className="h-2 rounded-full mb-2"
                        style={{
                          background: `linear-gradient(to right, ${formData.primaryColor}, ${formData.secondaryColor})`
                        }}
                      />
                      <p className="text-sm text-muted-foreground">
                        This is how your progress bar will look
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Banking Setup */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Banking Setup (Simplified for MVP)</p>
                    <p className="text-sm text-blue-800 mt-1">
                      In the full version, you'll connect your bank account via Stripe Connect for automatic payouts.
                      For now, we're using a simplified guardian approval system.
                    </p>
                  </div>
                </div>

                {/* Guardian Email */}
                <div>
                  <Label htmlFor="guardianEmail">
                    Guardian Email (Optional)
                    {fieldTouched.guardianEmail && !validationErrors.guardianEmail && formData.guardianEmail && (
                      <CheckCircle className="w-4 h-4 text-success inline ml-2" />
                    )}
                  </Label>
                  <Input
                    id="guardianEmail"
                    type="email"
                    placeholder="parent@example.com"
                    value={formData.guardianEmail}
                    onChange={(e) => updateFormData("guardianEmail", e.target.value)}
                    onBlur={() => setFieldTouched(prev => ({ ...prev, guardianEmail: true }))}
                    className={`mt-2 ${
                      fieldTouched.guardianEmail && validationErrors.guardianEmail
                        ? "border-warning"
                        : fieldTouched.guardianEmail && formData.guardianEmail && !validationErrors.guardianEmail
                        ? "border-success"
                        : ""
                    }`}
                  />
                  {fieldTouched.guardianEmail && validationErrors.guardianEmail ? (
                    <p className="text-xs text-warning mt-1">{validationErrors.guardianEmail}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Guardian will receive notifications and can approve large disbursements
                    </p>
                  )}
                </div>

                {/* Guardian Name */}
                <div>
                  <Label htmlFor="guardianName">Guardian Name (Optional)</Label>
                  <Input
                    id="guardianName"
                    placeholder="Jane Smith"
                    value={formData.guardianName}
                    onChange={(e) => updateFormData("guardianName", e.target.value)}
                    className="mt-2"
                  />
                </div>

                {/* Approval Threshold */}
                <div>
                  <Label htmlFor="approvalThreshold">Approval Threshold</Label>
                  <div className="mt-2 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="approvalThreshold"
                      type="number"
                      value={formData.approvalThreshold}
                      onChange={(e) => updateFormData("approvalThreshold", e.target.value)}
                      className="pl-8"
                      min="50"
                      max="10000"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disbursements over this amount require guardian approval (Min $50, Max $10,000)
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review & Launch */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                  <h3 className="text-xl font-bold text-primary-900 mb-2">
                    Almost there! Review your campaign
                  </h3>
                  <p className="text-primary-800 text-sm">
                    Take a moment to review all the details. You can always edit these later.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Organization Details */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-foreground">Organization Details</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Organization:</span>
                        <span className="font-medium">{formData.organizationName || "Not set"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Team:</span>
                        <span className="font-medium">{formData.teamName || "Not set"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Category:</span>
                        <span className="font-medium">{formData.category}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Goal:</span>
                        <span className="font-medium text-success">
                          ${parseFloat(formData.goalAmount || "0").toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Campaign URL:</span>
                        <span className="font-medium text-primary break-all">
                          rally.com/raise/{formData.slug || "not-set"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-medium">
                          {new Date(formData.startDate).toLocaleDateString()}
                          {formData.endDate && ` - ${new Date(formData.endDate).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Campaign Story */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-foreground">Campaign Story</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {formData.description || "No description provided"}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: formData.primaryColor }}
                        />
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: formData.secondaryColor }}
                        />
                        <span className="text-xs text-muted-foreground ml-2 leading-8">Your brand colors</span>
                      </div>
                    </div>
                  </div>

                  {/* Banking Details */}
                  {(formData.guardianEmail || formData.guardianName) && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-foreground">Guardian Oversight</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentStep(3)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="bg-muted rounded-lg p-4 space-y-2">
                        {formData.guardianName && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Guardian:</span>
                            <span className="font-medium">{formData.guardianName}</span>
                          </div>
                        )}
                        {formData.guardianEmail && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{formData.guardianEmail}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Approval Threshold:</span>
                          <span className="font-medium">${formData.approvalThreshold}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Launch Confirmation */}
                <div className="bg-success-light border border-success rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-success-dark">Ready to launch!</p>
                    <p className="text-sm text-success-dark mt-1">
                      Once you create your campaign, you'll be able to:
                    </p>
                    <ul className="text-sm text-success-dark mt-2 space-y-1 list-disc list-inside">
                      <li>Share your unique fundraising link</li>
                      <li>Add team members to help fundraise</li>
                      <li>Track donations in real-time</li>
                      <li>Manage payouts and disbursements</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col md:flex-row justify-between gap-3 mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1 || isLoading}
                className="w-full md:w-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button
                  onClick={nextStep}
                  disabled={isLoading}
                  className="w-full md:w-auto"
                >
                  Next: {STEPS[currentStep].title}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || (slugValidation.isChecking && currentStep === 1)}
                  className="bg-success hover:bg-success/90 w-full md:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Launch Campaign
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Need help? Contact us at support@rally.com</p>
        </div>
      </div>
    </div>
  );
}