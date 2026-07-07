// lib/ai-service.js - COMPLETE FILE WITH LEADS INTEGRATION
// This is your ENTIRE file with the new leads features added

import OpenAI from 'openai';
import { query } from './database.js';
import { trackBehaviorEvents } from './behavior-analyzer.js';
// 🎯 NEW IMPORTS FOR LEADS INTEGRATION
import {
  trackLeadEvent,
  calculateLeadScore,
  classifyLeadTemperature,
  resolveLeadIdentity,
  getLeadDetails
} from './leads-service.js';
import { checkCanRespond, trackMessage } from './usage.js';

// Keep your existing OpenAI initialization
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Keep your existing HOT_LEAD_KEYWORDS
const HOT_LEAD_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'emergency', 'deadline',
  'budget', 'price', 'cost', 'money', 'payment', 'buy', 'purchase',
  'interested', 'ready to start', 'when can we', 'schedule',
  'meeting', 'call me', 'phone', 'contact',
  'problem', 'issue', 'broken', 'not working', 'help',
  'competitor', 'other company', 'comparing', 'quote'
];

/**
 * 🧠 CENTRALIZED AI RESPONSE GENERATOR - UPDATED WITH EVENT TRACKING
 * Compatible with your existing database.js functions
 */
export async function generateAIResponse({
  userMessage,
  channel,
  customerEmail = null,
  clerkUserId = null,
  contactEmail = null,
  contactPhone = null,
  conversationHistory = [],
  channelSpecificData = {}
}) {
  console.log(`🤖 [AI-SERVICE] Generating ${channel} response...`);

  try {
    // Step 1: Get customer configuration — now channel-aware
    let customerConfig = await getCustomerAIConfiguration(customerEmail, clerkUserId, channel);
    const effectiveClerkUserId = clerkUserId || customerConfig?.clerk_user_id;

    // Step 1.5: Check usage limits before doing anything expensive
    const usageCheck = await checkCanRespond(effectiveClerkUserId, channel);
    if (!usageCheck.allowed) {
      console.log(`🚫 [AI-SERVICE] Blocked (${usageCheck.reason}) for ${effectiveClerkUserId}`);
      return {
        success: true,
        response: usageCheck.upgradeMessage,
        hotLead: { isHotLead: false, score: 0 },
        eventsTracked: 0,
        trackedEvents: [],
        usageBlocked: true,
        blockReason: usageCheck.reason,
        ownerMessage: usageCheck.ownerMessage,
        metadata: { channel, customerConfig: customerConfig?.business_name || 'Default' }
      };
    }

    // Step 1.7: Check for escalation before doing anything expensive
    if (customerConfig?.escalation_enabled && customerConfig?.escalation_message) {
      const shouldEscalate = checkForEscalation(userMessage, customerConfig.escalation_triggers || '');
      if (shouldEscalate) {
        console.log(`🚨 [AI-SERVICE] Escalation triggered for ${channel}`);
        await trackMessage(effectiveClerkUserId, channel);
        return {
          success: true,
          response: customerConfig.escalation_message,
          isEscalation: true,
          hotLead: { isHotLead: false, score: 0 },
          eventsTracked: 0,
          trackedEvents: [],
          metadata: { channel, escalated: true }
        };
      }
    }

    // Step 2: Analyze for hot leads
    const hotLeadAnalysis = await analyzeHotLead(userMessage, conversationHistory, customerConfig);

    // Step 2.5: Look up lead context if we know who we're talking to
    let leadContext = null;
    if (customerConfig?.id && (contactEmail || contactPhone)) {
      try {
        leadContext = await getLeadContextForResponse(customerConfig.id, contactEmail || contactPhone);
        if (leadContext) console.log(`🎯 [AI-SERVICE] Lead context loaded: ${leadContext.summary}`);
      } catch (e) {
        console.log('⚠️ [AI-SERVICE] Lead context lookup skipped:', e.message);
      }
    }

    // Step 2.7: Fetch Outlook calendar availability if connected
    let calendarContext = null;
    if (effectiveClerkUserId && customerConfig?.booking_auto_send !== false) {
      try {
        const { getAvailableSlots, formatSlotsForAI } = await import('./microsoft-calendar.js');
        const calResult = await getAvailableSlots(effectiveClerkUserId);
        if (calResult.slots?.length > 0) {
          calendarContext = {
            slotsText: formatSlotsForAI(calResult.slots),
            slots: calResult.slots,
          };
          // Attach to customerConfig so buildSystemPrompt can use it
          customerConfig = { ...customerConfig, has_calendar: true, calendar_slots_text: calendarContext.slotsText };
        }
      } catch { /* calendar not connected — silently skip */ }
    }

    // Step 3: Build channel-specific AI prompt (now includes lead context)
    const systemPrompt = buildChannelSpecificPrompt(channel, customerConfig, channelSpecificData, leadContext);

    // Step 4: Generate AI response
    const aiResponse = await callOpenAI(systemPrompt, userMessage, conversationHistory, customerConfig);

    // Step 4.5: Check if AI flagged an escalation via [ESCALATE] marker
    const rawAIText = aiResponse.choices[0]?.message?.content || '';
    if (customerConfig?.escalation_enabled && customerConfig?.escalation_message && rawAIText.includes('[ESCALATE]')) {
      console.log(`🚨 [AI-SERVICE] AI self-escalated on ${channel}`);
      await trackMessage(effectiveClerkUserId, channel);
      return {
        success: true,
        response: customerConfig.escalation_message,
        isEscalation: true,
        hotLead: hotLeadAnalysis,
        eventsTracked: 0,
        trackedEvents: [],
        metadata: { channel, escalated: true }
      };
    }

    // Step 5: Format response for specific channel
    let formattedResponse = formatResponseForChannel(aiResponse, channel, customerConfig);

    // Step 5.5: Detect [BOOK:datetime] marker and create calendar event
    const bookingMatch = formattedResponse.match(/\[BOOK:([0-9T:-]+)\]/);
    if (bookingMatch && calendarContext && effectiveClerkUserId) {
      const startISO = bookingMatch[1]; // e.g. "2026-06-05T14:00"
      try {
        const { createCalendarEvent } = await import('./microsoft-calendar.js');
        const custResult = await query(
          'SELECT business_name FROM customers WHERE clerk_user_id = $1 LIMIT 1',
          [effectiveClerkUserId]
        ).catch(() => ({ rows: [] }));

        await createCalendarEvent(effectiveClerkUserId, {
          startISO,
          attendeeEmail: contactEmail || null,
          attendeeName: leadContext?.name || null,
          businessName: custResult.rows[0]?.business_name || '',
        });

        const friendlyTime = new Date(startISO + ':00Z').toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
        });
        const confirmation = contactEmail
          ? `A calendar invitation has been sent to ${contactEmail}.`
          : 'You\'ll receive confirmation shortly.';
        formattedResponse = formattedResponse.replace(bookingMatch[0], `\n\n✅ Booked for ${friendlyTime}. ${confirmation}`);
        console.log(`📅 Calendar event created for ${startISO} with ${contactEmail || 'no email'}`);
      } catch (bookErr) {
        console.error('⚠️ Calendar booking failed:', bookErr.message);
        formattedResponse = formattedResponse.replace(bookingMatch[0], '');
      }
    }
    
    // 🎯 NEW STEP 6: Track behavior events if customer exists
    let eventsTracked = 0;
    let trackedEvents = [];
    if (customerConfig && customerConfig.id) {
      const trackingResult = await trackBehaviorEvents(
        customerConfig.id,
        formattedResponse,
        userMessage,
        channel
      );
      eventsTracked = trackingResult.eventsTracked || 0;
      trackedEvents = trackingResult.events || [];
      console.log(`📊 [AI-SERVICE] Tracked ${eventsTracked} behavior events`);
    }

    // Track this message against the customer's monthly usage limit
    await trackMessage(effectiveClerkUserId, channel);

    console.log(`✅ [AI-SERVICE] ${channel} response generated successfully`);
    
    return {
      success: true,
      response: formattedResponse,
      hotLead: hotLeadAnalysis,
      eventsTracked: eventsTracked, // 🎯 NEW
      trackedEvents: trackedEvents, // 🎯 NEW
      metadata: {
        channel: channel,
        customerConfig: customerConfig ? customerConfig.business_name : 'Default',
        knowledgeBaseUsed: !!(customerConfig?.knowledge_base?.trim()),
        customPromptUsed: !!(customerConfig?.system_prompt?.trim()),
        responseTime: Date.now(),
        tokensUsed: aiResponse.usage?.total_tokens || 0,
        model: customerConfig?.ai_model || customerConfig?.model || 'gpt-4o-mini'
      }
    };
    
  } catch (error) {
    console.error('❌ [AI-SERVICE] Error:', error);
    
    return {
      success: false,
      response: getChannelErrorMessage(channel),
      error: error.message,
      hotLead: { isHotLead: false, score: 0 },
      eventsTracked: 0, // 🎯 NEW
      trackedEvents: [] // 🎯 NEW
    };
  }
}

/**
 * 📊 Get customer AI configuration - USES YOUR EXISTING DATABASE STRUCTURE
 */
// Maps ai-service channel names to ai_channel_settings table channel names
const CHANNEL_MAP = { gmail: 'email', sms: 'text', chat: 'chatbot', email: 'email', facebook: 'facebook', instagram: 'instagram' };

async function getCustomerAIConfiguration(customerEmail, clerkUserId, channel = 'email') {
  try {
    let customer = null;

    if (clerkUserId) {
      const { getCustomerByClerkId } = await import('./database.js');
      customer = await getCustomerByClerkId(clerkUserId);
    } else if (customerEmail) {
      const result = await query(
        'SELECT * FROM customers WHERE email = $1 LIMIT 1',
        [customerEmail]
      );
      customer = result.rows[0] || null;
    }

    if (!customer) {
      console.log('⚠️ [AI-SERVICE] No customer found');
      return null;
    }

    // Base AI config
    let aiConfig = {};
    try {
      const aiConfigResult = await query(
        'SELECT * FROM ai_configs WHERE user_id = $1 LIMIT 1',
        [customer.clerk_user_id || customer.user_id]
      );
      aiConfig = aiConfigResult.rows[0] || {};
    } catch (_) {}

    // Email settings (fallback defaults)
    let emailSettings = {};
    try {
      const emailResult = await query(
        'SELECT * FROM email_settings WHERE customer_id = $1 OR user_id = $2 LIMIT 1',
        [customer.id, customer.clerk_user_id || customer.user_id]
      );
      emailSettings = emailResult.rows[0] || {};
    } catch (_) {}

    // Channel-specific settings from ai_channel_settings table
    let channelSettings = {};
    try {
      const settingsChannel = CHANNEL_MAP[channel] || channel;
      const csResult = await query(
        'SELECT * FROM ai_channel_settings WHERE customer_id = $1 AND channel = $2 LIMIT 1',
        [customer.id, settingsChannel]
      );
      if (csResult.rows.length > 0) {
        const cs = csResult.rows[0];
        channelSettings = {
          business_name:        cs.business_name || '',
          knowledge_base:       cs.knowledge_base || '',
          custom_instructions:  cs.custom_instructions || '',
          system_prompt:        cs.custom_instructions || '',
          tone:                 (cs.response_tone || '').toLowerCase(),
          ai_personality:       (cs.response_tone || '').toLowerCase(),
          response_length:      (cs.response_length || '').toLowerCase(),
          industry:             cs.industry || '',
          business_description: cs.business_description || '',
          escalation_enabled:   cs.escalation_enabled || false,
          escalation_triggers:  cs.escalation_triggers || '',
          escalation_message:   cs.escalation_message || '',
          followup_enabled:     cs.followup_enabled || false,
          followup_delay_days:  cs.followup_delay_days || 3,
          followup_max_count:   cs.followup_max_count || 2,
          document_link:        cs.document_link || '',
          document_description: cs.document_description || '',
          documents:            Array.isArray(cs.documents) ? cs.documents : [],
        };
        console.log(`✅ [AI-SERVICE] Loaded ${settingsChannel} channel-specific settings`);
      }
    } catch (csError) {
      console.log('⚠️ [AI-SERVICE] Channel settings lookup skipped:', csError.message);
    }

    // Merge: channel settings win over email settings win over ai_configs win over customer
    const config = {
      ...customer,
      ...aiConfig,
      ...emailSettings,
      // Channel-specific overrides (only non-empty values win)
      ...(channelSettings.business_name        && { business_name:        channelSettings.business_name }),
      ...(channelSettings.knowledge_base       && { knowledge_base:       channelSettings.knowledge_base }),
      ...(channelSettings.custom_instructions  && { custom_instructions:  channelSettings.custom_instructions, system_prompt: channelSettings.system_prompt }),
      ...(channelSettings.tone                 && { tone: channelSettings.tone, ai_personality: channelSettings.ai_personality }),
      ...(channelSettings.response_length      && { response_length:      channelSettings.response_length }),
      ...(channelSettings.industry             && { industry:             channelSettings.industry }),
      ...(channelSettings.business_description && { business_description: channelSettings.business_description }),
      // Escalation, follow-up & document always come from channel settings
      escalation_enabled:   channelSettings.escalation_enabled,
      escalation_triggers:  channelSettings.escalation_triggers,
      escalation_message:   channelSettings.escalation_message,
      followup_enabled:     channelSettings.followup_enabled,
      followup_delay_days:  channelSettings.followup_delay_days,
      followup_max_count:   channelSettings.followup_max_count,
      document_link:        channelSettings.document_link,
      document_description: channelSettings.document_description,
      documents:            channelSettings.documents,
    };

    // Final fallback for knowledge_base
    if (!config.knowledge_base) config.knowledge_base = emailSettings.knowledge_base || '';

    console.log('✅ [AI-SERVICE] Config loaded:', {
      business_name: config.business_name,
      channel,
      has_knowledge_base: !!(config.knowledge_base?.trim()),
      has_custom_prompt:  !!(config.system_prompt?.trim()),
      tone: config.tone || config.ai_personality || 'professional',
      response_length: config.response_length || 'medium',
      industry: config.industry || '(none)',
    });

    return config;

  } catch (error) {
    console.error('❌ [AI-SERVICE] Error loading customer config:', error);
    return null;
  }
}

/**
 * Checks whether a message matches any escalation trigger keywords.
 * Fast keyword scan — runs before OpenAI to avoid wasting a call.
 */
function checkForEscalation(message, triggers) {
  if (!triggers) return false;
  const lowerMsg = message.toLowerCase();
  const triggerList = triggers.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  return triggerList.length > 0 && triggerList.some(trigger => lowerMsg.includes(trigger));
}

/**
 * 🔥 Hot lead analysis with AI scoring
 */
async function analyzeHotLead(message, conversationHistory = [], customerConfig = null) {
  try {
    // Basic keyword detection
    const messageContent = message.toLowerCase();
    const keywordMatches = HOT_LEAD_KEYWORDS.filter(keyword => 
      messageContent.includes(keyword.toLowerCase())
    );
    
    // Use customer's custom hot lead keywords if available
    let customKeywordMatches = [];
    if (customerConfig?.hot_lead_keywords && Array.isArray(customerConfig.hot_lead_keywords)) {
      customKeywordMatches = customerConfig.hot_lead_keywords.filter(keyword => 
        messageContent.includes(keyword.toLowerCase())
      );
    }
    
    const totalKeywords = [...keywordMatches, ...customKeywordMatches];
    const basicScore = Math.min(totalKeywords.length * 25, 100);
    
    // AI-powered scoring if OpenAI is available
    if (openai && customerConfig?.lead_detection_enabled !== false) {
      try {
        const aiAnalysis = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a hot lead detection AI. Analyze messages to determine lead urgency (0-100 score).
              
              Hot indicators:
              - Urgency words (urgent, asap, immediately)
              - Buying signals (budget, ready, purchase)
              - Contact requests (call me, meet, schedule)
              - Problem urgency (broken, not working, emergency)
              
              Return JSON: {"score": 0-100, "reasoning": "brief explanation"}`
            },
            {
              role: 'user',
              content: `Message: "${message}"\nContext: ${conversationHistory.slice(-3).map(h => h.content || h.body || '').join(' ')}`
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });
        
        const aiResult = JSON.parse(aiAnalysis.choices[0].message.content);
        const finalScore = Math.max(basicScore, aiResult.score);
        
        return {
          isHotLead: finalScore >= 60,
          score: finalScore,
          reasoning: aiResult.reasoning,
          keywords: totalKeywords,
          analysisMethod: 'ai_enhanced'
        };
        
      } catch (aiError) {
        console.error('⚠️ [AI-SERVICE] AI hot lead analysis failed:', aiError);
      }
    }
    
    // Fallback to keyword-based scoring
    return {
      isHotLead: basicScore >= 60,
      score: basicScore,
      reasoning: totalKeywords.length > 0 ? `Detected keywords: ${totalKeywords.join(', ')}` : 'No hot lead indicators',
      keywords: totalKeywords,
      analysisMethod: 'keyword_based'
    };
    
  } catch (error) {
    console.error('❌ [AI-SERVICE] Hot lead analysis error:', error);
    return { isHotLead: false, score: 0, reasoning: 'Analysis failed', keywords: [] };
  }
}

/**
 * 🎯 Build channel-specific AI prompts
 */
function buildChannelSpecificPrompt(channel, customerConfig, channelData = {}, leadContext = null) {
  const businessName = customerConfig?.business_name || 'My Business';
  const knowledge = customerConfig?.knowledge_base?.trim() || '';
  const customPrompt = customerConfig?.system_prompt?.trim() || customerConfig?.custom_instructions?.trim() || '';
  const personality = customerConfig?.ai_personality || customerConfig?.tone || 'professional';
  const bookingUrl = customerConfig?.booking_url || '';
  const bookingAutoSend = customerConfig?.booking_auto_send !== false;
  const industry = customerConfig?.industry?.trim() || '';
  const businessDescription = customerConfig?.business_description?.trim() || '';
  const responseLength = (customerConfig?.response_length || 'medium').toLowerCase();

  // Base prompt
  let basePrompt = `You are an AI assistant representing ${businessName}.`;

  // Add industry context
  if (industry) {
    basePrompt += `\nIndustry: ${industry}.`;
  }

  // Add business description
  if (businessDescription) {
    basePrompt += `\n\nABOUT THE BUSINESS:\n${businessDescription}`;
  }

  // Add knowledge base
  if (knowledge) {
    basePrompt += `\n\nBUSINESS KNOWLEDGE:\n${knowledge}`;
  }

  // Add custom instructions
  if (customPrompt && customPrompt !== 'You are a helpful AI assistant.') {
    basePrompt += `\n\nCUSTOM INSTRUCTIONS:\n${customPrompt}`;
  }

  // Response length instruction
  const lengthInstructions = {
    short:  'Keep your response brief — 1 to 3 sentences maximum.',
    medium: 'Keep your response concise but complete — aim for 2 to 5 sentences.',
    long:   'Provide a thorough, detailed response that covers all relevant points fully.'
  };
  basePrompt += `\n\nRESPONSE LENGTH: ${lengthInstructions[responseLength] || lengthInstructions.medium}`;

  // Booking link
  if (bookingUrl && bookingAutoSend) {
    basePrompt += `\n\nSCHEDULING: If the customer asks to book, schedule, set up a meeting, make an appointment, or asks about availability, include this booking link in your response: ${bookingUrl}. Always present it as a clickable link and encourage them to use it.`;
  }

  // Calendar booking (direct appointment creation via Outlook)
  if (customerConfig?.has_calendar && customerConfig?.calendar_slots_text) {
    basePrompt += `\n\nCALENDAR: You can book appointments directly on the owner's calendar. Available slots:\n${customerConfig.calendar_slots_text}\n\nWhen scheduling comes up: first present 2-3 of these available times and ask which works best. Once the lead confirms a specific slot, include the marker [BOOK:YYYY-MM-DDTHH:MM] exactly once in your reply (use the ISO datetime from the slot they chose). Example: "Perfect, I've got you booked for Thursday at 2pm! [BOOK:2026-06-05T14:00]". Only use [BOOK:...] after the lead has explicitly confirmed a specific time.${bookingUrl ? ` If none of the listed times work, offer the booking link as an alternative: ${bookingUrl}` : ''}`;
  }

  // Documents — sent once a lead is clearly qualified and ready to proceed
  const documents = Array.isArray(customerConfig?.documents) ? customerConfig.documents : [];
  const validDocs = documents.filter(d => d?.link?.trim() && d?.description?.trim());
  if (validDocs.length > 0) {
    basePrompt += `\n\nDOCUMENTS: Once a lead is clearly interested and ready to move forward, include the relevant document link(s) as a natural next step:`;
    validDocs.forEach(doc => {
      basePrompt += `\n- ${doc.description}: ${doc.link}`;
    });
    basePrompt += `\nPresent these naturally in the flow of the conversation, not in every message.`;
  }

  // Lead context — tells the AI who it's talking to
  if (leadContext) {
    basePrompt = enrichPromptWithLeadContext(basePrompt, leadContext);
  }
  
  // Channel-specific formatting and behavior
  const channelInstructions = {
    sms: `
      SMS GUIDELINES:
      - Keep responses under 160 characters when possible
      - Be concise and direct
      - Use emojis sparingly
      - If complex response needed, offer to call or email
      - Always be ${personality}`,
      
    gmail: `
      EMAIL GUIDELINES:
      - Write professional email responses
      - Use proper email formatting
      - Be detailed but concise
      - Include relevant business information
      - Maintain ${personality} tone
      - Sign off simply as "${businessName}" only — never invent a person's name, job title, phone number, or website`,
      
    facebook: `
      FACEBOOK MESSENGER GUIDELINES:
      - Keep responses conversational and friendly
      - Use casual but ${personality} tone
      - Emojis are appropriate for social media
      - Be helpful and engaging
      - Encourage further conversation`,
      
    instagram: `
      INSTAGRAM GUIDELINES:
      - Use trendy, social media appropriate language
      - Be visual and engaging in descriptions
      - Use relevant emojis
      - Keep it fun but ${personality}
      - Encourage visual content sharing`,
      
    email: `
      EMAIL SYSTEM GUIDELINES:
      - Professional email communication
      - Detailed responses appropriate for email
      - Include business context and information
      - Be ${personality} and helpful
      - Proper email etiquette`,
      
    chat: `
      WEB CHAT GUIDELINES:
      - Conversational and helpful
      - Immediate assistance focus
      - Can be detailed since space isn't limited
      - Be ${personality} and engaging
      - Guide towards business goals`
  };
  
  const channelInstruction = channelInstructions[channel] || channelInstructions.chat;
  
  // Add channel-specific data context
  if (channelData.subject && channel === 'gmail') {
    basePrompt += `\n\nEMAIL SUBJECT: "${channelData.subject}"`;
  }
  
  if (channelData.phoneNumber && channel === 'sms') {
    basePrompt += `\n\nSMS CONVERSATION with ${channelData.phoneNumber}`;
  }
  
  // Escalation instruction — AI self-flags situations it cannot handle
  if (customerConfig?.escalation_enabled) {
    basePrompt += `\n\nESCALATION: If you receive a request that is beyond your scope — such as legal questions, contract disputes, refund demands, threats, or when the customer explicitly asks to speak to a real person — respond with exactly: [ESCALATE]. Do not attempt to handle these yourself.`;
  }

  const noPlaceholders = `\n\nCRITICAL — NO PLACEHOLDERS: Never output bracketed placeholders like [Your Name], [Recipient's Name], [Your Position], [Contact Information], [Website URL], or [Phone]. If you don't have a piece of information, leave it out entirely — do not invent a placeholder for it. If you don't know the recipient's name, greet them generically (e.g., "Hi there,"). Only state facts you actually know from the business information above; never fabricate details.`;

  return basePrompt + '\n\n' + channelInstruction + noPlaceholders + '\n\nAlways be helpful, accurate, and represent the business professionally.';
}

/**
 * 🤖 Call OpenAI with proper configuration - FIXED TYPE CONVERSION
 */
async function callOpenAI(systemPrompt, userMessage, conversationHistory, customerConfig) {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }
  
  const messages = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Add conversation history (limit to last 10 messages for context)
  if (conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role || (msg.sender_type === 'user' ? 'user' : 'assistant'),
        content: msg.content || msg.body || msg.message || ''
      });
    }
  }
  
  // Add current user message
  messages.push({ role: 'user', content: userMessage });
  
  // 🔧 FIX: Ensure temperature and max_tokens are proper types
  const temperature = parseFloat(customerConfig?.temperature || customerConfig?.ai_temperature || 0.7);
  const maxTokens = parseInt(customerConfig?.max_tokens || customerConfig?.ai_max_tokens || 500);
  
  console.log('🔧 [AI-SERVICE] OpenAI parameters:', {
    model: customerConfig?.model || customerConfig?.ai_model || 'gpt-4o-mini',
    temperature: temperature,
    max_tokens: maxTokens,
    temperature_type: typeof temperature,
    max_tokens_type: typeof maxTokens
  });
  
  const completion = await openai.chat.completions.create({
    model: customerConfig?.model || customerConfig?.ai_model || 'gpt-4o-mini',
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature
  });
  
  return completion;
}

/**
 * 📱 Format response for specific channels
 */
function formatResponseForChannel(aiResponse, channel, customerConfig) {
  const response = aiResponse.choices[0]?.message?.content || '';
  
  switch (channel) {
    case 'sms':
      // SMS: Truncate if too long, suggest alternative
      if (response.length > 160) {
        return response.substring(0, 150) + '... (call for more info)';
      }
      return response;
      
    case 'gmail':
    case 'email':
      // Email: Add professional signature
      const businessName = customerConfig?.business_name || 'My Business';
      return response + `\n\n--\nBest regards,\n${businessName}`;
      
    case 'facebook':
    case 'instagram':
      // Social: Keep as-is, AI already formatted for social media
      return response;
      
    case 'chat':
    default:
      // Chat: Return as-is
      return response;
  }
}

/**
 * ❌ Channel-specific error messages
 */
function getChannelErrorMessage(channel) {
  const messages = {
    sms: "I'm having a brief technical issue, but I'd be happy to help! Please try again in a moment.",
    gmail: "Thank you for your email. I'm experiencing some technical difficulties right now, but I'll make sure someone gets back to you soon.",
    facebook: "Thanks for reaching out! I'm having a brief technical issue, but I'd love to help you. Please try again in a moment! 😊",
    instagram: "Hey! Thanks for the message! I'm having a quick tech issue but I'll be right back to help! ✨",
    email: "Thank you for contacting us. We're experiencing some technical difficulties but will respond as soon as possible.",
    chat: "I'm having a brief technical issue. Please try again in a moment, and I'll be happy to help!"
  };
  
  return messages[channel] || messages.chat;
}

/**
 * 🔧 UTILITY FUNCTIONS FOR CHANNELS
 */

// Quick function for SMS webhook
export async function generateSMSResponse(phoneNumber, message, conversationHistory = [], clerkUserId = null) {
  return generateAIResponse({
    userMessage: message,
    channel: 'sms',
    clerkUserId: clerkUserId,
    customerEmail: null,
    conversationHistory: conversationHistory,
    channelSpecificData: { phoneNumber }
  });
}

// Quick function for Gmail monitor
export async function generateGmailResponse(customerEmail, emailContent, subject, conversationHistory = [], clerkUserId = null, contactEmail = null) {
  return generateAIResponse({
    userMessage: emailContent,
    channel: 'gmail',
    customerEmail: customerEmail,
    clerkUserId: clerkUserId,
    contactEmail: contactEmail,
    conversationHistory: conversationHistory,
    channelSpecificData: { subject }
  });
}

// Quick function for Facebook webhook
export async function generateFacebookResponse(pageId, message, conversationHistory = [], clerkUserId = null) {
  return generateAIResponse({
    userMessage: message,
    channel: 'facebook',
    clerkUserId: clerkUserId,
    customerEmail: null,
    conversationHistory: conversationHistory,
    channelSpecificData: { pageId }
  });
}

// Quick function for Instagram webhook
export async function generateInstagramResponse(pageId, message, conversationHistory = [], clerkUserId = null) {
  return generateAIResponse({
    userMessage: message,
    channel: 'instagram',
    clerkUserId: clerkUserId,
    customerEmail: null,
    conversationHistory: conversationHistory,
    channelSpecificData: { pageId }
  });
}

// Quick function for web chat
export async function generateChatResponse(clerkUserId, message, conversationHistory = []) {
  return generateAIResponse({
    userMessage: message,
    channel: 'chat',
    clerkUserId: clerkUserId,
    conversationHistory: conversationHistory
  });
}

// ============================================================
// 🎯 NEW FUNCTIONS FOR LEADS INTEGRATION
// ============================================================

/**
 * 🎯 Enhanced AI response with lead tracking
 * This wraps your existing generateAIResponse to add lead tracking
 */
export async function generateAIResponseWithLeadTracking({
  userMessage,
  channel,
  customerEmail = null,
  customerPhone = null,
  customerName = null,
  clerkUserId = null,
  conversationHistory = [],
  channelSpecificData = {}
}) {
  // Call your existing generateAIResponse function
  const aiResult = await generateAIResponse({
    userMessage,
    channel,
    customerEmail,
    clerkUserId,
    conversationHistory,
    channelSpecificData
  });
  
  // If successful and we have customer info, track as lead
  if (aiResult.success && aiResult.metadata?.customerConfig?.id) {
    const customerId = aiResult.metadata.customerConfig.id;
    
    try {
      // Resolve lead identity (merge duplicates)
      const leadIdentity = await resolveLeadIdentity(
        customerId,
        customerEmail,
        customerPhone,
        customerName
      );
      
      // Track this interaction as a lead event
      await trackLeadEvent(customerId, {
        type: 'ai_interaction',
        channel: channel,
        email: leadIdentity.email,
        phone: leadIdentity.phone,
        name: leadIdentity.name,
        company: channelSpecificData.company || null,
        message: userMessage
      });
      
      // If it's a hot lead, track that specifically
      if (aiResult.hotLead?.isHotLead) {
        await trackLeadEvent(customerId, {
          type: 'hot_lead',
          channel: channel,
          email: leadIdentity.email,
          phone: leadIdentity.phone,
          name: leadIdentity.name,
          message: `Hot lead detected! Score: ${aiResult.hotLead.score}`
        });
      }
      
      // Calculate lead score for this interaction
      const leadData = {
        hot_lead_count: aiResult.hotLead?.isHotLead ? 1 : 0,
        phone_request_count: userMessage.toLowerCase().includes('call') ? 1 : 0,
        appointment_count: userMessage.toLowerCase().includes('appointment') ? 1 : 0,
        pricing_discussion_count: userMessage.toLowerCase().includes('price') ? 1 : 0,
        interaction_count: 1,
        last_interaction: new Date()
      };
      
      const leadScore = calculateLeadScore(leadData);
      const leadTemperature = classifyLeadTemperature(leadScore, leadData);
      
      // Add lead info to response
      aiResult.leadInfo = {
        identity: leadIdentity,
        score: leadScore,
        temperature: leadTemperature
      };
    } catch (leadError) {
      console.error('⚠️ [AI-SERVICE] Lead tracking error:', leadError);
      // Don't fail the whole response if lead tracking fails
    }
  }
  
  return aiResult;
}

/**
 * 🔍 Get lead context to personalize AI responses
 * Use this before generating responses to get lead history
 */
export async function getLeadContextForResponse(customerId, identifier) {
  try {
    // Get lead details
    const leadResult = await getLeadDetails(customerId, identifier);
    
    if (!leadResult.success || !leadResult.lead) {
      return null;
    }
    
    // Extract relevant context for AI
    const context = {
      isHotLead: leadResult.lead.temperature === 'hot',
      leadScore: leadResult.lead.score,
      previousInteractions: leadResult.lead.interaction_count,
      lastContact: leadResult.lead.last_interaction,
      hasContactInfo: !!(leadResult.lead.email || leadResult.lead.phone),
      channels: leadResult.lead.channels_used || [],
      summary: `This is a ${leadResult.lead.temperature} lead with score ${leadResult.lead.score}/100. They've had ${leadResult.lead.interaction_count} previous interactions.`
    };
    
    return context;
    
  } catch (error) {
    console.error('Error getting lead context:', error);
    return null;
  }
}

/**
 * 📊 Enrich system prompt with lead context
 * Add this to your buildChannelSpecificPrompt function calls
 */
export function enrichPromptWithLeadContext(basePrompt, leadContext) {
  if (!leadContext) return basePrompt;
  
  let enrichedPrompt = basePrompt;
  
  // Add lead context to prompt
  enrichedPrompt += '\n\n🎯 LEAD CONTEXT:\n';
  enrichedPrompt += leadContext.summary + '\n';
  
  // Add specific instructions based on lead temperature
  if (leadContext.isHotLead) {
    enrichedPrompt += '\nThis is a HOT LEAD - be extra responsive, offer immediate assistance, and try to schedule next steps.\n';
  } else if (leadContext.leadScore >= 40) {
    enrichedPrompt += '\nThis is a WARM LEAD - nurture the relationship and gently guide toward conversion.\n';
  } else {
    enrichedPrompt += '\nThis is a COLD LEAD - focus on education and building trust.\n';
  }
  
  // Add personalization based on history
  if (leadContext.previousInteractions > 5) {
    enrichedPrompt += 'This is a returning contact - acknowledge their continued interest.\n';
  }
  
  return enrichedPrompt;
}
