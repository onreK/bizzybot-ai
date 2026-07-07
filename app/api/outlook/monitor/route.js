import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database.js';
import { generateAIResponse } from '@/lib/ai-service.js';
import { checkEmailFilter } from '@/lib/email-filtering.js';
import { createOrUpdateContact, trackLeadEvent, updateLeadScoring } from '@/lib/leads-service.js';
import { sendHotLeadAlert } from '@/lib/owner-alerts.js';

export const dynamic = 'force-dynamic';

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS outlook_conversations (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      clerk_user_id TEXT,
      outlook_email TEXT,
      contact_email TEXT,
      contact_name TEXT,
      subject TEXT,
      conversation_id TEXT,
      status TEXT DEFAULT 'active',
      last_message_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS outlook_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES outlook_conversations(id) ON DELETE CASCADE,
      outlook_message_id TEXT UNIQUE,
      direction TEXT,
      content TEXT,
      ai_response TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
}

async function refreshTokenIfNeeded(conn) {
  if (conn.token_expiry && Date.now() < conn.token_expiry - 300000) {
    return conn.access_token;
  }
  if (!conn.refresh_token) return conn.access_token;

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) return conn.access_token;

  const newExpiry = Date.now() + tokens.expires_in * 1000;
  await query(
    `UPDATE outlook_connections SET access_token = $1, token_expiry = $2, updated_at = NOW()
     WHERE outlook_email = $3`,
    [tokens.access_token, newExpiry, conn.outlook_email]
  ).catch(() => {});

  return tokens.access_token;
}

async function graphGet(accessToken, path) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph GET ${path} failed: ${res.status}`);
  return res.json();
}

async function sendReply(accessToken, messageId, replyText) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/reply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: replyText }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph reply failed: ${res.status} ${err}`);
  }
}

async function markAsRead(accessToken, messageId) {
  await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isRead: true }),
  }).catch(() => {});
}

async function alreadyProcessed(messageId) {
  const result = await query(
    `SELECT id FROM outlook_messages WHERE outlook_message_id = $1 LIMIT 1`,
    [messageId]
  ).catch(() => ({ rows: [] }));
  return result.rows.length > 0;
}

async function processAccount(conn) {
  const diag = {
    processed: 0, fetched: 0, customerFound: false,
    connectedEmail: conn.outlook_email,
    skippedSelf: 0, skippedProcessed: 0, skippedAutomated: 0,
    senders: [],
  };

  const accessToken = await refreshTokenIfNeeded(conn);

  // Fetch unread messages from the last 3 hours
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const filter = `isRead eq false and receivedDateTime ge ${since}`;
  const select = 'id,subject,from,body,receivedDateTime,conversationId,toRecipients';
  const path = `/me/messages?$filter=${encodeURIComponent(filter)}&$top=20&$orderby=receivedDateTime desc&$select=${select}`;

  const data = await graphGet(accessToken, path);
  const messages = data.value || [];
  diag.fetched = messages.length;

  // Get customer info
  const customerResult = await query(
    `SELECT c.id, c.clerk_user_id, c.business_name
     FROM outlook_connections oc
     JOIN customers c ON c.clerk_user_id::text = oc.user_id::text
     WHERE oc.outlook_email = $1 LIMIT 1`,
    [conn.outlook_email]
  ).catch(() => ({ rows: [] }));

  const customer = customerResult.rows[0];
  if (!customer) return diag;
  diag.customerFound = true;

  for (const msg of messages) {
    try {
      const fromEmail = msg.from?.emailAddress?.address || '';
      const fromName = msg.from?.emailAddress?.name || '';
      diag.senders.push(fromEmail);

      if (await alreadyProcessed(msg.id)) { diag.skippedProcessed++; continue; }

      // Skip emails sent to yourself (own replies)
      if (fromEmail.toLowerCase() === conn.outlook_email.toLowerCase()) { diag.skippedSelf++; continue; }

      // Filter out automated senders
      const bodyText = msg.body?.content?.replace(/<[^>]*>/g, ' ').trim() || '';
      const filterResult = await checkEmailFilter(fromEmail, msg.subject || '', bodyText);
      if (filterResult?.skip) {
        console.log(`⏭️ Outlook skipping automated email from ${fromEmail}`);
        diag.skippedAutomated++;
        continue;
      }

      // Get/build conversation history for this thread
      const threadMessages = await query(
        `SELECT content, ai_response FROM outlook_messages om
         JOIN outlook_conversations oc ON oc.id = om.conversation_id
         WHERE oc.conversation_id = $1 AND oc.clerk_user_id = $2
         ORDER BY om.sent_at ASC LIMIT 10`,
        [msg.conversationId, customer.clerk_user_id]
      ).catch(() => ({ rows: [] }));

      const history = threadMessages.rows.flatMap(r => [
        { role: 'user', content: r.content },
        { role: 'assistant', content: r.ai_response },
      ]).filter(m => m.content);

      // Generate AI reply
      const aiResult = await generateAIResponse({
        userMessage: bodyText,
        channel: 'email',
        clerkUserId: customer.clerk_user_id,
        contactEmail: fromEmail,
        conversationHistory: history,
      });

      if (!aiResult?.success || !aiResult?.response) {
        diag.skippedNoAi = (diag.skippedNoAi || 0) + 1;
        diag.aiInfo = {
          success: aiResult?.success ?? null,
          hasResponse: !!aiResult?.response,
          error: aiResult?.error || aiResult?.metadata?.error || null,
        };
        continue;
      }

      // Send reply
      await sendReply(accessToken, msg.id, aiResult.response);
      await markAsRead(accessToken, msg.id);

      // Save conversation + message
      await ensureTables();
      let convResult = await query(
        `SELECT id FROM outlook_conversations
         WHERE clerk_user_id = $1 AND conversation_id = $2 LIMIT 1`,
        [customer.clerk_user_id, msg.conversationId]
      ).catch(() => ({ rows: [] }));

      let convId;
      if (convResult.rows.length > 0) {
        convId = convResult.rows[0].id;
        await query(
          `UPDATE outlook_conversations SET last_message_at = NOW() WHERE id = $1`,
          [convId]
        ).catch(() => {});
      } else {
        const ins = await query(
          `INSERT INTO outlook_conversations
             (customer_id, clerk_user_id, outlook_email, contact_email, contact_name, subject, conversation_id, last_message_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [customer.id, customer.clerk_user_id, conn.outlook_email, fromEmail, fromName, msg.subject, msg.conversationId]
        ).catch(() => ({ rows: [] }));
        convId = ins.rows[0]?.id;
      }

      if (convId) {
        await query(
          `INSERT INTO outlook_messages (conversation_id, outlook_message_id, direction, content, ai_response, sent_at)
           VALUES ($1, $2, 'inbound', $3, $4, NOW())
           ON CONFLICT (outlook_message_id) DO NOTHING`,
          [convId, msg.id, bodyText.slice(0, 5000), aiResult.response]
        ).catch(() => {});
      }

      // Track lead
      await createOrUpdateContact(customer.id, {
        email: fromEmail,
        name: fromName,
        source_channel: 'outlook',
      }).catch(() => {});

      await trackLeadEvent(customer.id, {
        type: 'message_received',
        channel: 'outlook',
        email: fromEmail,
        name: fromName,
        message: bodyText,
      }).catch(() => {});

      if (aiResult.hotLead?.isHotLead) {
        await updateLeadScoring({
          clerkUserId: customer.clerk_user_id,
          customerId: customer.id,
          contactEmail: fromEmail,
          score: aiResult.hotLead.score || 80,
          temperature: 'hot',
        }).catch(() => {});
        await sendHotLeadAlert(customer.clerk_user_id, {
          contactName: fromName,
          contactEmail: fromEmail,
          channel: 'outlook',
          message: bodyText,
          score: aiResult.hotLead.score || 80,
        });
      }

      diag.processed++;
      console.log(`✅ Outlook replied to ${fromEmail} for ${customer.clerk_user_id}`);

    } catch (err) {
      diag.errors = diag.errors || [];
      diag.errors.push(err.message);
      console.error(`❌ Outlook message error (${msg.id}):`, err.message);
    }
  }

  await query(
    `UPDATE outlook_connections SET last_checked = NOW() WHERE outlook_email = $1`,
    [conn.outlook_email]
  ).catch(() => {});

  return diag;
}

export async function POST(request) {
  try {
    // Two callers: the hourly cron (bearer CRON_SECRET, processes a named
    // account) or a logged-in user clicking "check now" (processes their own).
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let connectionRow;
    if (isCron) {
      const { emailAddress } = await request.json().catch(() => ({}));
      const result = await query(
        `SELECT * FROM outlook_connections WHERE outlook_email = $1 AND status = 'connected' LIMIT 1`,
        [emailAddress]
      );
      connectionRow = result.rows[0];
    } else {
      const { userId } = auth();
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const result = await query(
        `SELECT * FROM outlook_connections WHERE user_id = $1 AND status = 'connected'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      connectionRow = result.rows[0];
    }

    if (!connectionRow) {
      return NextResponse.json({ success: false, error: 'No connected Outlook account found' }, { status: 404 });
    }

    const diag = await processAccount(connectionRow);
    return NextResponse.json({ success: true, totalProcessed: diag.processed, diagnostics: diag });

  } catch (error) {
    console.error('❌ Outlook monitor error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
