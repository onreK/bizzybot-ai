// app/api/sms/webhook/route.js - UPDATED TO USE CENTRALIZED AI SERVICE
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { generateSMSResponse } from '../../../../lib/ai-service.js';
import { query } from '../../../../lib/database.js';
import { sendHotLeadAlert } from '../../../../lib/owner-alerts.js';

// Initialize Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// In-memory storage for conversations and customer configs
// (kept for same-instance reply context; the DB below is the source of truth)
const conversations = new Map();
const customerConfigs = new Map();

// Persist an SMS exchange to the shared conversations/messages tables so the
// dashboards can show real data (the in-memory Map is wiped on every deploy).
async function persistSmsExchange(clerkUserId, contactPhone, inboundBody, outboundBody, hotLeadScore) {
  if (!clerkUserId) return;
  try {
    await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_phone TEXT`).catch(() => {});

    let convId;
    const existing = await query(
      `SELECT id FROM conversations WHERE user_id = $1 AND type = 'sms' AND contact_phone = $2 LIMIT 1`,
      [clerkUserId, contactPhone]
    );
    if (existing.rows.length > 0) {
      convId = existing.rows[0].id;
    } else {
      const created = await query(
        `INSERT INTO conversations (user_id, type, status, contact_phone) VALUES ($1, 'sms', 'active', $2) RETURNING id`,
        [clerkUserId, contactPhone]
      );
      convId = created.rows[0]?.id;
    }
    if (!convId) return;

    await query(
      `INSERT INTO messages (conversation_id, sender_type, content, metadata) VALUES ($1, 'user', $2, $3)`,
      [convId, inboundBody, JSON.stringify({ from: contactPhone })]
    );
    await query(
      `INSERT INTO messages (conversation_id, sender_type, content, metadata) VALUES ($1, 'assistant', $2, $3)`,
      [convId, outboundBody, JSON.stringify({ hotLeadScore: hotLeadScore || 0 })]
    );
  } catch (err) {
    console.error('⚠️ [SMS-WEBHOOK] Failed to persist conversation:', err.message);
  }
}

// Look up which customer owns this Twilio 'To' number
async function resolveCustomerFromTwilioNumber(toNumber) {
  try {
    // Primary: match against provisioned pool numbers
    const poolResult = await query(
      `SELECT clerk_user_id FROM customer_phone_numbers
       WHERE phone_number = $1 AND status = 'active' AND clerk_user_id IS NOT NULL LIMIT 1`,
      [toNumber]
    );
    if (poolResult.rows.length > 0) return poolResult.rows[0].clerk_user_id;

    // Legacy fallback: match by phone column on customers table
    const legacyResult = await query(
      'SELECT clerk_user_id FROM customers WHERE phone = $1 AND clerk_user_id IS NOT NULL LIMIT 1',
      [toNumber]
    );
    if (legacyResult.rows.length > 0) return legacyResult.rows[0].clerk_user_id;

    return null;
  } catch (err) {
    console.error('⚠️ [SMS-WEBHOOK] Could not resolve customer from Twilio number:', err.message);
    return null;
  }
}


export async function POST(request) {
  console.log('📱 === SMS WEBHOOK WITH CENTRALIZED AI SERVICE ===');
  
  try {
    const formData = await request.formData();
    const messageBody = formData.get('Body');
    const fromNumber = formData.get('From');
    const toNumber = formData.get('To');

    console.log('📱 SMS Webhook received:', {
      from: fromNumber,
      to: toNumber,
      message: messageBody
    });

    // Resolve which customer owns this Twilio number so we can use their AI settings
    const resolvedClerkUserId = await resolveCustomerFromTwilioNumber(toNumber);
    console.log('🔍 [SMS-WEBHOOK] Resolved customer:', resolvedClerkUserId || 'none (will use defaults)');

    // Keep in-memory config for hot lead alert settings (phone-level overrides)
    let customerConfig = customerConfigs.get(toNumber) || {
      phoneNumber: toNumber,
      businessName: 'Professional Service',
      personality: 'professional',
      businessInfo: 'We provide professional services to help our customers achieve their goals.',
      model: 'gpt-4o-mini',
      creativity: 0.7,
      welcomeMessage: 'Thanks for reaching out! How can I help you today?',
      businessOwnerPhone: null,
      enableHotLeadAlerts: false,
      alertBusinessHours: true
    };

    // Get or create conversation
    const conversationKey = `${toNumber}_${fromNumber}`;
    let conversation = conversations.get(conversationKey) || {
      id: conversationKey,
      toNumber: toNumber,
      fromNumber: fromNumber,
      messages: [],
      leadCaptured: false,
      createdAt: new Date().toISOString()
    };

    // Add incoming message to conversation
    conversation.messages.push({
      id: Date.now().toString(),
      body: messageBody,
      from: fromNumber,
      to: toNumber,
      timestamp: new Date().toISOString(),
      direction: 'inbound'
    });

    // 🎯 USE CENTRALIZED AI SERVICE FOR SMS RESPONSE
    console.log('🧠 Using centralized AI service for SMS...');
    
    // Build conversation history for context
    const conversationHistory = conversation.messages.slice(-6).map(msg => ({
      role: msg.from === fromNumber ? 'user' : 'assistant',
      content: msg.body,
      sender_type: msg.from === fromNumber ? 'user' : 'assistant'
    }));

    let aiResult;
    
    // Check if this is the first message and we have a welcome message
    if (conversation.messages.length === 1 && customerConfig.welcomeMessage) {
      aiResult = await generateSMSResponse(
        fromNumber,
        messageBody,
        conversationHistory,
        resolvedClerkUserId
      );
      aiResult.response = customerConfig.welcomeMessage;
    } else {
      aiResult = await generateSMSResponse(
        fromNumber,
        messageBody,
        conversationHistory,
        resolvedClerkUserId
      );
    }

    console.log('✅ Centralized AI service result:', {
      success: aiResult.success,
      hotLead: aiResult.hotLead?.isHotLead,
      score: aiResult.hotLead?.score,
      knowledgeBaseUsed: aiResult.metadata?.knowledgeBaseUsed
    });

    // Get AI response (fallback if service fails)
    let aiResponse;
    if (aiResult.success) {
      aiResponse = aiResult.response;
    } else {
      console.error('❌ Centralized AI service failed:', aiResult.error);
      aiResponse = "Thanks for your message! I'm experiencing some technical difficulties right now, but I'll make sure someone gets back to you soon.";
    }

    // Send alert if hot lead detected
    if (aiResult.hotLead?.isHotLead && resolvedClerkUserId) {
      await sendHotLeadAlert(resolvedClerkUserId, {
        contactPhone: fromNumber,
        channel: 'sms',
        message: messageBody,
        score: aiResult.hotLead.score || 80,
      });
    }

    // Capture lead if not already captured
    if (!conversation.leadCaptured) {
      conversation.leadCaptured = true;
      console.log('📝 New lead captured:', {
        phone: fromNumber,
        source: 'SMS',
        firstMessage: messageBody,
        hotLeadScore: aiResult.hotLead?.score || 0,
        centralizedAI: true
      });
    }

    // Add AI response to conversation
    conversation.messages.push({
      id: (Date.now() + 1).toString(),
      body: aiResponse,
      from: toNumber,
      to: fromNumber,
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      hotLeadScore: aiResult.hotLead?.score || 0,
      aiServiceUsed: aiResult.success
    });

    // Update conversation in storage
    conversations.set(conversationKey, conversation);

    // Persist to the database so dashboards survive restarts/deploys
    await persistSmsExchange(resolvedClerkUserId, fromNumber, messageBody, aiResponse, aiResult.hotLead?.score);

    console.log('✅ SMS processed successfully with centralized AI service:', {
      conversationId: conversationKey,
      messageCount: conversation.messages.length,
      aiResponse: aiResponse.slice(0, 50) + '...',
      hotLeadScore: aiResult.hotLead?.score || 0,
      centralizedAI: aiResult.success,
      tokensUsed: aiResult.metadata?.tokensUsed || 0,
      knowledgeBaseUsed: aiResult.metadata?.knowledgeBaseUsed || false
    });

    // Return TwiML response — sends the AI reply back to the lead
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${aiResponse.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;

    return new Response(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('❌ SMS Webhook Error:', error);
    
    const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Error occurred but webhook acknowledged -->
</Response>`;

    return new Response(errorResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// GET endpoint for retrieving conversations (for dashboard)
export async function GET(request) {
  try {
    const conversationArray = Array.from(conversations.values());
    
    return NextResponse.json({
      success: true,
      conversations: conversationArray,
      totalConversations: conversationArray.length,
      totalMessages: conversationArray.reduce((total, conv) => total + conv.messages.length, 0),
      centralizedAI: true,
      version: '2.0'
    });
  } catch (error) {
    console.error('❌ SMS GET Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      conversations: [],
      totalConversations: 0,
      totalMessages: 0
    }, { status: 500 });
  }
}
