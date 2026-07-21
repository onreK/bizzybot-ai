import crypto from 'crypto';
import { query } from '@/lib/database.js';
import { generateInstagramResponse } from '@/lib/ai-service.js';

export const dynamic = 'force-dynamic';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(payload, signature) {
  const secret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!secret || !signature) return true;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getConnectionByPageId(pageId) {
  try {
    const result = await query(`
      SELECT ic.user_id, ic.page_id, ic.access_token,
             COALESCE(acs.auto_respond_dms, true)      AS auto_respond_dms,
             COALESCE(acs.auto_respond_comments, false) AS auto_respond_comments
      FROM instagram_connections ic
      LEFT JOIN customers c ON c.clerk_user_id = ic.user_id
      LEFT JOIN ai_channel_settings acs
        ON acs.customer_id = c.id AND acs.channel = 'instagram'
      WHERE ic.page_id = $1 AND ic.status = 'connected'
      LIMIT 1
    `, [pageId]);
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

async function sendDM(recipientId, text, accessToken) {
  const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return;
  const res = await fetch('https://graph.facebook.com/v21.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    }),
  });
  if (!res.ok) console.error('❌ Instagram DM send error:', await res.json());
}

async function replyToComment(commentId, username, text, accessToken) {
  const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return;
  // Instagram replies must start with @username to be threaded correctly
  const message = username ? `@${username} ${text}` : text;
  const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) console.error('❌ Instagram comment reply error:', await res.json());
}

// ─── Webhook verification (GET) ───────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN || 'verify_bizzy_bot_ai';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Instagram webhook verified');
    return new Response(challenge, { status: 200 });
  }
  console.error('❌ Instagram webhook verification failed — token mismatch');
  return new Response('Forbidden', { status: 403 });
}

// ─── Webhook event handler (POST) ────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifySignature(body, signature)) {
      console.error('❌ Instagram webhook signature mismatch');
      return new Response('Unauthorized', { status: 401 });
    }

    const data = JSON.parse(body);
    if (data.object !== 'instagram') return new Response('OK', { status: 200 });

    for (const entry of data.entry || []) {
      const pageId = entry.id;
      const connection = await getConnectionByPageId(pageId);

      // Private DMs
      for (const event of entry.messaging || []) {
        if (event.message?.text && !event.message.is_echo) {
          if (connection?.auto_respond_dms !== false) {
            await handleDM(event, connection).catch(err =>
              console.error('❌ handleDM error:', err)
            );
          }
        }
      }

      // Post comments
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          if (connection?.auto_respond_comments) {
            await handleComment(change.value, pageId, connection).catch(err =>
              console.error('❌ handleComment error:', err)
            );
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('❌ Instagram webhook error:', error);
    return new Response('OK', { status: 200 }); // always 200 — Meta retries on non-200
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleDM(event, connection) {
  const senderId = event.sender.id;
  const pageId = event.recipient.id;
  const messageText = event.message.text;

  console.log('📸 Instagram DM from:', senderId, '→', messageText.substring(0, 80));

  const aiResult = await generateInstagramResponse(
    pageId,
    messageText,
    [],
    connection?.user_id || null
  );

  // Trial ended, no subscription → AI is off. Send nothing (never the
  // fallback line below, which would falsely promise a reply).
  if (aiResult?.trialExpired) {
    console.log('🚫 Instagram DM skipped — trial ended, AI is silent');
    return;
  }

  const reply = aiResult?.success
    ? aiResult.response
    : "Thanks for your message! We'll get back to you shortly.";

  await sendDM(senderId, reply, connection?.access_token);
  console.log('✅ Instagram DM reply sent');

  if (connection?.user_id) {
    await query(`
      CREATE TABLE IF NOT EXISTS instagram_messages (
        id SERIAL PRIMARY KEY, user_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'dm', sender_id VARCHAR(255),
        sender_username VARCHAR(255), message_text TEXT, ai_reply TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
    await query(
      `INSERT INTO instagram_messages (user_id, type, sender_id, message_text, ai_reply)
       VALUES ($1, 'dm', $2, $3, $4)`,
      [connection.user_id, senderId, messageText.substring(0, 500), reply.substring(0, 1000)]
    ).catch(() => {});

    // Real interaction + lead capture (email/phone typed into the DM)
    try {
      const custRes = await query(
        'SELECT id FROM customers WHERE clerk_user_id = $1 LIMIT 1',
        [connection.user_id]
      );
      if (custRes.rows[0]?.id) {
        const { captureInboundMessage } = await import('@/lib/leads-service.js');
        await captureInboundMessage(custRes.rows[0].id, {
          channel: 'instagram',
          text: messageText,
          metadata: { sender_id: senderId },
        });
      }
    } catch (err) {
      console.error('⚠️ Instagram lead capture failed:', err.message);
    }
  }
}

async function handleComment(value, pageId, connection) {
  const commentId = value.id;
  const messageText = value.text;
  const username = value.from?.username || '';
  const senderId = value.from?.id;

  // Don't reply to our own comments
  if (senderId === pageId) return;
  if (!messageText?.trim()) return;

  console.log('💬 Instagram comment from @', username, '→', messageText.substring(0, 80));

  const contextMessage = username
    ? `[Comment on Instagram post from @${username}]: ${messageText}`
    : messageText;

  const aiResult = await generateInstagramResponse(
    pageId,
    contextMessage,
    [],
    connection?.user_id || null
  );

  const reply = aiResult?.success ? aiResult.response : null;
  if (!reply) return;

  await replyToComment(commentId, username, reply, connection?.access_token);
  console.log('✅ Instagram comment reply sent');

  if (connection?.user_id) {
    await query(
      `INSERT INTO instagram_messages (user_id, type, sender_id, sender_username, message_text, ai_reply)
       VALUES ($1, 'comment', $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [connection.user_id, senderId, username, messageText.substring(0, 500), reply.substring(0, 1000)]
    ).catch(() => {});
  }
}
