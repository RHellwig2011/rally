#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const campaigns = await prisma.campaign.findMany({
    take: 5,
    select: {
      id: true,
      slug: true,
      teamName: true,
      organizationName: true,
      status: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (campaigns.length === 0) {
    console.log('No campaigns found. You need to create one first!');
  } else {
    console.log('Available campaigns:');
    console.log('─'.repeat(60));
    campaigns.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.teamName} - ${c.organizationName}`);
      console.log(`   Slug: ${c.slug}`);
      console.log(`   URL: http://localhost:3000/raise/${c.slug}`);
      console.log(`   Status: ${c.status}`);
    });
  }
} catch (error) {
  console.log('Error:', error.message);
} finally {
  await prisma.$disconnect();
}
