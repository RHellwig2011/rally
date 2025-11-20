/**
 * Test script for campaign creation
 * Run with: node test-campaign.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testCampaignCreation() {
  console.log('🧪 Testing Campaign Creation Flow...\n');

  try {
    // Step 1: Create a test user
    console.log('1️⃣  Creating test user...');
    const hashedPassword = await bcrypt.hash('test123', 10);

    const user = await prisma.user.create({
      data: {
        email: 'test@rally.com',
        firstName: 'Test',
        lastName: 'Leader',
        role: 'CAMPAIGN_LEADER',
        passwordHash: hashedPassword,
        emailVerified: true,
      },
    });
    console.log(`✅ User created: ${user.email} (ID: ${user.id})\n`);

    // Step 2: Create test campaigns with various amounts
    const testCases = [
      { name: 'Small Goal', amount: BigInt(5000) }, // $50
      { name: 'Medium Goal', amount: BigInt(1000000) }, // $10,000
      { name: 'Large Goal', amount: BigInt(5000000) }, // $50,000
      { name: 'Very Large Goal', amount: BigInt(100000000) }, // $1,000,000
    ];

    for (const testCase of testCases) {
      console.log(`2️⃣  Creating campaign: ${testCase.name} ($${Number(testCase.amount) / 100})...`);

      const campaign = await prisma.campaign.create({
        data: {
          organizationName: 'Lincoln High School',
          teamName: `Robotics Team - ${testCase.name}`,
          slug: `test-campaign-${testCase.name.toLowerCase().replace(/\s+/g, '-')}`,
          description: `This is a test campaign for ${testCase.name}. We're raising funds for our robotics competition!`,
          goalAmount: testCase.amount,
          currentAmount: BigInt(0),
          startDate: new Date(),
          status: 'ACTIVE',
          category: 'EDUCATION',
          primaryLeaderId: user.id,
          platformFeePercent: 10.0,
          bankingAccount: {
            create: {
              approvalThreshold: BigInt(50000), // $500
              requiresGuardianApproval: true,
            },
          },
        },
        include: {
          bankingAccount: true,
        },
      });

      console.log(`✅ Campaign created successfully!`);
      console.log(`   - ID: ${campaign.id}`);
      console.log(`   - Slug: ${campaign.slug}`);
      console.log(`   - Goal: $${Number(campaign.goalAmount) / 100}`);
      console.log(`   - Banking Account ID: ${campaign.bankingAccount?.id}\n`);
    }

    // Step 3: Test donation with BigInt
    console.log('3️⃣  Creating test donation...');
    const campaigns = await prisma.campaign.findMany({
      where: { primaryLeaderId: user.id },
      take: 1,
    });

    if (campaigns.length > 0) {
      const donation = await prisma.donation.create({
        data: {
          campaignId: campaigns[0].id,
          donorEmail: 'donor@example.com',
          donorName: 'John Donor',
          grossAmount: BigInt(10000), // $100
          platformFee: BigInt(1000), // $10 (10%)
          processingFee: BigInt(300), // $3 (3%)
          netAmount: BigInt(8700), // $87
          status: 'COMPLETED',
          paymentProvider: 'SIMULATED',
        },
      });

      console.log(`✅ Donation created successfully!`);
      console.log(`   - ID: ${donation.id}`);
      console.log(`   - Gross Amount: $${Number(donation.grossAmount) / 100}`);
      console.log(`   - Net Amount: $${Number(donation.netAmount) / 100}\n`);
    }

    // Step 4: Verify data
    console.log('4️⃣  Verifying data...');
    const campaignCount = await prisma.campaign.count();
    const donationCount = await prisma.donation.count();
    const userCount = await prisma.user.count();

    console.log(`✅ Verification complete:`);
    console.log(`   - Total Users: ${userCount}`);
    console.log(`   - Total Campaigns: ${campaignCount}`);
    console.log(`   - Total Donations: ${donationCount}\n`);

    console.log('🎉 All tests passed! Campaign creation is working correctly!\n');
    console.log('🌐 You can now test the UI at: http://localhost:3001');
    console.log('   - Login with: test@rally.com / test123');
    console.log('   - Create a new campaign at: http://localhost:3001/create-campaign\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCampaignCreation()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
