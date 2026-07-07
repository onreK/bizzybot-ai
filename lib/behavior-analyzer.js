// lib/behavior-analyzer.js
// Analyzes AI responses to detect actual behaviors and track events

/**
 * Analyzes AI response text to detect behaviors and events
 * @param {string} aiResponse - The AI's response text
 * @param {string} userMessage - The original user message
 * @param {string} channel - The communication channel (email, sms, chat)
 * @returns {Array} Array of detected events with confidence scores
 */
export function analyzeBehaviors(aiResponse, userMessage = '', channel = 'email') {
  const events = [];
  const responseLower = aiResponse.toLowerCase();
  const userMessageLower = userMessage.toLowerCase();

  // 📞 Phone Request Detection
  const phonePatterns = [
    /phone number/i,
    /call you/i,
    /best number to reach/i,
    /contact number/i,
    /phone to discuss/i,
    /number to call/i,
    /reach you by phone/i,
    /give me a call/i,
    /phone consultation/i
  ];

  const phoneRequestDetected = phonePatterns.some(pattern => pattern.test(aiResponse));
  if (phoneRequestDetected) {
    events.push({
      type: 'phone_requested',
      confidence: calculateConfidence(aiResponse, phonePatterns),
      data: {
        response_excerpt: extractRelevantExcerpt(aiResponse, 'phone'),
        channel: channel
      }
    });
  }

  // 📅 Appointment/Scheduling Detection
  const schedulingPatterns = [
    /schedule.*appointment/i,
    /book.*meeting/i,
    /available.*time/i,
    /calendar.*availability/i,
    /within.*24.*hour/i,
    /tomorrow.*available/i,
    /today.*available/i,
    /this week.*meet/i,
    /consultation.*time/i,
    /demo.*schedule/i
  ];

  const schedulingDetected = schedulingPatterns.some(pattern => pattern.test(aiResponse));
  if (schedulingDetected) {
    const isUrgent = /within.*24.*hour|today|tomorrow|asap|urgent/i.test(aiResponse);
    
    events.push({
      type: 'appointment_offered',
      confidence: calculateConfidence(aiResponse, schedulingPatterns),
      data: {
        urgency: isUrgent ? 'high' : 'normal',
        timeframe: extractTimeframe(aiResponse),
        channel: channel
      }
    });
  }

  // 🔥 Hot Lead Detection (enhanced)
  const hotLeadIndicators = analyzeHotLeadSignals(userMessage, aiResponse);
  if (hotLeadIndicators.isHotLead) {
    events.push({
      type: 'hot_lead_detected',
      confidence: hotLeadIndicators.confidence,
      data: {
        score: hotLeadIndicators.score,
        signals: hotLeadIndicators.signals,
        reasoning: hotLeadIndicators.reasoning,
        channel: channel
      }
    });
  }

  // 💰 Pricing/Quote Discussion
  const pricingPatterns = [
    /price|pricing|cost|quote|estimate|budget|investment|fee/i,
    /how much|what.*charge|rate|package/i
  ];

  if (pricingPatterns.some(pattern => pattern.test(aiResponse))) {
    events.push({
      type: 'pricing_discussed',
      confidence: calculateConfidence(aiResponse, pricingPatterns),
      data: {
        quoted_price: extractPrice(aiResponse),
        channel: channel
      }
    });
  }

  // 🎯 Call-to-Action Detection
  const ctaPatterns = [
    /click.*here|visit.*website|check out|learn more|get started/i,
    /sign up|register|join|subscribe|download/i,
    /contact us|reach out|let.*know|reply/i,
    /book now|reserve|claim|secure your/i
  ];

  if (ctaPatterns.some(pattern => pattern.test(aiResponse))) {
    events.push({
      type: 'cta_included',
      confidence: calculateConfidence(aiResponse, ctaPatterns),
      data: {
        cta_type: identifyCTAType(aiResponse),
        channel: channel
      }
    });
  }

  // 🏆 Competitive Advantage Mentioned
  const competitivePatterns = [
    /better than|unlike.*competitor|advantage|superior/i,
    /why choose us|what sets us apart|difference/i,
    /unique|exclusive|only.*offer|special/i
  ];

  if (competitivePatterns.some(pattern => pattern.test(aiResponse))) {
    events.push({
      type: 'advantages_highlighted',
      confidence: calculateConfidence(aiResponse, competitivePatterns),
      data: {
        advantages_mentioned: extractAdvantages(aiResponse),
        channel: channel
      }
    });
  }

  // 📧 Email Collection
  if (/email.*address|email me|send.*email/i.test(aiResponse)) {
    events.push({
      type: 'email_requested',
      confidence: 0.9,
      data: { channel: channel }
    });
  }

  // 🔄 Follow-up Offered
  if (/follow up|check in|circle back|touch base|reach out again/i.test(aiResponse)) {
    events.push({
      type: 'followup_offered',
      confidence: 0.85,
      data: { 
        timeframe: extractFollowupTimeframe(aiResponse),
        channel: channel 
      }
    });
  }

  // 📋 Qualifying Questions Asked
  const qualifyingPatterns = [
    /what.*looking for|what.*need|what.*goal/i,
    /tell.*more about|help.*understand|clarify/i,
    /how many|how often|when.*need|timeline/i,
    /budget.*mind|price range|investment level/i
  ];

  const qualifyingCount = qualifyingPatterns.filter(pattern => pattern.test(aiResponse)).length;
  if (qualifyingCount > 0) {
    events.push({
      type: 'qualifying_questions_asked',
      confidence: Math.min(0.6 + (qualifyingCount * 0.1), 1.0),
      data: {
        question_count: qualifyingCount,
        channel: channel
      }
    });
  }

  // 🚀 Urgency Created
  if (/limited time|act now|expires|ending soon|last chance|today only/i.test(aiResponse)) {
    events.push({
      type: 'urgency_created',
      confidence: 0.9,
      data: { channel: channel }
    });
  }

  return events;
}

/**
 * Enhanced hot lead detection with multiple signals
 */
function analyzeHotLeadSignals(userMessage, aiResponse) {
  const signals = [];
  let totalScore = 0;

  // User message indicators (what they said)
  const userIndicators = {
    urgency: { pattern: /urgent|asap|immediately|right away|today|now/i, weight: 25 },
    budget: { pattern: /budget|pay|afford|invest|spend|cost/i, weight: 20 },
    timeline: { pattern: /this week|next week|this month|soon|when can/i, weight: 15 },
    readiness: { pattern: /ready|prepared|decided|want to start|need this/i, weight: 20 },
    comparison: { pattern: /compare|versus|vs|other options|alternatives/i, weight: 10 },
    specific: { pattern: /specifically|exactly|particular|precise/i, weight: 10 }
  };

  for (const [key, indicator] of Object.entries(userIndicators)) {
    if (indicator.pattern.test(userMessage)) {
      signals.push(key);
      totalScore += indicator.weight;
    }
  }

  // AI response indicators (how we responded)
  if (/schedule.*immediately|available.*today|call.*now/i.test(aiResponse)) {
    signals.push('immediate_action_offered');
    totalScore += 15;
  }

  if (/perfect.*fit|exactly.*need|ideal.*solution/i.test(aiResponse)) {
    signals.push('strong_match_identified');
    totalScore += 10;
  }

  // Calculate confidence based on number of signals
  const confidence = Math.min(0.5 + (signals.length * 0.1), 1.0);
  
  return {
    isHotLead: totalScore >= 40,
    score: Math.min(totalScore, 100),
    confidence: confidence,
    signals: signals,
    reasoning: generateHotLeadReasoning(signals, totalScore)
  };
}

/**
 * Helper function to calculate confidence score
 */
function calculateConfidence(text, patterns) {
  const matches = patterns.filter(pattern => pattern.test(text)).length;
  const confidence = Math.min(0.6 + (matches * 0.1), 1.0);
  return parseFloat(confidence.toFixed(2));
}

/**
 * Extract relevant excerpt around a keyword
 */
function extractRelevantExcerpt(text, keyword) {
  const sentences = text.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => s.toLowerCase().includes(keyword));
  return relevantSentence ? relevantSentence.trim().substring(0, 200) : '';
}

/**
 * Extract timeframe mentions
 */
function extractTimeframe(text) {
  if (/today/i.test(text)) return 'today';
  if (/tomorrow/i.test(text)) return 'tomorrow';
  if (/24 hour/i.test(text)) return '24_hours';
  if (/this week/i.test(text)) return 'this_week';
  if (/next week/i.test(text)) return 'next_week';
  return 'flexible';
}

/**
 * Extract price mentions
 */
function extractPrice(text) {
  const priceMatch = text.match(/\$[\d,]+/);
  return priceMatch ? priceMatch[0] : null;
}

/**
 * Identify type of CTA
 */
function identifyCTAType(text) {
  if (/book|schedule|appointment/i.test(text)) return 'booking';
  if (/call|phone/i.test(text)) return 'call';
  if (/email|contact/i.test(text)) return 'contact';
  if (/visit|website|learn more/i.test(text)) return 'website';
  if (/sign up|register|join/i.test(text)) return 'signup';
  return 'general';
}

/**
 * Extract competitive advantages mentioned
 */
function extractAdvantages(text) {
  const advantages = [];
  if (/faster/i.test(text)) advantages.push('speed');
  if (/cheaper|affordable|save/i.test(text)) advantages.push('price');
  if (/quality|premium|best/i.test(text)) advantages.push('quality');
  if (/experience|years|trusted/i.test(text)) advantages.push('experience');
  if (/local|nearby|community/i.test(text)) advantages.push('local');
  return advantages;
}

/**
 * Extract follow-up timeframe
 */
function extractFollowupTimeframe(text) {
  if (/tomorrow/i.test(text)) return 'tomorrow';
  if (/few days/i.test(text)) return 'few_days';
  if (/next week/i.test(text)) return 'next_week';
  if (/couple.*days/i.test(text)) return 'couple_days';
  return 'unspecified';
}

/**
 * Generate reasoning for hot lead detection
 */
function generateHotLeadReasoning(signals, score) {
  if (score >= 80) {
    return `Very hot lead (${score}/100): Strong buying signals including ${signals.join(', ')}`;
  } else if (score >= 60) {
    return `Hot lead (${score}/100): Multiple positive indicators including ${signals.join(', ')}`;
  } else if (score >= 40) {
    return `Warm lead (${score}/100): Some interest signals including ${signals.join(', ')}`;
  } else {
    return `Standard lead (${score}/100): Basic inquiry with limited buying signals`;
  }
}

/**
 * Main function to track events in the database
 */
export async function trackBehaviorEvents(customerId, aiResponse, userMessage, channel = 'email') {
  try {
    // Import database dynamically to avoid circular dependencies
    const { query } = await import('./database.js');
    
    // Analyze behaviors
    const events = analyzeBehaviors(aiResponse, userMessage, channel);

    // Baseline event: every AI reply counts exactly once — this feeds the
    // ai_responses count (Time Saved on the Overview). Gmail is excluded
    // because its monitor already records an ai_response event through the
    // contact/lead system (would double-count).
    if (channel !== 'gmail') {
      events.unshift({ type: 'ai_response', confidence: 1.0, data: { channel } });
    }
    
    // Save each event to database
    const savedEvents = [];
    
    for (const event of events) {
      try {
        const result = await query(`
          INSERT INTO ai_analytics_events 
          (customer_id, event_type, event_data, ai_response, user_message, channel, confidence_score, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          RETURNING id, event_type, confidence_score
        `, [
          customerId,
          event.type,
          JSON.stringify(event.data),
          aiResponse.substring(0, 2000), // Limit response size
          userMessage.substring(0, 1000), // Limit message size
          channel,
          event.confidence
        ]);
        
        savedEvents.push(result.rows[0]);
        console.log(`📊 Tracked event: ${event.type} (confidence: ${event.confidence})`);
      } catch (eventError) {
        console.error(`Failed to track event ${event.type}:`, eventError);
      }
    }
    
    // Update customer summary (aggregate data)
    await updateCustomerAnalyticsSummary(customerId);
    
    return {
      success: true,
      eventsTracked: savedEvents.length,
      events: savedEvents
    };
    
  } catch (error) {
    console.error('Error tracking behavior events:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update customer analytics summary
 */
async function updateCustomerAnalyticsSummary(customerId) {
  try {
    const { query } = await import('./database.js');
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    // Get event counts for current month
    const eventCounts = await query(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM ai_analytics_events
      WHERE customer_id = $1 
        AND created_at >= $2
        AND created_at < ($2::date + interval '1 month')
      GROUP BY event_type
    `, [customerId, currentMonth]);
    
    // Prepare summary data
    const summary = {
      phone_requests: 0,
      appointments_offered: 0,
      hot_leads_detected: 0,
      ai_responses_sent: 0
    };
    
    eventCounts.rows.forEach(row => {
      switch(row.event_type) {
        case 'phone_requested':
          summary.phone_requests = parseInt(row.count);
          break;
        case 'appointment_offered':
          summary.appointments_offered = parseInt(row.count);
          break;
        case 'hot_lead_detected':
          summary.hot_leads_detected = parseInt(row.count);
          break;
      }
      summary.ai_responses_sent += parseInt(row.count);
    });
    
    // Update or insert summary
    await query(`
      INSERT INTO customer_analytics_summary 
      (customer_id, month, phone_requests_count, appointments_offered_count, 
       hot_leads_detected_count, ai_responses_sent, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (customer_id, month) 
      DO UPDATE SET
        phone_requests_count = $3,
        appointments_offered_count = $4,
        hot_leads_detected_count = $5,
        ai_responses_sent = $6,
        updated_at = CURRENT_TIMESTAMP
    `, [
      customerId,
      currentMonth,
      summary.phone_requests,
      summary.appointments_offered,
      summary.hot_leads_detected,
      summary.ai_responses_sent
    ]);
    
    console.log(`📈 Updated analytics summary for customer ${customerId}`);
    
  } catch (error) {
    console.error('Error updating customer summary:', error);
  }
}

export default {
  analyzeBehaviors,
  trackBehaviorEvents,
  analyzeHotLeadSignals
};
