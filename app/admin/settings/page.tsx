"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Loader2, AlertCircle, CheckCircle2, DollarSign, Globe, Mail, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface PlatformSettings {
  platformFeePercent: number;
  minDonationAmount: number;
  maxDonationAmount: number;
  suggestedAmounts: number[];
  maxFileUploadSize: number;
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  supportEmail: string;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  maintenanceMode: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { csrfToken } = useCsrfToken();

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      } else {
        throw new Error(data.error || "Failed to load settings");
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function updateSuggestedAmount(index: number, value: number) {
    if (!settings) return;
    const newAmounts = [...(settings.suggestedAmounts ?? [])];
    newAmounts[index] = value;
    setSettings({ ...settings, suggestedAmounts: newAmounts });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-semibold mb-2">Failed to load settings</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchSettings()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground">
          Configure global platform settings and preferences
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-success-light border border-success rounded-lg p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-success" />
          <p className="text-success-dark font-medium">Settings saved successfully!</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-warning-light border border-warning rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          <p className="text-warning-dark font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Financial Settings
            </CardTitle>
            <CardDescription>
              Configure platform fees and donation limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="platformFee">Platform Fee Percentage</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="platformFee"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings?.platformFeePercent || 0}
                  onChange={(e) => updateSetting("platformFeePercent", parseFloat(e.target.value) || 0)}
                  className="max-w-xs"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Percentage fee charged on all donations
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minDonation">Minimum Donation ($)</Label>
                <Input
                  id="minDonation"
                  type="number"
                  min="1"
                  value={settings?.minDonationAmount || 0}
                  onChange={(e) => updateSetting("minDonationAmount", parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="maxDonation">Maximum Donation ($)</Label>
                <Input
                  id="maxDonation"
                  type="number"
                  min="1"
                  value={settings?.maxDonationAmount || 0}
                  onChange={(e) => updateSetting("maxDonationAmount", parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Suggested Donation Amounts ($)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {settings?.suggestedAmounts?.map((amount, index) => (
                  <Input
                    key={index}
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => updateSuggestedAmount(index, parseInt(e.target.value) || 0)}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Quick-select amounts shown to donors
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Platform Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Platform Configuration
            </CardTitle>
            <CardDescription>
              General platform settings and limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxUpload">Max File Upload Size (MB)</Label>
              <Input
                id="maxUpload"
                type="number"
                min="1"
                max="100"
                value={settings?.maxFileUploadSize || 0}
                onChange={(e) => updateSetting("maxFileUploadSize", parseInt(e.target.value) || 0)}
                className="mt-1 max-w-xs"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum file size for uploads (images, documents, etc.)
              </p>
            </div>

            <div>
              <Label htmlFor="termsUrl">Terms of Service URL</Label>
              <Input
                id="termsUrl"
                type="url"
                value={settings?.termsOfServiceUrl || ""}
                onChange={(e) => updateSetting("termsOfServiceUrl", e.target.value)}
                className="mt-1"
                placeholder="https://yourdomain.com/terms"
              />
            </div>

            <div>
              <Label htmlFor="privacyUrl">Privacy Policy URL</Label>
              <Input
                id="privacyUrl"
                type="url"
                value={settings?.privacyPolicyUrl || ""}
                onChange={(e) => updateSetting("privacyPolicyUrl", e.target.value)}
                className="mt-1"
                placeholder="https://yourdomain.com/privacy"
              />
            </div>
          </CardContent>
        </Card>

        {/* Communication Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Communication Settings
            </CardTitle>
            <CardDescription>
              Email and notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={settings?.supportEmail || ""}
                onChange={(e) => updateSetting("supportEmail", e.target.value)}
                className="mt-1"
                placeholder="support@yourdomain.com"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={settings?.enableEmailNotifications || false}
                  onChange={(e) => updateSetting("enableEmailNotifications", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="emailNotifications" className="cursor-pointer">
                  Enable Email Notifications
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="smsNotifications"
                  checked={settings?.enableSmsNotifications || false}
                  onChange={(e) => updateSetting("enableSmsNotifications", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="smsNotifications" className="cursor-pointer">
                  Enable SMS Notifications
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Settings
            </CardTitle>
            <CardDescription>
              Advanced system configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[rgba(232,163,61,.08)] border border-[rgba(232,163,61,.4)] rounded-lg p-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="maintenanceMode"
                  checked={settings?.maintenanceMode || false}
                  onChange={(e) => updateSetting("maintenanceMode", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="maintenanceMode" className="cursor-pointer font-semibold">
                  Maintenance Mode
                </Label>
              </div>
              <p className="text-sm text-[#E8A33D] mt-2">
                When enabled, the platform will show a maintenance message to all users
                except admins. Use this for system updates or critical maintenance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => fetchSettings()}
            disabled={saving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !settings}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
