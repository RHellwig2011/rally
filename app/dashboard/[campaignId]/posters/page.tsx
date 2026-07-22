"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Share2, ArrowLeft, Sparkles, Instagram, Facebook, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, calculatePercentage } from "@/lib/utils";
import { toPng, toJpeg } from 'html-to-image';

interface Campaign {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  description: string;
  // Dollar values (the campaign API divides cents by 100 before responding)
  goalAmount: number;
  currentAmount: number;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

const sizes = {
  instagram: { width: 1080, height: 1080, name: "Instagram Post" },
  facebook: { width: 1200, height: 630, name: "Facebook Post" },
  twitter: { width: 1200, height: 675, name: "Twitter Post" },
  story: { width: 1080, height: 1920, name: "Instagram Story" },
};

const templates = ["modern", "classic", "bold", "minimal"];

export default function PostersPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.campaignId as string;
  const posterRef = useRef<HTMLDivElement>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<keyof typeof sizes>("instagram");
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data = await response.json();

      if (data.success) {
        setCampaign(data.campaign);
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPoster = async () => {
    if (!posterRef.current || !campaign) return;

    setDownloading(true);

    try {
      const size = sizes[selectedSize];

      // Convert the poster element to PNG
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        width: size.width,
        height: size.height,
        pixelRatio: 2, // Higher quality
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });

      // Download the image
      const link = document.createElement('a');
      link.download = `${campaign.slug}-poster-${selectedSize}-${selectedTemplate}.png`;
      link.href = dataUrl;
      link.click();

    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download poster. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Campaign Not Found</h1>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // API returns dollars; formatCurrency expects cents
  const goalAmount = Math.round(Number(campaign.goalAmount) * 100);
  const currentAmount = Math.round(Number(campaign.currentAmount) * 100);
  const percentage = calculatePercentage(currentAmount, goalAmount);
  const size = sizes[selectedSize];

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/dashboard/${campaignId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-primary" />
                Generate Posters
              </h1>
              <p className="text-muted-foreground">
                Create beautiful shareable graphics for your campaign
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Size Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Poster Size</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(sizes).map(([key, sizeInfo]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSize(key as keyof typeof sizes)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedSize === key
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:border-primary-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedSize === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {key === 'instagram' && <Instagram className="w-5 h-5" />}
                        {key === 'facebook' && <Facebook className="w-5 h-5" />}
                        {key === 'twitter' && <Twitter className="w-5 h-5" />}
                        {key === 'story' && <Instagram className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{sizeInfo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sizeInfo.width} × {sizeInfo.height}px
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Style</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all capitalize ${
                      selectedTemplate === template
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:border-primary-200'
                    }`}
                  >
                    {template}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={downloadPoster}
                  disabled={downloading}
                  className="w-full"
                  size="lg"
                >
                  {downloading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Download Poster
                    </>
                  )}
                </Button>
                <Button variant="outline" className="w-full" size="lg">
                  <Share2 className="w-5 h-5 mr-2" />
                  Share Direct Link
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Poster Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-xl p-8 flex items-center justify-center min-h-[600px]">
                  <div
                    ref={posterRef}
                    className="bg-white shadow-2xl rounded-xl overflow-hidden"
                    style={{
                      width: selectedSize === 'story' ? '300px' : '600px',
                      aspectRatio: `${size.width} / ${size.height}`,
                    }}
                  >
                    {/* Modern Template */}
                    {selectedTemplate === 'modern' && (
                      <div
                        className="w-full h-full p-8 flex flex-col justify-between text-white"
                        style={{
                          background: `linear-gradient(135deg, ${campaign.primaryColor} 0%, ${campaign.secondaryColor} 100%)`,
                        }}
                      >
                        <div>
                          {campaign.logoUrl ? (
                            <img src={campaign.logoUrl} alt="Logo" className="w-16 h-16 rounded-xl mb-4" />
                          ) : (
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
                              <span className="text-3xl font-bold">{campaign.teamName.charAt(0)}</span>
                            </div>
                          )}
                          <h2 className="text-3xl font-bold mb-2">Support Our Team!</h2>
                          <p className="text-xl opacity-90">{campaign.organizationName} {campaign.teamName}</p>
                        </div>

                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6">
                          <div className="text-4xl font-bold mb-2">{formatCurrency(currentAmount)}</div>
                          <div className="text-sm opacity-90 mb-3">raised of {formatCurrency(goalAmount)} goal</div>
                          <div className="w-full bg-white/30 rounded-full h-3">
                            <div
                              className="bg-white rounded-full h-3 transition-all duration-500"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            ></div>
                          </div>
                          <div className="text-sm font-semibold mt-2">{percentage}% funded</div>
                        </div>

                        <div className="bg-white text-foreground py-3 px-4 rounded-lg font-bold text-center">
                          rally.com/{campaign.slug}
                        </div>
                      </div>
                    )}

                    {/* Classic Template */}
                    {selectedTemplate === 'classic' && (
                      <div className="w-full h-full p-8 flex flex-col justify-center items-center bg-white text-foreground">
                        {campaign.logoUrl && (
                          <img src={campaign.logoUrl} alt="Logo" className="w-24 h-24 rounded-full mb-6 object-cover" />
                        )}
                        <h2 className="text-4xl font-bold mb-3 text-center">Support {campaign.teamName}</h2>
                        <p className="text-xl text-muted-foreground mb-8 text-center">{campaign.organizationName}</p>

                        <div className="w-full max-w-md bg-muted rounded-2xl p-6 mb-8">
                          <div className="flex justify-between items-baseline mb-4">
                            <div className="text-3xl font-bold" style={{ color: campaign.primaryColor }}>
                              {formatCurrency(currentAmount)}
                            </div>
                            <div className="text-muted-foreground">of {formatCurrency(goalAmount)}</div>
                          </div>
                          <div className="w-full bg-accent rounded-full h-4 mb-2">
                            <div
                              className="rounded-full h-4 transition-all duration-500"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                                backgroundColor: campaign.primaryColor,
                              }}
                            ></div>
                          </div>
                          <div className="text-center text-sm font-semibold text-foreground">{percentage}% Complete</div>
                        </div>

                        <div
                          className="text-white py-4 px-8 rounded-full font-bold text-lg"
                          style={{ backgroundColor: campaign.primaryColor }}
                        >
                          Donate at rally.com/{campaign.slug}
                        </div>
                      </div>
                    )}

                    {/* Bold Template */}
                    {selectedTemplate === 'bold' && (
                      <div className="w-full h-full relative overflow-hidden">
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundColor: campaign.primaryColor,
                            opacity: 0.1,
                          }}
                        ></div>
                        <div className="relative w-full h-full p-8 flex flex-col justify-between">
                          <div>
                            <div className="text-6xl font-black mb-4" style={{ color: campaign.primaryColor }}>
                              {percentage}%
                            </div>
                            <div className="text-3xl font-bold text-foreground mb-2">FUNDED</div>
                            <div className="h-2 bg-accent rounded-full mb-6">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                  backgroundColor: campaign.primaryColor,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div>
                            <h2 className="text-4xl font-bold text-foreground mb-3">
                              {campaign.organizationName}
                            </h2>
                            <p className="text-2xl text-foreground mb-8">{campaign.teamName}</p>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                              <div className="bg-white p-4 rounded-xl shadow-md">
                                <div className="text-2xl font-bold text-foreground">{formatCurrency(currentAmount)}</div>
                                <div className="text-sm text-muted-foreground">Raised</div>
                              </div>
                              <div className="bg-white p-4 rounded-xl shadow-md">
                                <div className="text-2xl font-bold text-foreground">{formatCurrency(goalAmount)}</div>
                                <div className="text-sm text-muted-foreground">Goal</div>
                              </div>
                            </div>

                            <div
                              className="text-white py-4 px-6 rounded-xl font-bold text-center text-xl"
                              style={{ backgroundColor: campaign.primaryColor }}
                            >
                              rally.com/{campaign.slug}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Minimal Template */}
                    {selectedTemplate === 'minimal' && (
                      <div className="w-full h-full p-12 flex flex-col justify-center bg-white">
                        <div className="text-center">
                          <div className="text-sm uppercase tracking-widest text-muted-foreground mb-8">Fundraising Campaign</div>
                          <h1 className="text-5xl font-light text-foreground mb-3">{campaign.teamName}</h1>
                          <p className="text-xl text-muted-foreground mb-12">{campaign.organizationName}</p>

                          <div className="max-w-md mx-auto mb-12">
                            <div className="flex justify-between items-baseline mb-3">
                              <span className="text-4xl font-light text-foreground">{formatCurrency(currentAmount)}</span>
                              <span className="text-lg text-muted-foreground">/ {formatCurrency(goalAmount)}</span>
                            </div>
                            <div className="w-full h-1 bg-accent rounded-full">
                              <div
                                className="h-1 rounded-full bg-foreground"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="border-2 border-border py-3 px-8 inline-block rounded-full">
                            <span className="font-semibold text-foreground">rally.com/{campaign.slug}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
