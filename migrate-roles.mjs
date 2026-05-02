import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateRoles() {
  try {
    console.log('Migrating user roles...');

    // Update TEAM_MEMBER to PLAYER
    const teamMemberUpdate = await prisma.$executeRaw`
      UPDATE "User"
      SET role = 'PLAYER'::"UserRole"
      WHERE role = 'TEAM_MEMBER'::"UserRole"
    `;
    console.log(`Updated ${teamMemberUpdate} users from TEAM_MEMBER to PLAYER`);

    // Update GUARDIAN to CAMPAIGN_LEADER (if any)
    const guardianUpdate = await prisma.$executeRaw`
      UPDATE "User"
      SET role = 'CAMPAIGN_LEADER'::"UserRole"
      WHERE role = 'GUARDIAN'::"UserRole"
    `;
    console.log(`Updated ${guardianUpdate} users from GUARDIAN to CAMPAIGN_LEADER`);

    console.log('Role migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRoles();
