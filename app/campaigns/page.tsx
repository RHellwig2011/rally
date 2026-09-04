"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, Heart, TrendingUp, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SportArtwork } from "@/components/SportArtwork";
import { formatCurrency, calculatePercentage } from "@/lib/utils";
import type { CampaignCategory } from "@prisma/client";

interface Campaign {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  description: string;
  goalAmount: string;
  currentAmount: string;
  category: string;
  status: string;
  logoUrl: string | null;
  bannerImageUrl: string | null;
  primaryColor: string;
  endDate: string | null;
  createdAt: string;
  _count?: {
    donations: number;
  };
}

// The filter options are pinned to the CampaignCategory enum in
// prisma/schema.prisma. `import type` is erased at build time, so no Prisma
// runtime is pulled into this client bundle — only the compile-time checks
// below, which fail the build if this list ever drifts from the schema:
//   - `satisfies` rejects a value that is not a real CampaignCategory
//     (e.g. the old "TRAVEL" option, which could never match a campaign).
//   - AssertAllCategoriesListed rejects a newly added enum member that is
//     missing here, so new categories can't silently become unfilterable.
const CAMPAIGN_CATEGORIES = [
  "SPORTS",
  "EDUCATION",
  "ARTS",
  "COMMUNITY",
  "OTHER",
] as const satisfies readonly CampaignCategory[];

type MissingCategories = Exclude<
  CampaignCategory,
  (typeof CAMPAIGN_CATEGORIES)[number]
>;
type AssertAllCategoriesListed = MissingCategories extends never ? true : never;
// eslint-disable-next-line no-unused-vars -- compile-time exhaustiveness check
const _allCategoriesListed: AssertAllCategoriesListed = true;

const categories = ["All", ...CAMPAIGN_CATEGORIES];

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const goalAmount = parseInt(campaign.goalAmount);
  const currentAmount = parseInt(campaign.currentAmount);
  const percentage = calculatePercentage(currentAmount, goalAmount);

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-2 hover:border-primary">
      <div className="relative h-48 overflow-hidden">
        {campaign.bannerImageUrl ? (
          // A real uploaded team photo always wins.
          <img
            src={campaign.bannerImageUrl}
            alt={campaign.teamName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          // No photo yet: designed illustrated artwork, with the team's own
          // logo floated on top when they have one.
          <>
            <SportArtwork
              seed={`${campaign.organizationName} ${campaign.teamName}`}
              category={campaign.category}
              className="transition-transform duration-300 group-hover:scale-105"
            />
            {campaign.logoUrl && (
              <img
                src={campaign.logoUrl}
                alt={campaign.teamName}
                className="absolute inset-0 m-auto h-20 w-20 rounded-lg border border-white/30 object-cover shadow-lg"
              />
            )}
          </>
        )}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-foreground">
          {campaign.category}
        </div>
      </div>

      <CardHeader>
        <CardTitle className="text-xl group-hover:text-primary transition-colors">
          {campaign.organizationName} {campaign.teamName}
        </CardTitle>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {campaign.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-bold text-foreground">
              {formatCurrency(currentAmount)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {formatCurrency(goalAmount)}
            </span>
          </div>
          <Progress value={currentAmount} max={goalAmount} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-sm">
            <span className="font-semibold text-primary">{percentage}% funded</span>
            {campaign._count && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="w-4 h-4" />
                {campaign._count.donations} donations
              </span>
            )}
          </div>
        </div>

        {/* View Campaign Button */}
        <Button className="w-full group" asChild>
          <Link href={`/raise/${campaign.slug}`}>
            <Heart className="w-4 h-4 mr-2 group-hover:fill-current" />
            Support This Campaign
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "trending" | "ending">("trending");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    filterAndSortCampaigns();
  }, [campaigns, searchQuery, selectedCategory, sortBy]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const response = await fetch('/api/campaigns/public');
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.campaigns);
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCampaigns = () => {
    let filtered = [...campaigns];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    // Sort campaigns
    filtered.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === "trending") {
        // Sort by percentage of goal reached
        const aPercent = calculatePercentage(
          parseInt(a.currentAmount),
          parseInt(a.goalAmount)
        );
        const bPercent = calculatePercentage(
          parseInt(b.currentAmount),
          parseInt(b.goalAmount)
        );
        return bPercent - aPercent;
      } else if (sortBy === "ending") {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      return 0;
    });

    setFilteredCampaigns(filtered);
  };

  const getFeaturedCampaigns = () => {
    // Get top 3 campaigns by percentage raised
    return [...campaigns]
      .sort((a, b) => {
        const aPercent = calculatePercentage(
          parseInt(a.currentAmount),
          parseInt(a.goalAmount)
        );
        const bPercent = calculatePercentage(
          parseInt(b.currentAmount),
          parseInt(b.goalAmount)
        );
        return bPercent - aPercent;
      })
      .slice(0, 3);
  };

  const featuredCampaigns = getFeaturedCampaigns();
  const isFiltering = Boolean(searchQuery) || selectedCategory !== "All";

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-[rgba(10,13,20,.86)] backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-display font-bold text-sm leading-none">BB</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/create-campaign">Start Campaign</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-primary text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-100">
              Browse
            </p>
            <h1 className="mt-3 font-display text-[clamp(34px,5.5vw,60px)] font-semibold leading-[1.02] tracking-[-0.02em]">
              Find a team worth backing
            </h1>
            <p className="mt-4 mb-8 max-w-[46ch] text-lg text-primary-100">
              Every campaign here is a real roster with a real goal — and a ledger
              you can check before you give.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="search"
                aria-label="Search campaigns"
                placeholder="Search campaigns by team name, organization, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-6 text-lg rounded-xl border-0 bg-card shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns — a "trending" rail alongside filtered results
          reads as part of the result set, so it steps aside once the visitor
          starts narrowing. */}
      {!isFiltering && featuredCampaigns.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-8">
          <div className="bg-card border border-white/10 rounded-2xl shadow-card p-8">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Trending Campaigns</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filters and Campaigns Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter Bar */}
        <div className="bg-card border border-white/10 rounded-xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">Category:</span>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <label htmlFor="campaign-sort" className="font-semibold text-foreground">
                Sort:
              </label>
              <select
                id="campaign-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-border bg-card text-foreground rounded-lg px-4 py-2 text-sm [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="ending">Ending Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading campaigns...</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-20 bg-card border border-white/10 rounded-2xl">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              We couldn&apos;t load campaigns
            </h3>
            <p className="text-muted-foreground mb-6">
              Something went wrong on our end. Give it another try.
            </p>
            <Button onClick={fetchCampaigns}>Retry</Button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-20 bg-card border border-white/10 rounded-2xl">
            <h3 className="text-2xl font-bold text-foreground mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || selectedCategory !== "All"
                ? "Try adjusting your filters or search query"
                : "Be the first to start a campaign!"}
            </p>
            <Button asChild>
              <Link href="/create-campaign">Start a Campaign</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-6">
              <p className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredCampaigns.length}</span> campaigns
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Own Campaign?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of teams already fundraising with Bleacher Backers
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/create-campaign" className="text-lg px-8 py-6">
              Create Your Campaign
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Bleacher Backers. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
