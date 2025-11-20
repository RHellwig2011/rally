/**
 * Test script for donation flow
 * Run with: node test-donation-flow.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDonationFlow() {
  console.log('🧪 Testing Donation Flow...\n');

  try {
    // Get a test user for transaction records
    console.log('1️⃣  Finding test user...');
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@rally.com' },
    });

    if (!testUser) {
      console.error('❌ No test user found. Run test-campaign.mjs first.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${testUser.email}\n`);

    // Get a test campaign
    console.log('2️⃣  Finding test campaign...');
    const campaign = await prisma.campaign.findFirst({
      where: { slug: { startsWith: 'test-campaign' } },
      include: { bankingAccount: true },
    });

    if (!campaign) {
      console.error('❌ No test campaign found. Run test-campaign.mjs first.');
      process.exit(1);
    }

    console.log(`✅ Found campaign: ${campaign.teamName} (${campaign.slug})\n`);

    // Get initial balances
    console.log('3️⃣  Recording initial state...');
    const initialCampaignAmount = campaign.currentAmount;
    const initialBankingBalance = campaign.bankingAccount?.availableBalance || BigInt(0);
    console.log(`   - Campaign raised: $${Number(initialCampaignAmount) / 100}`);
    console.log(`   - Available balance: $${Number(initialBankingBalance) / 100}\n`);

    // Simulate donations
    const testDonations = [
      { amount: BigInt(2500), donor: 'Alice Smith', email: 'alice@example.com' }, // $25
      { amount: BigInt(5000), donor: 'Bob Johnson', email: 'bob@example.com' }, // $50
      { amount: BigInt(10000), donor: 'Carol Davis', email: 'carol@example.com' }, // $100
    ];

    console.log('4️⃣  Processing test donations...\n');

    for (const testDonation of testDonations) {
      console.log(`   💰 Processing $${Number(testDonation.amount) / 100} from ${testDonation.donor}...`);

      // Calculate expected fees
      const platformFee = (testDonation.amount * BigInt(1000)) / BigInt(10000); // 10%
      const processingFee = (testDonation.amount * BigInt(29)) / BigInt(1000) + BigInt(30); // 2.9% + $0.30
      const netAmount = testDonation.amount - platformFee - processingFee;

      // Create donation
      const donation = await prisma.donation.create({
        data: {
          campaignId: campaign.id,
          donorEmail: testDonation.email,
          donorName: testDonation.donor,
          donorMessage: 'Good luck with your fundraiser!',
          grossAmount: testDonation.amount,
          platformFee: platformFee,
          processingFee: processingFee,
          netAmount: netAmount,
          status: 'COMPLETED',
          paymentProvider: 'SIMULATED',
        },
      });

      // Update campaign
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { currentAmount: { increment: testDonation.amount } },
      });

      // Update banking account
      await prisma.bankingAccount.update({
        where: { id: campaign.bankingAccount.id },
        data: {
          totalRaised: { increment: testDonation.amount },
          platformFeesCollected: { increment: platformFee },
          availableBalance: { increment: netAmount },
        },
      });

      // Create transaction record
      const updatedBanking = await prisma.bankingAccount.findUnique({
        where: { id: campaign.bankingAccount.id },
      });

      await prisma.transaction.create({
        data: {
          bankingAccountId: campaign.bankingAccount.id,
          type: 'DEPOSIT',
          amount: netAmount,
          balanceAfter: updatedBanking.availableBalance,
          donationId: donation.id,
          description: `Donation from ${testDonation.donor}`,
          createdBy: testUser.id,
        },
      });

      console.log(`   ✅ Donation processed (ID: ${donation.id.substring(0, 8)}...)`);
      console.log(`      - Gross: $${Number(testDonation.amount) / 100}`);
      console.log(`      - Fees: -$${Number(platformFee + processingFee) / 100}`);
      console.log(`      - Net: $${Number(netAmount) / 100}\n`);
    }

    // Verify final state
    console.log('5️⃣  Verifying final state...');
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { bankingAccount: true },
    });

    const updatedBankingAccount = await prisma.bankingAccount.findUnique({
      where: { id: campaign.bankingAccount.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    const totalDonations = await prisma.donation.count({
      where: { campaignId: campaign.id },
    });

    console.log(`✅ Final state verified:`);
    console.log(`   - Total donations: ${totalDonations}`);
    console.log(`   - Campaign raised: $${Number(updatedCampaign.currentAmount) / 100}`);
    console.log(`   - Available balance: $${Number(updatedBankingAccount.availableBalance) / 100}`);
    console.log(`   - Total fees collected: $${Number(updatedBankingAccount.platformFeesCollected) / 100}`);
    console.log(`   - Recent transactions: ${updatedBankingAccount.transactions.length}\n`);

    console.log('🎉 Donation flow test passed!\n');
    console.log('🌐 Test the donation form in your browser:');
    console.log('   http://localhost:3001/test-donation\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testDonationFlow()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
