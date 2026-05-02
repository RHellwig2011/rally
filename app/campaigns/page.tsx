"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, Heart, TrendingUp, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, calculatePercentage } from "@/lib/utils";

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

const categories = [
  "All",
  "SPORTS",
  "EDUCATION",
  "ARTS",
  "COMMUNITY",
  "TRAVEL",
  "OTHER"
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
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
      const response = await fetch('/api/campaigns/public');
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
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

  const CampaignCard = ({ campaign }: { campaign: Campaign }) => {
    const goalAmount = parseInt(campaign.goalAmount);
    const currentAmount = parseInt(campaign.currentAmount);
    const percentage = calculatePercentage(currentAmount, goalAmount);

    return (
      <Card className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-2 hover:border-primary-200">
        <div className="relative h-48 bg-gradient-to-br from-primary-100 to-secondary-100 overflow-hidden">
          {campaign.bannerImageUrl ? (
            <img
              src={campaign.bannerImageUrl}
              alt={campaign.teamName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-primary-600">
                {campaign.logoUrl ? (
                  <img
                    src={campaign.logoUrl}
                    alt={campaign.teamName}
                    className="w-24 h-24 mx-auto rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-6xl font-bold">{campaign.teamName.charAt(0)}</span>
                )}
              </div>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-700">
            {campaign.category}
          </div>
        </div>

        <CardHeader>
          <CardTitle className="text-xl group-hover:text-primary transition-colors">
            {campaign.organizationName} {campaign.teamName}
          </CardTitle>
          <p className="text-gray-600 line-clamp-2 text-sm">
            {campaign.description}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(currentAmount)}
              </span>
              <span className="text-sm text-gray-600">
                of {formatCurrency(goalAmount)}
              </span>
            </div>
            <Progress value={currentAmount} max={goalAmount} className="h-2" />
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="font-semibold text-primary">{percentage}% funded</span>
              {campaign._count && (
                <span className="text-gray-600 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {campaign._count.donations} donors
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
  };

  const featuredCampaigns = getFeaturedCampaigns();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg leading-none">R</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Rally</span>
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
      <section className="bg-gradient-to-br from-primary-600 to-purple-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Discover Amazing Campaigns
            </h1>
            <p className="text-xl text-indigo-100 mb-8">
              Support youth teams, clubs, and school groups making their dreams come true
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search campaigns by team name, organization, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-6 text-lg rounded-xl border-0 shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns */}
      {featuredCampaigns.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-gray-900">Trending Campaigns</h2>
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
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-700">Category:</span>
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
              <span className="font-semibold text-gray-700">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="ending">Ending Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredCampaigns.length}</span> campaigns
          </p>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading campaigns...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-md">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No campaigns found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || selectedCategory !== "All"
                ? "Try adjusting your filters or search query"
                : "Be the first to start a campaign!"}
            </p>
            <Button asChild>
              <Link href="/create-campaign">Start a Campaign</Link>
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-600 to-purple-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Own Campaign?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Join hundreds of teams already fundraising with Rally
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
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-gray-600">
            <p>&copy; {new Date().getFullYear()} Rally. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
