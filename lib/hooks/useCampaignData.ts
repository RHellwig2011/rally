import { useState, useEffect, useCallback } from 'react';

interface CampaignData {
  campaign: any;
  statistics: any;
  recentDonations: any[];
  stats: any;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCampaignData(campaignId: string): CampaignData {
  const [campaign, setCampaign] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [recentDonations, setRecentDonations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaignData = useCallback(async () => {
    if (!campaignId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in parallel for better performance
      const [campaignRes, statsRes, donationsRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/stats`),
        fetch(`/api/campaigns/${campaignId}/recent-donations?limit=10`),
      ]);

      // Check for errors
      if (!campaignRes.ok) {
        const error = await campaignRes.json();
        throw new Error(error.error || 'Failed to fetch campaign data');
      }

      if (!statsRes.ok) {
        const error = await statsRes.json();
        throw new Error(error.error || 'Failed to fetch campaign stats');
      }

      if (!donationsRes.ok) {
        const error = await donationsRes.json();
        throw new Error(error.error || 'Failed to fetch recent donations');
      }

      // Parse responses
      const campaignData = await campaignRes.json();
      const statsData = await statsRes.json();
      const donationsData = await donationsRes.json();

      setCampaign(campaignData.campaign);
      setStatistics(campaignData.campaign.statistics);
      setStats(statsData.stats);
      setRecentDonations(donationsData.donations);
    } catch (err) {
      console.error('Error fetching campaign data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  // Initial fetch
  useEffect(() => {
    fetchCampaignData();
  }, [fetchCampaignData]);

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCampaignData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchCampaignData]);

  return {
    campaign,
    statistics,
    recentDonations,
    stats,
    isLoading,
    error,
    refresh: fetchCampaignData,
  };
}