#!/usr/bin/env node
/**
 * Bootstrap the first BANK_ADMIN on a fresh deployment.
 *
 * Why this exists
 * ---------------
 * There is a deliberate chicken-and-egg in the role model:
 *   - Public signup can only create CAMPAIGN_LEADER / GUARDIAN / DONOR
 *     (app/api/auth/signup/route.ts), and /api/auth/register always creates a
 *     DONOR. Neither can mint an admin — that is intentional, and is what stops
 *     a stranger from registering themselves as an administrator.
 *   - Changing a role requires an existing BANK_ADMIN
 *     (app/api/admin/users/[userId]/role/route.ts).
 *
 * On a fresh production database no BANK_ADMIN exists, so nothing can ever
 * grant that role through the app. Disbursement approval and Stripe payouts are
 * BANK_ADMIN-gated, which means without this script a deployed instance can
 * take donations but can never pay a team.
 *
 * This script is the out-of-band escape hatch: it runs against the database
 * directly, with credentials only an operator has.
 *
 * Usage
 * -----
 *   DATABASE_URL="postgresql://..." node scripts/bootstrap-admin.mjs <email>
 *
 * The user must already exist — sign up through the UI first, then promote.
 * That way the password is set through the normal hashing path and this script
 * never handles a credential.
 *
 * Safety
 * ------
 *   - Refuses to run if any BANK_ADMIN already exists, unless --force is given.
 *     Bootstrapping is a one-time act; a second run usually means a mistake.
 *   - Only ever promotes an existing user. It cannot create one.
 *   - Prints the before/after role so the change is auditable in your shell
 *     history.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const email = args.find((a) => !a.startsWith("--"));

  if (!email) {
    fail(
      "Usage: DATABASE_URL=... node scripts/bootstrap-admin.mjs <email> [--force]"
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is not set. Point it at the target database.");
    return;
  }

  // Guard: bootstrapping is a one-time operation.
  const existing = await prisma.user.findMany({
    where: { role: "BANK_ADMIN" },
    select: { email: true },
  });

  if (existing.length > 0 && !force) {
    fail(
      `A BANK_ADMIN already exists (${existing
        .map((u) => u.email)
        .join(", ")}).\n` +
        `    Promote further admins through the app UI, which keeps an audit trail.\n` +
        `    Re-run with --force only if you are certain.`
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, firstName: true, lastName: true },
  });

  if (!user) {
    fail(
      `No user with email "${email}".\n` +
        `    Sign up through the app first, then re-run this to promote that account.`
    );
    return;
  }

  if (user.role === "BANK_ADMIN") {
    console.log(`\n  • ${user.email} is already BANK_ADMIN — nothing to do.\n`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "BANK_ADMIN" },
    select: { email: true, role: true },
  });

  console.log(
    `\n  ✓ ${updated.email}: ${user.role} → ${updated.role}\n` +
      `    Sign out and back in — the role is carried in the session token.\n`
  );
}

main()
  .catch((err) => {
    fail(err?.message ?? String(err));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
