/**
 * Check SMS delivery status
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messageSid = 'SM22416b183ae855bd0c44df1d6f8d4246';

console.log('🔍 Checking message status...\n');

try {
  const client = twilio(accountSid, authToken);

  const message = await client.messages(messageSid).fetch();

  console.log('Message SID:', message.sid);
  console.log('Status:', message.status);
  console.log('Error Code:', message.errorCode || 'None');
  console.log('Error Message:', message.errorMessage || 'None');
  console.log('From:', message.from);
  console.log('To:', message.to);
  console.log('Date Sent:', message.dateSent);
  console.log('Price:', message.price || 'Pending');

  if (message.errorCode) {
    console.log('\n❌ Message failed to send');
    console.log('See error details above');
  } else if (message.status === 'delivered') {
    console.log('\n✅ Message was delivered successfully');
  } else {
    console.log('\n⏳ Message status:', message.status);
  }
} catch (error) {
  console.error('❌ Error checking status:', error.message);
}
