import crypto from 'crypto';
import { query } from '@/lib/database.js';
import { generateFacebookResponse } from '@/lib/ai-service.js';

export const dynamic = 'force-dynamic';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(payload, signature) {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret || !signature) return true; // skip in dev if secret not set
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
      SELECT fc.user_id, fc.page_id, fc.page_access_token,
             COALESCE(acs.auto_respond_comments, false) AS auto_respond_comments
      FROM facebook_connections fc
      LEFT JOIN customers c ON c.clerk_user_id = fc.user_id
      LEFT JOIN ai_channel_settings acs
        ON acs.customer_id = c.id AND acs.channel = 'facebook'
      WHERE fc.page_id = $1 AND fc.status = 'connected'
      LIMIT 1
    `, [pageId]);
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

async function sendDM(recipientId, text, accessToken) {
  const token = accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
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
  if (!res.ok) console.error('❌ Facebook DM send error:', await res.json());
}

async function replyToComment(commentId, text, accessToken) {
  const token = accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) return;
  const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: text }),
  });
  if (!res.ok) console.error('❌ Facebook comment reply error:', await res.json());
}

// ─── Webhook verification (GET) ───────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log('✅ Facebook webhook verified');
    return new Response(challenge, { status: 200 });
  }
  console.error('❌ Facebook webhook verification failed — token mismatch');
  return new Response('Forbidden', { status: 403 });
}

// ─── Webhook event handler (POST) ────────────────────────────────────────────

export async function POST(request) {
  let body;
  try {
    body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifySignature(body, signature)) {
      console.error('❌ Facebook webhook signature mismatch');
      return new Response('Unauthorized', { status: 401 });
    }

    const data = JSON.parse(body);
    if (data.object !== 'page') return new Response('OK', { status: 200 });

    for (const entry of data.entry || []) {
      const pageId = entry.id;
      const connection = await getConnectionByPageId(pageId);

      // Private Messenger DMs
      for (const event of entry.messaging || []) {
        if (event.message?.text && !event.message.is_echo) {
          await handleDM(event, connection).catch(err =>
            console.error('❌ handleDM error:', err)
          );
        }
      }

      // Page post comments (field = 'feed')
      for (const change of entry.changes || []) {
        if (
          change.field === 'feed' &&
          change.value?.item === 'comment' &&
          !change.value?.parent_id // skip replies-to-comments to avoid chains
        ) {
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
    console.error('❌ Facebook webhook error:', error);
    return new Response('OK', { status: 200 }); // always 200 — Meta retries on non-200
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleDM(event, connection) {
  const senderId = event.sender.id;
  const pageId = event.recipient.id;
  const messageText = event.message.text;

  console.log('📨 Facebook DM from:', senderId, '→', messageText.substring(0, 80));

  const aiResult = await generateFacebookResponse(
    pageId,
    messageText,
    [],
    connection?.user_id || null
  );

  const reply = aiResult?.success
    ? aiResult.response
    : "Thanks for your message! We'll get back to you shortly.";

  await sendDM(senderId, reply, connection?.page_access_token);
  console.log('✅ Facebook DM reply sent');

  if (connection?.user_id) {
    await query(`
      CREATE TABLE IF NOT EXISTS facebook_messages (
        id SERIAL PRIMARY KEY, user_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'dm', sender_id VARCHAR(255),
        sender_name VARCHAR(255), message_text TEXT, ai_reply TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
    await query(
      `INSERT INTO facebook_messages (user_id, type, sender_id, message_text, ai_reply)
       VALUES ($1, 'dm', $2, $3, $4)`,
      [connection.user_id, senderId, messageText.substring(0, 500), reply.substring(0, 1000)]
    ).catch(() => {});
  }
}

async function handleComment(value, pageId, connection) {
  const commentId = value.comment_id;
  const senderName = value.sender_name || '';
  const messageText = value.message;

  // Don't reply to the page's own comments
  if (value.sender_id === pageId) return;
  if (!messageText?.trim()) return;

  console.log('💬 Facebook comment from:', senderName, '→', messageText.substring(0, 80));

  const contextMessage = senderName
    ? `[Comment on Facebook post from "${senderName}"]: ${messageText}`
    : messageText;

  const aiResult = await generateFacebookResponse(
    pageId,
    contextMessage,
    [],
    connection?.user_id || null
  );

  const reply = aiResult?.success ? aiResult.response : null;
  if (!reply) return;

  await replyToComment(commentId, reply, connection?.page_access_token);
  console.log('✅ Facebook comment reply sent');

  if (connection?.user_id) {
    await query(
      `INSERT INTO facebook_messages (user_id, type, sender_name, message_text, ai_reply)
       VALUES ($1, 'comment', $2, $3, $4)`,
      [connection.user_id, senderName, messageText.substring(0, 500), reply.substring(0, 1000)]
    ).catch(() => {});
  }
}
