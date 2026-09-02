'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Users, Mail, Phone, AlertCircle } from 'lucide-react';

interface TeamMemberInfo {
  teamMember: {
    id: string;
    name: string;
    position?: string;
    grade?: string;
    onboardingCompleted: boolean;
  };
  campaign: {
    id: string;
    teamName: string;
    organizationName: string;
    slug: string;
    logoUrl?: string;
    primaryColor: string;
  };
}

export default function TeamMemberOnboardingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const teamMemberId = params?.teamMemberId as string;
  const token = searchParams?.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [teamMemberInfo, setTeamMemberInfo] = useState<TeamMemberInfo | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showSecondParent, setShowSecondParent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    secondParentFirstName: '',
    secondParentLastName: '',
    secondParentEmail: '',
    secondParentPhone: '',
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Please check your email for the correct link.');
      setLoading(false);
      return;
    }

    fetchTeamMemberInfo();
  }, [token]);

  const fetchTeamMemberInfo = async () => {
    try {
      const response = await fetch(`/api/team-members/${teamMemberId}/onboard?token=${token}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load information');
      }

      const data = await response.json();

      setTeamMemberInfo(data);
      if (data.teamMember.onboardingCompleted) {
        setAlreadyOnboarded(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load invitation information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Validation
    if (!formData.parentFirstName || !formData.parentLastName) {
      setError('Please enter at least one parent/guardian name');
      setSubmitting(false);
      return;
    }

    if (!formData.parentEmail && !formData.parentPhone) {
      setError('Please enter at least one contact method (email or phone) for your parent/guardian');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/team-members/${teamMemberId}/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationToken: token,
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      await response.json();

      // No auto-redirect: the fundraising link is the whole point of this
      // screen, and bouncing to the team page three seconds later loses it.
      setSuccess(true);

    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // The player's own page — what family should actually receive.
  const fundraisingLink = () =>
    typeof window === 'undefined' || !teamMemberInfo
      ? ''
      : `${window.location.origin}/raise/${teamMemberInfo.campaign.slug}/player/${teamMemberId}`;

  const copyFundraisingLink = async () => {
    try {
      await navigator.clipboard.writeText(fundraisingLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-muted-foreground">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !teamMemberInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertCircle className="h-6 w-6" />
              <CardTitle className="font-display">Oops!</CardTitle>
            </div>
            <CardDescription className="text-base">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (alreadyOnboarded && teamMemberInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-success mb-2">
              <CheckCircle2 className="h-8 w-8" />
              <CardTitle className="font-display">You&apos;re already on the team</CardTitle>
            </div>
            <CardDescription className="text-base">
              Here&apos;s your page. Share it with family and the gifts come to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="lg" onClick={copyFundraisingLink}>
              {copied ? 'Link copied' : 'Copy my fundraising link'}
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link
                href={`/raise/${teamMemberInfo.campaign.slug}/player/${teamMemberId}`}
              >
                See my page
              </Link>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link href={`/raise/${teamMemberInfo.campaign.slug}`}>
                See the team page
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-success mb-2">
              <CheckCircle2 className="h-8 w-8" />
              <CardTitle className="font-display">All Set!</CardTitle>
            </div>
            <CardDescription className="text-base">
              Ask a parent to text your page to family tonight. That&apos;s the
              whole job.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="lg" onClick={copyFundraisingLink}>
              {copied ? 'Link copied' : 'Copy my fundraising link'}
            </Button>
            {teamMemberInfo && (
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/raise/${teamMemberInfo.campaign.slug}`}>
                  See the team page
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {teamMemberInfo?.campaign.logoUrl && (
            <img
              src={teamMemberInfo.campaign.logoUrl}
              alt="Team Logo"
              className="h-20 w-20 object-contain mx-auto mb-4"
            />
          )}
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-secondary mb-2">
            You're on the roster
          </p>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] font-semibold tracking-[-0.02em] text-primary mb-2">
            Welcome, {teamMemberInfo?.teamMember.name}! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            {teamMemberInfo?.campaign.teamName} — {teamMemberInfo?.campaign.organizationName}
          </p>
        </div>

        {/* Tutorial Steps */}
        {currentStep === 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <div className="bg-primary-100 text-primary-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
                  1
                </div>
                How This Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
                <h3 className="font-display font-semibold text-primary mb-2">Your Fundraising Journey</h3>
                <ul className="space-y-2 text-sm text-primary-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span>Your coach has invited you to join the team fundraiser</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span>You'll get your own personal fundraising page to share with family and friends</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span>People can donate directly to support you and the team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span>Your parents will receive updates about your fundraising progress</span>
                  </li>
                </ul>
              </div>

              <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
                <h3 className="font-semibold text-secondary-900 mb-2">
                  Just a parent we can update when gifts come in
                </h3>
                <p className="text-sm text-secondary-800 mb-3">
                  Two minutes, then you&apos;re done:
                </p>
                <ul className="space-y-2 text-sm text-secondary-800">
                  <li className="flex items-start gap-2">
                    <Mail className="h-5 w-5 text-secondary-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Your email</strong> (optional) - So we can send you updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Phone className="h-5 w-5 text-secondary-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Your phone</strong> (optional) - For text notifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-5 w-5 text-secondary-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Your parent(s) contact info</strong> (required) - So they can stay informed</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={() => setCurrentStep(2)}
                className="w-full bg-primary-600 hover:bg-primary-700"
                size="lg"
              >
                Got It! Let's Get Started
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contact Form */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <div className="bg-primary-100 text-primary-600 rounded-full h-8 w-8 flex items-center justify-center font-bold">
                  2
                </div>
                Your Contact Information
              </CardTitle>
              <CardDescription>
                This helps us keep you and your parents informed about your fundraising progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Player Contact Info */}
                <div className="space-y-4">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                    Your Contact Info <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                  </h3>

                  <div>
                    <Label htmlFor="email">Your Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">We'll send you updates about donations and progress</p>
                  </div>

                  <div>
                    <Label htmlFor="phone">Your Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Optional: For text notifications</p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5" />
                    Parent/Guardian Contact Info <span className="text-sm font-normal text-warning">(Required)</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="parentFirstName">First Name *</Label>
                        <Input
                          id="parentFirstName"
                          required
                          placeholder="First name"
                          value={formData.parentFirstName}
                          onChange={(e) => handleInputChange('parentFirstName', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="parentLastName">Last Name *</Label>
                        <Input
                          id="parentLastName"
                          required
                          placeholder="Last name"
                          value={formData.parentLastName}
                          onChange={(e) => handleInputChange('parentLastName', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="parentEmail">Parent Email *</Label>
                      <Input
                        id="parentEmail"
                        type="email"
                        placeholder="parent@example.com"
                        value={formData.parentEmail}
                        onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Your parent will receive fundraising updates</p>
                    </div>

                    <div>
                      <Label htmlFor="parentPhone">Parent Phone</Label>
                      <Input
                        id="parentPhone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.parentPhone}
                        onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">At least one contact method (email or phone) is required</p>
                    </div>
                  </div>
                </div>

                {/* Second Parent (Optional) */}
                {!showSecondParent && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSecondParent(true)}
                    className="w-full"
                  >
                    + Add Second Parent/Guardian
                  </Button>
                )}

                {showSecondParent && (
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                        Second Parent/Guardian <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowSecondParent(false);
                          setFormData(prev => ({
                            ...prev,
                            secondParentFirstName: '',
                            secondParentLastName: '',
                            secondParentEmail: '',
                            secondParentPhone: '',
                          }));
                        }}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="secondParentFirstName">First Name</Label>
                          <Input
                            id="secondParentFirstName"
                            placeholder="First name"
                            value={formData.secondParentFirstName}
                            onChange={(e) => handleInputChange('secondParentFirstName', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="secondParentLastName">Last Name</Label>
                          <Input
                            id="secondParentLastName"
                            placeholder="Last name"
                            value={formData.secondParentLastName}
                            onChange={(e) => handleInputChange('secondParentLastName', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="secondParentEmail">Email</Label>
                        <Input
                          id="secondParentEmail"
                          type="email"
                          placeholder="parent@example.com"
                          value={formData.secondParentEmail}
                          onChange={(e) => handleInputChange('secondParentEmail', e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="secondParentPhone">Phone</Label>
                        <Input
                          id="secondParentPhone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={formData.secondParentPhone}
                          onChange={(e) => handleInputChange('secondParentPhone', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="w-full"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary-600 hover:bg-primary-700"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  By completing this form, you agree to share this information with your coach and team administrators.
                  Your parents will receive notifications about your fundraising activities.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
