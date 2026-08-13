#!/usr/bin/env node
import Stripe from 'stripe';

// Read from the environment — never hardcode. This file is committed, and a
// literal key here is a published key.
//   STRIPE_SECRET_KEY=sk_test_... node scripts/quick-stripe-test.mjs
// or, to use the value already in .env:
//   node --env-file=.env scripts/quick-stripe-test.mjs
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error(
    'STRIPE_SECRET_KEY is not set.\n' +
      '  STRIPE_SECRET_KEY=sk_test_... node scripts/quick-stripe-test.mjs\n' +
      '  (or: node --env-file=.env scripts/quick-stripe-test.mjs)'
  );
  process.exit(1);
}

console.log('🔧 Quick Stripe Test\n');

try {
  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
  });

  console.log('1️⃣  Testing API Connection...');
  const account = await stripe.accounts.retrieve();
  console.log('   ✅ Connected! Account ID:', account.id);

  console.log('\n2️⃣  Creating Test Payment Intent...');
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 5000,
    currency: 'usd',
    metadata: { test: 'Rally test' },
  });
  console.log('   ✅ Created! ID:', paymentIntent.id);
  console.log('   Amount: $' + (paymentIntent.amount / 100).toFixed(2));

  console.log('\n🎉 Stripe is configured correctly!\n');
  console.log('✨ You can now accept payments!');
  console.log('\n📝 Test cards:');
  console.log('   Success: 4242 4242 4242 4242');
  console.log('   Decline: 4000 0000 0000 0002');
  console.log('   3D Secure: 4000 0027 6000 3184');

} catch (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}
