/**
 * Test script for Twilio SMS
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables (override any existing ones)
dotenv.config({ override: true });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;
const toPhone = '+19089639449';

console.log('🧪 Testing Twilio SMS...\n');
console.log('From:', fromPhone);
console.log('To:', toPhone);
console.log('Account SID:', accountSid?.substring(0, 10) + '...');
console.log('');

if (!accountSid || !authToken || !fromPhone) {
  console.error('❌ Missing Twilio credentials in .env file');
  process.exit(1);
}

try {
  const client = twilio(accountSid, authToken);

  const message = await client.messages.create({
    from: fromPhone,
    to: toPhone,
    body: 'Hello from Rally! 🏈 This is a test message from your Twilio integration. Everything is working!'
  });

  console.log('✅ SMS sent successfully!');
  console.log('Message SID:', message.sid);
  console.log('Status:', message.status);
  console.log('\nCheck your phone for the message!');
} catch (error) {
  console.error('❌ Failed to send SMS:');
  console.error(error.message);
  if (error.code) {
    console.error('Error code:', error.code);
  }
  process.exit(1);
}
