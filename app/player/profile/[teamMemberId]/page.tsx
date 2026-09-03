"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save,
  Loader2,
  Eye,
  Upload,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kicker, PageTitle, SiteHeader, TeamChip } from "@/components/app-chrome";

// Card section heads (BRIEF §2): uppercase Archivo at component-head scale.
const SECTION_TITLE =
  "text-[15px] font-extrabold uppercase tracking-[0.04em]";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface TeamMemberProfile {
  id: string;
  name: string;
  personalGoal: string | null;
  amountRaised: string;
  profilePhotoUrl: string | null;
  profileVideoUrl: string | null;
  personalStory: string | null;
  position: string | null;
  grade: string | null;
  favoriteQuote: string | null;
  isProfilePublic: boolean;
  campaign: {
    slug: string;
    organizationName: string;
    teamName: string;
  };
}

export default function PlayerProfileEditor() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { csrfToken } = useCsrfToken();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<TeamMemberProfile | null>(null);

  const [formData, setFormData] = useState({
    profilePhotoUrl: "",
    profileVideoUrl: "",
    personalStory: "",
    position: "",
    grade: "",
    favoriteQuote: "",
    isProfilePublic: true,
  });

  useEffect(() => {
    fetchProfile();
  }, [params?.teamMemberId]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/team-members/${params?.teamMemberId}`);
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(result.error || "Failed to load profile");
      }

      setProfile(result);
      setFormData({
        profilePhotoUrl: result.profilePhotoUrl || "",
        profileVideoUrl: result.profileVideoUrl || "",
        personalStory: result.personalStory || "",
        position: result.position || "",
        grade: result.grade || "",
        favoriteQuote: result.favoriteQuote || "",
        isProfilePublic: result.isProfilePublic,
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/team-members/${params?.teamMemberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to save profile");
      }

      toast({
        title: "Success!",
        description: "Your profile has been updated",
      });

      // Refresh profile data
      await fetchProfile();
    } catch (err) {
      console.error("Error saving profile:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-warning mb-4">Profile not found</p>
          <Button onClick={() => router.push('/player')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const playerPageUrl = `/raise/${profile.campaign.slug}/player/${profile.id}`;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <SiteHeader
        left={
          <TeamChip className="hidden sm:inline-flex">
            {profile.campaign.organizationName} · {profile.campaign.teamName}
          </TeamChip>
        }
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={playerPageUrl} target="_blank">
            <Eye className="w-4 h-4 mr-2" />
            Preview Page
            <ExternalLink className="w-3 h-3 ml-1" />
          </Link>
        </Button>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </SiteHeader>

      {/* BRIEF §4 screen 07: centered narrow column. */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <Kicker tone="team">My page</Kicker>
          <PageTitle className="mb-2 mt-2">Edit Your Profile</PageTitle>
          <p className="text-muted-foreground">
            Customize your fundraising page for {profile.campaign.organizationName} {profile.campaign.teamName}
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Photo */}
          <Card>
            <CardHeader>
              <CardTitle className={SECTION_TITLE}>Profile Photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.profilePhotoUrl && (
                <div className="relative w-40 h-40">
                  {/* User-supplied remote URL: plain <img>, not next/image */}
                  <img
                    src={formData.profilePhotoUrl}
                    alt="Profile photo"
                    width={160}
                    height={160}
                    loading="lazy"
                    className="h-full w-full rounded-full border-2 border-white/15 object-cover shadow-card"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, profilePhotoUrl: "" })}
                    className="absolute right-0 top-0 rounded-full bg-destructive p-1 text-white shadow-[0_0_14px_rgba(242,97,75,.5)] transition-transform duration-200 ease-spring hover:brightness-110 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div>
                <Label htmlFor="profilePhotoUrl">Link to a photo of you</Label>
                <Input
                  id="profilePhotoUrl"
                  type="url"
                  placeholder="https://example.com/your-photo.jpg"
                  value={formData.profilePhotoUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, profilePhotoUrl: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Ask a parent: open the photo in Google Photos or iCloud, tap
                  Share &rarr; Copy Link, paste it here. A school portrait link
                  works too.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profile Video */}
          <Card>
            <CardHeader>
              <CardTitle className={SECTION_TITLE}>Profile Video (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.profileVideoUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden">
                  <video
                    src={formData.profileVideoUrl}
                    controls
                    className="w-full h-full"
                  >
                    Your browser does not support the video tag.
                  </video>
                  <button
                    onClick={() => setFormData({ ...formData, profileVideoUrl: "" })}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-white shadow-[0_0_14px_rgba(242,97,75,.5)] transition-transform duration-200 ease-spring hover:brightness-110 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div>
                <Label htmlFor="profileVideoUrl">Link to a video of you</Label>
                <Input
                  id="profileVideoUrl"
                  type="url"
                  placeholder="https://example.com/your-video.mp4"
                  value={formData.profileVideoUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, profileVideoUrl: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Same idea as the photo: record a quick hello, then paste the
                  share link here.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Personal Story */}
          <Card>
            <CardHeader>
              <CardTitle className={SECTION_TITLE}>Your Story</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="personalStory">Tell supporters about yourself and why you're fundraising</Label>
              <Textarea
                id="personalStory"
                rows={8}
                placeholder="Hi! I'm raising money for our team because..."
                value={formData.personalStory}
                onChange={(e) =>
                  setFormData({ ...formData, personalStory: e.target.value })
                }
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                {formData.personalStory.length} characters
              </p>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle className={SECTION_TITLE}>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position">Position/Role</Label>
                  <Input
                    id="position"
                    placeholder="e.g., Forward, Midfielder"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="grade">Grade/Year</Label>
                  <Input
                    id="grade"
                    placeholder="e.g., Junior, 11th Grade"
                    value={formData.grade}
                    onChange={(e) =>
                      setFormData({ ...formData, grade: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="favoriteQuote">Favorite Quote</Label>
                <Textarea
                  id="favoriteQuote"
                  rows={3}
                  placeholder="Enter a motivational quote or personal motto"
                  value={formData.favoriteQuote}
                  onChange={(e) =>
                    setFormData({ ...formData, favoriteQuote: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <CardTitle className={SECTION_TITLE}>Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isProfilePublic"
                  checked={formData.isProfilePublic}
                  onChange={(e) =>
                    setFormData({ ...formData, isProfilePublic: e.target.checked })
                  }
                  className="h-[18px] w-[18px] rounded border-white/20 bg-white/[0.05] accent-[#22C48B]"
                />
                <Label htmlFor="isProfilePublic" className="font-normal">
                  Show my page to anyone with the link (needed so family can give)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                When public, anyone with your link can view your fundraising page
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
            >
              <Link href={playerPageUrl} target="_blank">
                <Eye className="w-5 h-5 mr-2" />
                Preview
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
