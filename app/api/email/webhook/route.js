// app/api/email/webhook/route.js - COMPATIBLE WITH YOUR EXISTING DATABASE.JS
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
// Use YOUR existing database functions
import { 
  getCustomerByClerkId,
  createConversation,
  addMessage,
  getConversationMessages,
  createHotLead,
  query
} from '../../../../lib/database.js';
// Import centralized AI service
import { generateAIResponse } from '../../../../lib/ai-service.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Hot lead detection keywords (for backward compatibility)
const HOT_LEAD_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'emergency', 'deadline',
  'budget', 'price', 'cost', 'money', 'payment', 'buy', 'purchase',
  'interested', 'ready to start', 'when can we', 'schedule',
  'meeting', 'call me', 'phone', 'contact',
  'problem', 'issue', 'broken', 'not working', 'help',
  'competitor', 'other company', 'comparing', 'quote'
];

export async function POST(request) {
  console.log('📧 === EMAIL WEBHOOK WITH CENTRALIZED AI SERVICE ===');
  
  try {
    const body = await request.json();
    console.log('📧 Email webhook body:', JSON.stringify(body, null, 2));

    // Extract email data from webhook (adjust based on your email provider)
    const {
      from,
      to,
      subject,
      text,
      html,
      messageId,
      inReplyTo,
      threadId,
      clerkUserId // You'll need to pass this or determine it from the business email
    } = body;

    if (!from || !to || !text) {
      console.log('❌ Missing required email fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get customer using YOUR existing function
    let customer;
    if (clerkUserId) {
      customer = await getCustomerByClerkId(clerkUserId);
    } else {
      // Try to find customer by business email using YOUR existing table
      try {
        const customerResult = await query(
          'SELECT * FROM customers WHERE email = $1 LIMIT 1',
          [to]
        );
        customer = customerResult.rows[0] || null;
      } catch (error) {
        console.log('❌ No customer identification method provided');
        return NextResponse.json({ error: 'Cannot identify customer' }, { status: 400 });
      }
    }

    if (!customer) {
      console.log('❌ Customer not found');
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    console.log('✅ Customer found:', customer.business_name || customer.name);

    // Find or create email conversation using YOUR existing conversation system
    let conversation;
    
    try {
      // Check if conversation already exists for this customer/email combo
      const existingConvResult = await query(`
        SELECT c.*, COUNT(m.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.customer_id = $1 AND c.type = 'email'
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 1
      `, [customer.id]);
      
      if (existingConvResult.rows.length > 0) {
        conversation = existingConvResult.rows[0];
        console.log('✅ Found existing email conversation:', conversation.id);
      } else {
        // Create new conversation using YOUR existing function
        conversation = await createConversation(customer.clerk_user_id || customer.user_id, customer.id, 'email');
        console.log('✅ Created new email conversation:', conversation.id);
      }
    } catch (convError) {
      console.error('❌ Error with conversation:', convError);
      return NextResponse.json({ error: 'Failed to process conversation' }, { status: 500 });
    }

    if (!conversation) {
      console.error('❌ Failed to create or find conversation');
      return NextResponse.json({ error: 'Failed to process conversation' }, { status: 500 });
    }

    // Save incoming email message using YOUR existing function
    const incomingMessage = await addMessage(
      conversation.id,
      'customer', // sender_type
      text, // content
      { 
        subject: subject,
        html_content: html,
        message_id: messageId,
        in_reply_to: inReplyTo,
        thread_id: threadId,
        from_email: from,
        to_email: to
      } // metadata
    );

    if (incomingMessage) {
      console.log('✅ Incoming email message saved:', incomingMessage.id);
    }

    // 🎯 USE CENTRALIZED AI SERVICE FOR EMAIL RESPONSE
    console.log('🧠 Using centralized AI service for email...');
    
    // Get conversation history for context using YOUR existing function
    const messages = await getConversationMessages(conversation.id, 10);
    const conversationHistory = messages.map(msg => ({
      role: msg.sender_type === 'customer' ? 'user' : 'assistant',
      content: msg.content,
      sender_type: msg.sender_type
    }));

    // Use centralized AI service to generate response
    const aiResult = await generateAIResponse({
      userMessage: text,
      channel: 'email',
      customerEmail: to, // business email to identify customer config
      clerkUserId: clerkUserId,
      conversationHistory: conversationHistory,
      channelSpecificData: { subject: subject }
    });

    console.log('✅ Centralized AI service result:', {
      success: aiResult.success,
      hotLead: aiResult.hotLead?.isHotLead || false,
      score: aiResult.hotLead?.score || 0,
      knowledgeBaseUsed: aiResult.metadata?.knowledgeBaseUsed || false
    });

    // Handle hot lead detection using YOUR existing function
    const messageText = text.toLowerCase();
    const keywordMatches = HOT_LEAD_KEYWORDS.filter(keyword => 
      messageText.includes(keyword.toLowerCase())
    );

    // Use centralized AI hot lead detection (more advanced) OR fallback to keywords
    const isHotLead = aiResult.hotLead?.isHotLead || keywordMatches.length > 0;
    const hotLeadScore = aiResult.hotLead?.score || (keywordMatches.length * 25);

    if (isHotLead) {
      // Create hot lead using YOUR existing function
      const hotLeadAlert = await createHotLead(
        customer.clerk_user_id || customer.user_id, // userId
        customer.id, // customerId
        conversation.id, // conversationId
        hotLeadScore, // urgencyScore
        [...keywordMatches, ...(aiResult.hotLead?.keywords || [])], // keywords
        `Email Hot Lead: ${aiResult.hotLead?.reasoning || 'Keywords detected'}\nFrom: ${from}\nSubject: ${subject}\nMessage: ${text.substring(0, 200)}` // aiAnalysis
      );
      
      console.log('🔥 Hot lead detected in email!', {
        alertId: hotLeadAlert?.id,
        keywords: keywordMatches,
        aiScore: aiResult.hotLead?.score,
        reasoning: aiResult.hotLead?.reasoning
      });
      
      // Send business owner alert
      try {
        await sendBusinessOwnerEmailAlert(customer, from, subject, keywordMatches, text, aiResult.hotLead);
      } catch (alertError) {
        console.error('❌ Error sending business owner alert:', alertError);
      }
    }

    // Generate and send AI response if centralized service succeeded
    if (aiResult.success) {
      // Save AI response message using YOUR existing function
      const responseMessage = await addMessage(
        conversation.id,
        'assistant', // sender_type
        aiResult.response, // content
        {
          subject: inReplyTo ? `Re: ${subject}` : subject,
          html_content: convertTextToHtml(aiResult.response, customer),
          in_reply_to: messageId,
          is_ai_response: true,
          ai_model: aiResult.metadata?.model || 'gpt-4o-mini',
          thread_id: threadId
        } // metadata
      );

      if (responseMessage) {
        console.log('✅ AI response message saved:', responseMessage.id);
      }

      // Send AI response email
      const emailSent = await sendEmailResponse({
        to: from,
        from: to,
        subject: inReplyTo ? `Re: ${subject}` : subject,
        text: aiResult.response,
        html: convertTextToHtml(aiResult.response, customer),
        inReplyTo: messageId,
        threadId: threadId
      });

      if (emailSent) {
        console.log('✅ AI response sent using centralized service');
      }
    } else {
      console.error('❌ Centralized AI service failed:', aiResult.error);
    }

    return NextResponse.json({ 
      success: true, 
      conversationId: conversation.id,
      messageId: incomingMessage?.id,
      hotLead: isHotLead,
      hotLeadScore: hotLeadScore,
      centralizedAI: aiResult.success,
      tokensUsed: aiResult.metadata?.tokensUsed || 0,
      knowledgeBaseUsed: aiResult.metadata?.knowledgeBaseUsed || false,
      aiResponseSent: aiResult.success,
      database: {
        conversationSaved: !!conversation,
        messageSaved: !!incomingMessage,
        hotLeadAlerted: isHotLead,
        usingExistingFunctions: true
      }
    });

  } catch (error) {
    console.error('❌ Email webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

// Convert text to HTML (helper function)
function convertTextToHtml(aiText, customer) {
  const aiHtml = aiText
    .split('\n\n')
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      ${aiHtml}
      <br>
      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
        This email was generated by AI on behalf of ${customer.business_name || customer.name}. 
        If you need to speak with a human team member, please let us know.
      </p>
    </div>
  `;
}

// Send email response using Resend
async function sendEmailResponse(emailData) {
  try {
    if (!resend) throw new Error('Email service not configured (RESEND_API_KEY missing)');
    const result = await resend.emails.send({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      headers: {
        'In-Reply-To': emailData.inReplyTo,
        'References': emailData.inReplyTo,
        'Thread-Index': emailData.threadId
      }
    });

    console.log('✅ Email sent via Resend:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

// Send business owner alert
async function sendBusinessOwnerEmailAlert(customer, fromEmail, subject, keywords, triggerMessage, aiHotLead) {
  try {
    const alertHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #e74c3c;">🔥 Hot Lead Alert - Email</h2>
        <p><strong>Business:</strong> ${customer.business_name || customer.name}</p>
        <p><strong>Customer Email:</strong> ${fromEmail}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Keywords Detected:</strong> ${keywords.join(', ')}</p>
        ${aiHotLead ? `
        <div style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0;">
          <strong>🤖 AI Analysis:</strong><br>
          Score: ${aiHotLead.score}/100<br>
          Reasoning: ${aiHotLead.reasoning}
        </div>
        ` : ''}
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <strong>Customer Message:</strong><br>
          ${triggerMessage.replace(/\n/g, '<br>')}
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Log in to your dashboard to respond to this hot lead.
        </p>
        <p style="color: #888; font-size: 12px;">
          Powered by Centralized AI Service v2.0
        </p>
      </div>
    `;

    if (!resend) throw new Error('Email service not configured (RESEND_API_KEY missing)');
    await resend.emails.send({
      from: 'alerts@bizzybot.ai',
      to: customer.email,
      subject: `🔥 Hot Lead Alert: ${customer.business_name || customer.name}`,
      html: alertHtml
    });

    console.log('✅ Business owner email alert sent');
    return true;
  } catch (error) {
    console.error('❌ Error sending business owner email alert:', error);
    return false;
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Email webhook endpoint with Centralized AI Service',
    status: 'Active',
    version: '2.0 - Compatible',
    features: [
      '🎯 Centralized AI Service Integration',
      '📧 Uses existing database functions',
      '📨 Conversation threading with YOUR functions',
      '🔥 Advanced hot lead detection',
      '💾 Compatible with YOUR database schema',
      '📊 No additional database tables needed',
      '🤖 AI-powered responses'
    ],
    compatibility: 'Uses your existing database.js functions',
    timestamp: new Date().toISOString()
  });
}
