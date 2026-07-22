#!/usr/bin/env node

/**
 * Seed script to create test data for Campaign Dashboard
 * This will create a test campaign with team members and donations
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a test coach user
  const hashedPassword = await bcrypt.hash('password123', 10);

  const coach = await prisma.user.upsert({
    where: { email: 'coach@example.com' },
    update: {},
    create: {
      email: 'coach@example.com',
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Coach',
      phone: '+1234567890',
      role: 'CAMPAIGN_LEADER',
      emailVerified: true,
    }
  });

  console.log('✅ Created coach user:', coach.email);

  // Create a test admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      firstName: 'Ada',
      lastName: 'Admin',
      role: 'ADMIN',
      emailVerified: true,
    }
  });

  console.log('✅ Created admin user:', admin.email);

  // Create a test campaign
  const campaign = await prisma.campaign.upsert({
    where: { slug: 'test-basketball-2024' },
    update: {},
    create: {
      id: 'test-campaign-001',
      organizationName: 'Lincoln High School',
      teamName: 'Varsity Basketball',
      slug: 'test-basketball-2024',
      description: 'Help us raise funds for new equipment and travel expenses for the 2024 season!',
      category: 'SPORTS',
      goalAmount: BigInt(10000 * 100), // $10,000 in cents
      currentAmount: BigInt(0),
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      primaryLeaderId: coach.id,
      primaryColor: '#1e40af',
      secondaryColor: '#dbeafe',
      status: 'ACTIVE',
    }
  });

  console.log('✅ Created campaign:', campaign.slug);

  // Create banking account for the campaign
  const bankingAccount = await prisma.bankingAccount.upsert({
    where: { campaignId: campaign.id },
    update: {},
    create: {
      campaignId: campaign.id,
      payoutAccountType: 'BANK_ACCOUNT',
      payoutAccountLast4: '6789',
      payoutAccountVerified: true,
      availableBalance: BigInt(0),
      totalRaised: BigInt(0),
      platformFeesCollected: BigInt(0),
      disbursedTotal: BigInt(0),
      pendingDisbursement: BigInt(0),
    }
  });

  console.log('✅ Created banking account');

  // Create team members
  const teamMembers = [
    { name: 'Sarah Johnson', email: 'sarah@example.com', position: 'Point Guard', grade: '12', personalGoal: 500 },
    { name: 'Mike Thompson', email: 'mike@example.com', position: 'Center', grade: '11', personalGoal: 750 },
    { name: 'Emily Chen', email: 'emily@example.com', position: 'Forward', grade: '10', personalGoal: 500 },
    { name: 'David Martinez', email: 'david@example.com', position: 'Shooting Guard', grade: '12', personalGoal: 1000 },
    { name: 'Jessica Lee', email: 'jessica@example.com', position: 'Power Forward', grade: '11', personalGoal: 600 },
  ];

  const createdMembers = [];
  for (const member of teamMembers) {
    const teamMember = await prisma.teamMember.create({
      data: {
        campaign: { connect: { id: campaign.id } },
        name: member.name,
        email: member.email,
        position: member.position,
        grade: member.grade,
        personalGoal: member.personalGoal ? BigInt(member.personalGoal * 100) : null,
        fundLinkCode: `${member.name.split(' ')[0].toLowerCase()}${Math.random().toString(36).substring(2, 8)}`,
        invitationStatus: 'ACCEPTED',
        joinedAt: new Date(),
        amountRaised: BigInt(0),
      }
    });
    createdMembers.push(teamMember);
  }

  console.log(`✅ Created ${createdMembers.length} team members`);

  // Create donations
  const donors = [
    { name: 'Robert Smith', email: 'robert@donor.com', amount: 100 },
    { name: 'Linda Johnson', email: 'linda@donor.com', amount: 50 },
    { name: 'James Wilson', email: 'james@donor.com', amount: 250 },
    { name: 'Patricia Brown', email: 'patricia@donor.com', amount: 75 },
    { name: 'Michael Davis', email: 'michael@donor.com', amount: 200 },
    { name: 'Anonymous', email: 'anon1@donor.com', amount: 500, isAnonymous: true },
    { name: 'Jennifer Taylor', email: 'jennifer@donor.com', amount: 150 },
    { name: 'William Anderson', email: 'william@donor.com', amount: 100 },
    { name: 'Barbara Thomas', email: 'barbara@donor.com', amount: 80 },
    { name: 'Anonymous', email: 'anon2@donor.com', amount: 300, isAnonymous: true },
  ];

  let totalRaised = BigInt(0);
  const donations = [];

  for (let i = 0; i < donors.length; i++) {
    const donor = donors[i];
    const teamMember = createdMembers[i % createdMembers.length]; // Distribute donations among team members

    const grossAmountCents = donor.amount * 100;
    const grossAmount = BigInt(grossAmountCents);
    const platformFee = grossAmount * BigInt(10) / BigInt(100); // 10% platform fee
    const processingFee = BigInt(Math.round(grossAmountCents * 0.029) + 30); // Stripe: 2.9% + $0.30
    const netAmount = grossAmount - platformFee - processingFee;

    const donation = await prisma.donation.create({
      data: {
        campaign: { connect: { id: campaign.id } },
        teamMember: { connect: { id: teamMember.id } },
        donorName: donor.name,
        donorEmail: donor.email,
        grossAmount,
        netAmount,
        platformFee,
        processingFee,
        donorMessage: `Go ${teamMember.name.split(' ')[0]}! Good luck this season!`,
        isAnonymous: donor.isAnonymous || false,
        status: 'COMPLETED',
        paymentProvider: 'SIMULATED',
        paymentIntentId: `pi_test_${Math.random().toString(36).substring(2, 15)}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
      }
    });

    donations.push(donation);
    totalRaised += grossAmount;

    // Update team member's amount raised
    await prisma.teamMember.update({
      where: { id: teamMember.id },
      data: {
        amountRaised: {
          increment: grossAmount
        }
      }
    });
  }

  console.log(`✅ Created ${donations.length} donations`);

  // Update campaign totals
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      currentAmount: totalRaised
    }
  });

  // Update banking account
  await prisma.bankingAccount.update({
    where: { campaignId: campaign.id },
    data: {
      totalRaised,
      availableBalance: totalRaised * BigInt(90) / BigInt(100), // 90% after platform fees
      platformFeesCollected: totalRaised * BigInt(10) / BigInt(100), // 10% platform fees
    }
  });

  console.log(`✅ Updated campaign totals: $${Number(totalRaised) / 100}`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('📊 Summary:');
  console.log(`   Campaign ID: ${campaign.id}`);
  console.log(`   Campaign Slug: ${campaign.slug}`);
  console.log(`   Total Raised: $${Number(totalRaised) / 100}`);
  console.log(`   Team Members: ${createdMembers.length}`);
  console.log(`   Donations: ${donations.length}`);
  console.log('\n💡 You can now test the dashboard at:');
  console.log(`   http://localhost:3000/dashboard/${campaign.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });