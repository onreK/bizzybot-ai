// Public widget chat — the endpoint the embedded website widget talks to.
// No Clerk session (visitors are anonymous); the customer is resolved from
// the [subdomain] widget id and abuse is bounded by the customer's monthly
// usage limit inside the AI service.
import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { generateChatResponse } from '@/lib/ai-service.js';
import { trackLeadEvent } from '@/lib/leads-service.js';
import { sendHotLeadAlert } from '@/lib/owner-alerts.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Pull an email / US phone number out of a chat message so a visitor who
// types "call me at 555-123-4567" becomes a real contact
function extractContactInfo(text) {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] || null;
  const phone = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] || null;
  return { email, phone: phone ? phone.replace(/[^\d+]/g, '') : null };
}

export async function POST(request, { params }) {
  const { subdomain } = params;

  try {
    const body = await request.json();
    const { messages, sessionId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Resolve the customer that owns this widget
    const custResult = await query(
      `SELECT id, clerk_user_id, business_name FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [subdomain]
    );
    const customer = custResult.rows[0];
    if (!customer) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const userMessage = [...messages].reverse().find(m => m.from === 'user' || m.role === 'user');
    const userText = (userMessage?.text || userMessage?.content || '').trim();
    if (!userText) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const conversationHistory = messages.map(m => ({
      role: m.from === 'bot' || m.role === 'assistant' ? 'assistant' : 'user',
      content: m.text || m.content || '',
      sender_type: m.from === 'bot' || m.role === 'assistant' ? 'assistant' : 'user',
    }));

    const aiResult = await generateChatResponse(
      customer.clerk_user_id,
      userText,
      conversationHistory
    );

    // Trial ended, no subscription → AI is off. Return a silenced flag with no
    // reply text; the widget client renders nothing (never the "having trouble"
    // fallback below, which would falsely imply a reply is coming).
    if (aiResult.trialExpired) {
      return NextResponse.json({ silenced: true }, { headers: CORS_HEADERS });
    }

    const responseText = aiResult.success
      ? aiResult.response
      : "I'm sorry, I'm having trouble right now. Please try again in a moment.";

    // Persist to the shared conversations/messages tables so the dashboard's
    // Web Chat list shows real widget conversations (one per visitor session,
    // keyed via the contact_phone column like persistSmsExchange does)
    try {
      const sessKey = 'widget:' + (sessionId || 'anon');
      let convId;
      const existing = await query(
        `SELECT id FROM conversations WHERE user_id = $1 AND type = 'chat' AND contact_phone = $2 LIMIT 1`,
        [customer.clerk_user_id, sessKey]
      );
      if (existing.rows.length > 0) {
        convId = existing.rows[0].id;
      } else {
        // conversation_key + source are NOT NULL legacy columns; messages
        // require user_id and have no metadata column (same schema traps as
        // the SMS webhook had)
        const created = await query(
          `INSERT INTO conversations (user_id, type, status, contact_phone, conversation_key, source)
           VALUES ($1, 'chat', 'active', $2, $3, 'chat') RETURNING id`,
          [customer.clerk_user_id, sessKey, `chat_${customer.clerk_user_id}_${sessKey}`]
        );
        convId = created.rows[0]?.id;
      }
      if (convId) {
        await query(
          `INSERT INTO messages (conversation_id, user_id, sender_type, content, direction)
           VALUES ($1, $2, 'user', $3, 'inbound')`,
          [convId, customer.clerk_user_id, userText]
        );
        await query(
          `INSERT INTO messages (conversation_id, user_id, sender_type, content, direction, hot_lead_score)
           VALUES ($1, $2, 'assistant', $3, 'outbound', $4)`,
          [convId, customer.clerk_user_id, responseText, aiResult.hotLead?.score || 0]
        );
      }
    } catch (persistErr) {
      console.error('⚠️ Widget conversation persist failed:', persistErr.message);
    }

    // Record the real inbound interaction (feeds Analytics/Overview)
    await query(`
      INSERT INTO ai_analytics_events
      (customer_id, event_type, metadata, user_message, channel, confidence_score, created_at)
      VALUES ($1, 'message_received', $2, $3, 'chat', 1.0, CURRENT_TIMESTAMP)
    `, [
      customer.id,
      JSON.stringify({ source: 'widget' }),
      userText.substring(0, 1000),
    ]).catch(err => console.error('⚠️ Widget event insert failed:', err.message));

    // If the visitor shared an email or phone, they become a contact/lead
    const { email, phone } = extractContactInfo(userText);
    if (email || phone) {
      await trackLeadEvent(customer.id, {
        type: 'contact_captured',
        channel: 'chat',
        email,
        phone,
        message: userText.substring(0, 500),
      }).catch(err => console.error('⚠️ Widget lead capture failed:', err.message));
    }

    // Hot lead → alert the owner, same as SMS/voice; and if we know who they
    // are, promote the contact (hot_lead event → notification bell + feeds)
    if (aiResult.hotLead?.isHotLead) {
      if (email || phone) {
        await trackLeadEvent(customer.id, {
          type: 'hot_lead',
          channel: 'chat',
          email,
          phone,
          message: userText.substring(0, 500),
        }).catch(() => {});
      }
      await sendHotLeadAlert(customer.clerk_user_id, {
        contactEmail: email,
        contactPhone: phone,
        channel: 'chat',
        message: userText,
        score: aiResult.hotLead.score || 80,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        response: responseText,
        isHotLead: aiResult.hotLead?.isHotLead || false,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('❌ Widget chat error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate response',
        response: "I'm sorry, I'm having trouble right now. Please try again in a moment.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
