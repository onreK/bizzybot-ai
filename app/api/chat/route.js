// app/api/chat/route.js - COMPATIBLE WITH YOUR EXISTING STRUCTURE
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// Keep using YOUR existing function
import { getAIConfigForUser } from '../ai-config/route.js';
// Import centralized AI service for enhanced features
import { generateChatResponse } from '../../../lib/ai-service.js';
import { scoreKeywordMatches, KEYWORD_SCORE_CAP } from '../../../lib/hot-lead-keywords.js';

// Force dynamic rendering for authentication
export const dynamic = 'force-dynamic';

// Import database functions with proper error handling
let dbAvailable = false;
let db = {};

try {
  const database = await import('../../../lib/database.js');
  db = database;
  dbAvailable = true;
  console.log('✅ Database functions loaded successfully');
} catch (error) {
  console.log('⚠️ Database not available, using fallback mode:', error.message);
  dbAvailable = false;
}

// GET: dashboard data — ?action=conversations (web chat history) or
// ?action=test-connection (is the chat AI available). Previously only POST
// existed, so the Overview page got 405s and Web Chat always showed "Not set up".
export async function GET(req) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const action = new URL(req.url).searchParams.get('action');

    if (action === 'test-connection') {
      return NextResponse.json({ connected: !!process.env.OPENAI_API_KEY });
    }

    if (action === 'conversations') {
      if (!dbAvailable) {
        return NextResponse.json({ conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0 });
      }
      const result = await db.query(
        `SELECT c.id, c.created_at, COUNT(m.id) AS message_count, MAX(m.created_at) AS last_message_at
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.type = 'chat' AND c.user_id = $1
         GROUP BY c.id
         ORDER BY last_message_at DESC NULLS LAST
         LIMIT 50`,
        [userId]
      );
      const conversations = result.rows.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        messageCount: parseInt(r.message_count, 10) || 0,
      }));
      // Real chat-sourced contacts (the widget captures emails/phones typed
      // into the chat since 2026-07)
      let leadsGenerated = 0;
      try {
        const leadsRes = await db.query(
          `SELECT COUNT(*) AS n FROM contacts ct
           JOIN customers cu ON cu.id = ct.customer_id
           WHERE cu.clerk_user_id = $1 AND ct.source_channel = 'chat'`,
          [userId]
        );
        leadsGenerated = parseInt(leadsRes.rows[0]?.n || 0);
      } catch {}

      return NextResponse.json({
        conversations,
        totalConversations: conversations.length,
        totalMessages: conversations.reduce((acc, c) => acc + c.messageCount, 0),
        leadsGenerated,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('❌ Chat GET error:', error);
    return NextResponse.json({ error: 'Failed to load chat data' }, { status: 500 });
  }
}

export async function POST(req) {
  console.log('💬 === CHAT API WITH CENTRALIZED AI SERVICE ===');
  
  try {
    const { userId } = auth();
    
    if (!userId) {
      console.log('❌ No userId from auth');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('👤 Chat request from user:', userId);

    const body = await req.json();
    const { messages, conversationKey } = body;
    
    if (!messages || !Array.isArray(messages)) {
      console.log('❌ Invalid messages format');
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1];
    if (!userMessage || !userMessage.content) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    console.log('📝 User message:', userMessage.content);

    // 🎯 USE CENTRALIZED AI SERVICE FOR ENHANCED CHAT RESPONSE
    console.log('🧠 Using centralized AI service for chat...');
    
    // Prepare conversation history for centralized service
    const conversationHistory = messages.map(msg => ({
      role: msg.role || (msg.sender === 'assistant' ? 'assistant' : 'user'),
      content: msg.content,
      sender_type: msg.role || (msg.sender === 'assistant' ? 'assistant' : 'user')
    }));

    // Try centralized AI service first (enhanced features)
    let aiResult;
    let assistantMessage;
    let usedCentralizedAI = false;

    try {
      aiResult = await generateChatResponse(
        userId, // clerkUserId
        userMessage.content, // user message
        conversationHistory // conversation history
      );

      if (aiResult.success) {
        assistantMessage = aiResult.response;
        usedCentralizedAI = true;
        console.log('✅ Centralized AI service succeeded');
      } else {
        throw new Error('Centralized AI service failed: ' + aiResult.error);
      }
    } catch (centralizedError) {
      console.log('⚠️ Centralized AI service failed, using fallback:', centralizedError.message);
      
      // Fallback to your existing AI config system
      const aiConfig = await getAIConfigForUser(userId);
      console.log('✅ Using fallback AI configuration:', {
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.maxTokens,
        hasCustomPrompt: !!aiConfig.systemPrompt
      });

      // Hot-lead keywords come from the SHARED list, not a local copy. This
      // branch had its own array of real-estate phrases ("cash buyer",
      // "schedule showing", "ready to make an offer") that predated the
      // multi-industry pivot and never received the 2026-07-19 de-fang.
      // Scored, not a boolean match. A single keyword used to set 70 — above
      // the hot threshold of 60 — which is exactly the pattern the 2026-07-19
      // de-fang removed everywhere else, and how a support engineer became an
      // $18k hot lead. Keywords may nudge; they can never alone make a lead
      // hot (the shared cap is 45).
      const keywordScore = scoreKeywordMatches(userMessage.content);
      const isHotLead = keywordScore >= KEYWORD_SCORE_CAP;

      // Build system prompt using user's configuration
      let systemPrompt = aiConfig.systemPrompt;

      // If no custom system prompt, use a default
      if (!systemPrompt || systemPrompt.trim() === 'You are a helpful AI assistant.') {
        // Industry-neutral: BizzyBot serves any client-facing business, and
        // this used to make an unconfigured AI introduce itself as an estate
        // agent regardless of what the customer actually does.
        systemPrompt = `You are a professional AI assistant for this business.
Answer customer questions helpfully and accurately using only what you know about the business.
Never invent details you were not given.
Aim to capture the customer's contact details and book an appointment when it is a natural next step.`;
      }

      // Add hot lead context if detected
      if (isHotLead) {
        systemPrompt += `\n\nIMPORTANT: This customer has expressed hot lead indicators. Be extra attentive and helpful, and try to capture their contact information or schedule a meeting.`;
      }

      // Your existing OpenAI call
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role || (msg.sender === 'assistant' ? 'assistant' : 'user'),
          content: msg.content
        }))
      ];

      const completion = await openai.chat.completions.create({
        model: aiConfig.model,
        messages: openaiMessages,
        max_tokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
      });

      assistantMessage = completion.choices[0].message.content;
      
      // Create fallback aiResult structure
      aiResult = {
        success: true,
        response: assistantMessage,
        hotLead: {
          isHotLead: isHotLead,
          score: keywordScore,
          reasoning: isHotLead ? 'Hot lead keywords detected' : 'No hot lead indicators'
        },
        metadata: {
          model: aiConfig.model,
          tokensUsed: completion.usage?.total_tokens || 0,
          knowledgeBaseUsed: false,
          customPromptUsed: !!aiConfig.systemPrompt
        }
      };
    }

    // Save conversation to database if available (using YOUR existing functions)
    if (dbAvailable && conversationKey) {
      try {
        // Create or get conversation using YOUR existing function
        const conversationResult = await db.query(
          `INSERT INTO conversations (user_id, type, status) 
           VALUES ($1, 'chat', 'active') 
           ON CONFLICT DO NOTHING 
           RETURNING id`,
          [userId]
        );

        let conversationId = conversationResult.rows[0]?.id;
        
        if (!conversationId) {
          // Get existing conversation
          const existingConv = await db.query(
            'SELECT id FROM conversations WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1',
            [userId, 'chat']
          );
          conversationId = existingConv.rows[0]?.id;
        }

        // Save user message using YOUR existing function
        if (conversationId) {
          await db.addMessage(conversationId, 'user', userMessage.content);
          
          // Save assistant response using YOUR existing function
          await db.addMessage(conversationId, 'assistant', assistantMessage);
        }

        console.log('💾 Conversation saved to database');
      } catch (dbError) {
        console.error('⚠️ Database error (continuing anyway):', dbError);
      }
    }

    // Handle hot lead detection using YOUR existing functions
    if (aiResult.hotLead?.isHotLead && dbAvailable) {
      try {
        // Create hot lead entry using YOUR existing function
        await db.createHotLead(
          userId, // userId
          null, // customerId (optional) 
          null, // conversationId (optional)
          aiResult.hotLead.score,
          aiResult.hotLead.keywords || [],
          aiResult.hotLead.reasoning || 'Hot lead detected by centralized AI service'
        );
        console.log('🔥 Hot lead logged to database');
      } catch (dbError) {
        console.error('⚠️ Error logging hot lead:', dbError);
      }
    }

    console.log('✅ Chat response completed successfully');

    return NextResponse.json({ 
      response: assistantMessage,
      isHotLead: aiResult.hotLead?.isHotLead || false,
      hotLeadScore: aiResult.hotLead?.score || 0,
      hotLeadReasoning: aiResult.hotLead?.reasoning,
      model: aiResult.metadata?.model || 'gpt-4o-mini',
      configApplied: true,
      centralizedAI: usedCentralizedAI,
      tokensUsed: aiResult.metadata?.tokensUsed || 0,
      knowledgeBaseUsed: aiResult.metadata?.knowledgeBaseUsed || false,
      customPromptUsed: aiResult.metadata?.customPromptUsed || false,
      responseTime: aiResult.metadata?.responseTime || 0,
      fallbackUsed: !usedCentralizedAI
    });

  } catch (error) {
    console.error('❌ Chat API Error:', error);
    
    // Return a helpful error message
    return NextResponse.json({ 
      error: 'Failed to generate response',
      details: error.message,
      fallbackResponse: "I'm sorry, I'm experiencing some technical difficulties right now. Please try again in a moment.",
      centralizedAI: false
    }, { status: 500 });
  }
}
