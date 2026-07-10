import twilio from 'twilio';
import { query } from './database.js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Capture Vapi's inbound handler URL, then take over the number's Voice URL so
// we can ring the owner first. Only takes over if we know where the AI lives,
// so a failure never breaks AI answering. Idempotent.
export async function ensureVoiceRouting(twilioSid, phoneRowId, existingVapiUrl) {
  if (!twilioClient || !twilioSid) return;
  try {
    const incomingUrl = `${BASE_URL}/api/voice/incoming`;
    const current = await twilioClient.incomingPhoneNumbers(twilioSid).fetch();
    const currentUrl = current.voiceUrl || '';
    let vapiUrl = existingVapiUrl;
    if (!vapiUrl && currentUrl && !currentUrl.includes('/api/voice/incoming')) {
      vapiUrl = currentUrl;
      await query(`UPDATE customer_phone_numbers SET vapi_voice_url = $1 WHERE id = $2`, [vapiUrl, phoneRowId]).catch(() => {});
    }
    if (vapiUrl && currentUrl !== incomingUrl) {
      await twilioClient.incomingPhoneNumbers(twilioSid).update({ voiceUrl: incomingUrl, voiceMethod: 'POST' });
      console.log(`📞 Voice routing set to BizzyBot for ${twilioSid}`);
    }

    // Vapi's number import also overwrites the SMS webhook (pointing texts at
    // api.vapi.ai/twilio/sms, which silently swallows them). Always reclaim it.
    const smsUrl = `${BASE_URL}/api/sms/webhook`;
    if ((current.smsUrl || '') !== smsUrl) {
      await twilioClient.incomingPhoneNumbers(twilioSid).update({ smsUrl, smsMethod: 'POST' });
      console.log(`💬 SMS routing reclaimed from Vapi for ${twilioSid}`);
    }
  } catch (e) {
    console.error('⚠️ ensureVoiceRouting failed:', e.message);
  }
}
