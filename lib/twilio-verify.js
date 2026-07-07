import twilio from 'twilio';

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Verify that an incoming webhook actually came from Twilio by validating the
// X-Twilio-Signature header against our auth token. `url` must be the exact
// public URL Twilio was configured to call; `params` is the POSTed form fields
// as a plain object. Fails closed (rejects) if anything is missing or invalid.
export function isValidTwilioRequest(signature, url, params) {
  if (!AUTH_TOKEN) {
    console.error('⚠️ TWILIO_AUTH_TOKEN not set — rejecting Twilio webhook.');
    return false;
  }
  if (!signature) return false;
  try {
    return twilio.validateRequest(AUTH_TOKEN, signature, url, params);
  } catch (e) {
    console.error('⚠️ Twilio signature validation error:', e.message);
    return false;
  }
}
