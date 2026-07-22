import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatFundraisingLink } from "@/lib/utils/team-member";

/**
 * Per-player fundraising leaderboard with a hard public/staff split.
 *
 * scope=public (default) is unauthenticated and returns ONLY the top 10
 * players with display-safe fields. The truncation and the field whitelist
 * are enforced here, server-side — the public payload never contains the
 * 11th-place player, an email, a phone number, or any contact/guardian data,
 * so there is nothing for a client to "unhide".
 *
 * scope=staff requires campaign staff — the primary leader, a listed guardian,
 * or an ADMIN — and returns the full ranked roster plus contact/donation
 * counts, so a coach can see who is falling behind.
 *
 * Money is returned as integer CENTS (Number(), because JSON.stringify throws
 * on BigInt). formatCurrency() from lib/utils consumes these directly.
 */

/** How many players are exposed on the public leaderboard. */
const PUBLIC_TOP_N = 10;

type RankedMember = {
  id: string;
  name: string;
  email: string;
  profilePhotoUrl: string | null;
  fundLinkCode: string | null;
  amountRaised: bigint;
  personalGoal: bigint | null;
  isProfilePublic: boolean;
  _count: { contacts: number; donations: number };
};

/**
 * Deterministic ranking: most raised first, then name, then id so the order is
 * stable across requests when players are tied (common early in a campaign,
 * when everyone is at $0). Ranks are computed over the SAME full roster in
 * both scopes, so a staff rank of 11 always means "just missed the public
 * board" and the dashboard cutoff line matches reality.
 */
function rankMembers(members: RankedMember[]): Array<RankedMember & { rank: number }> {
  return [...members]
    .sort((a, b) => {
      if (a.amountRaised !== b.amountRaised) {
        return a.amountRaised > b.amountRaised ? -1 : 1;
      }
      const byName = a.name.localeCompare(b.name);
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    })
    .map((member, index) => ({ ...member, rank: index + 1 }));
}

function percentOfGoal(amountRaised: bigint, personalGoal: bigint | null): number | null {
  if (!personalGoal || personalGoal <= BigInt(0)) return null;
  return Math.round((Number(amountRaised) / Number(personalGoal)) * 100);
}

/**
 * GET /api/campaigns/[campaignId]/leaderboard?scope=public|staff
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "public";

    if (scope !== "public" && scope !== "staff") {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid scope "${scope}". Valid values: public, staff`,
        },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        slug: true,
        teamName: true,
        organizationName: true,
        primaryLeaderId: true,
        minContactsPerPlayer: true,
        guardians: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Staff scope is gated before any roster data is read.
    if (scope === "staff") {
      const sessionToken = req.cookies.get("sessionToken")?.value;
      if (!sessionToken) {
        return NextResponse.json(
          { success: false, error: "Not authenticated" },
          { status: 401 }
        );
      }

      const user = await getUserFromToken(sessionToken);
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired token" },
          { status: 401 }
        );
      }

      const isAuthorized =
        campaign.primaryLeaderId === user.id ||
        campaign.guardians.some((g) => g.id === user.id) ||
        user.role === "ADMIN";

      if (!isAuthorized) {
        return NextResponse.json(
          {
            success: false,
            error: "Not authorized to view this campaign's full leaderboard",
          },
          { status: 403 }
        );
      }
    }

    const members = (await prisma.teamMember.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        profilePhotoUrl: true,
        fundLinkCode: true,
        amountRaised: true,
        personalGoal: true,
        isProfilePublic: true,
        _count: {
          select: {
            contacts: true,
            donations: { where: { status: "COMPLETED" } },
          },
        },
      },
    })) as RankedMember[];

    const ranked = rankMembers(members);

    if (scope === "public") {
      // Only the top N, and only players who have not made their profile
      // private. A private player keeps their rank slot rather than being
      // replaced by #11 — we never promote someone into a place they did not
      // earn just to fill the board out to ten rows.
      const publicEntries = ranked
        .filter((m) => m.rank <= PUBLIC_TOP_N && m.isProfilePublic)
        .map((m) => ({
          rank: m.rank,
          id: m.id,
          name: m.name,
          profilePhotoUrl: m.profilePhotoUrl,
          amountRaised: Number(m.amountRaised),
          personalGoal: m.personalGoal ? Number(m.personalGoal) : null,
          percentOfGoal: percentOfGoal(m.amountRaised, m.personalGoal),
          fundraisingLink: formatFundraisingLink(
            campaign.slug,
            m.fundLinkCode || m.id
          ),
          // Relative path for in-app <Link> navigation.
          fundraisingPath: `/raise/${campaign.slug}/player/${m.fundLinkCode || m.id}`,
        }));

      return NextResponse.json(
        {
          success: true,
          scope: "public",
          publicLimit: PUBLIC_TOP_N,
          campaign: {
            id: campaign.id,
            slug: campaign.slug,
            teamName: campaign.teamName,
            organizationName: campaign.organizationName,
          },
          leaderboard: publicEntries,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        }
      );
    }

    // ---- staff scope: full ranked roster ----
    const quota = campaign.minContactsPerPlayer;

    const staffEntries = ranked.map((m) => {
      const amountRaised = Number(m.amountRaised);
      const contactCount = m._count.contacts;
      const belowQuota = quota > 0 && contactCount < quota;

      return {
        rank: m.rank,
        id: m.id,
        name: m.name,
        email: m.email,
        profilePhotoUrl: m.profilePhotoUrl,
        amountRaised,
        personalGoal: m.personalGoal ? Number(m.personalGoal) : null,
        percentOfGoal: percentOfGoal(m.amountRaised, m.personalGoal),
        contactCount,
        donationCount: m._count.donations,
        contactsRemaining: Math.max(quota - contactCount, 0),
        belowContactQuota: belowQuota,
        // True when this row is one of the rows the public leaderboard shows.
        publiclyVisible: m.rank <= PUBLIC_TOP_N && m.isProfilePublic,
        isProfilePublic: m.isProfilePublic,
        needsAttention: amountRaised === 0 || belowQuota,
        fundraisingLink: formatFundraisingLink(
          campaign.slug,
          m.fundLinkCode || m.id
        ),
        fundraisingPath: `/raise/${campaign.slug}/player/${m.fundLinkCode || m.id}`,
      };
    });

    const totalRaised = staffEntries.reduce((sum, e) => sum + e.amountRaised, 0);

    return NextResponse.json(
      {
        success: true,
        scope: "staff",
        publicLimit: PUBLIC_TOP_N,
        minContactsPerPlayer: quota,
        campaign: {
          id: campaign.id,
          slug: campaign.slug,
          teamName: campaign.teamName,
          organizationName: campaign.organizationName,
        },
        leaderboard: staffEntries,
        totals: {
          playerCount: staffEntries.length,
          // How many rows fall below the public cutoff — i.e. how much of the
          // roster the public board is hiding.
          hiddenFromPublic: staffEntries.filter((e) => !e.publiclyVisible).length,
          totalRaised,
          playersWithNothingRaised: staffEntries.filter((e) => e.amountRaised === 0)
            .length,
          playersBelowContactQuota: staffEntries.filter((e) => e.belowContactQuota)
            .length,
          playersNeedingAttention: staffEntries.filter((e) => e.needsAttention).length,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
