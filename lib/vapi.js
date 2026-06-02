const VAPI_BASE = 'https://api.vapi.ai';

async function vapiRequest(method, path, body) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vapi ${method} ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

export function buildVoiceSystemPrompt(s) {
  const parts = [
    `You are a helpful AI voice assistant for ${s.business_name || 'this business'}.`,
  ];
  if (s.business_description) parts.push(`About the business: ${s.business_description}`);
  if (s.knowledge_base) parts.push(`Business knowledge:\n${s.knowledge_base}`);
  if (s.custom_instructions) parts.push(`Instructions: ${s.custom_instructions}`);
  parts.push('Keep responses concise and conversational — this is a phone call. Be warm and helpful. Do not read out long lists. If you need to transfer or escalate, say so clearly.');
  if (s.response_tone) parts.push(`Tone: ${s.response_tone}`);
  return parts.join('\n\n');
}

export async function createAssistant({ businessName, systemPrompt, firstMessage }) {
  return vapiRequest('POST', '/assistant', {
    name: `${businessName} AI Voice Agent`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt,
    },
    voice: {
      provider: '11labs',
      voiceId: 'rachel',
    },
    firstMessage: firstMessage || `Hi there! Thanks for calling ${businessName}. How can I help you today?`,
    endCallFunctionEnabled: true,
    recordingEnabled: true,
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
    },
    serverUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/vapi/webhook`,
  });
}

export async function updateAssistant(assistantId, { businessName, systemPrompt, firstMessage }) {
  return vapiRequest('PATCH', `/assistant/${assistantId}`, {
    name: `${businessName} AI Voice Agent`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt,
    },
    firstMessage: firstMessage || `Hi there! Thanks for calling ${businessName}. How can I help you today?`,
  });
}

export async function registerTwilioNumber(phoneNumber, assistantId) {
  return vapiRequest('POST', '/phone-number', {
    provider: 'twilio',
    number: phoneNumber,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    assistantId,
    name: `BizzyBot ${phoneNumber}`,
  });
}

export async function getCalls({ assistantId, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (assistantId) params.set('assistantId', assistantId);
  return vapiRequest('GET', `/call?${params.toString()}`);
}
