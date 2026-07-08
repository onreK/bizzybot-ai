// lib/analytics-service.js
// TRULY FIXED VERSION - No replace() errors, only uses existing columns
// Works with: id, customer_id, event_type, event_data, ai_response, user_message, channel, confidence_score, created_at

import { query, getCustomerByClerkId } from './database.js';

/**
 * 🎯 MAIN ANALYTICS FUNCTION - Call this from your API routes
 * Returns unified analytics for any channel or all channels
 */
export async function getAnalytics({ 
  clerkUserId, 
  customerId = null,
  channel = 'all', 
  period = 'month' 
}) {
  console.log('📊 [ANALYTICS-SERVICE] Fetching analytics:', { channel, period });
  
  try {
    // Get customer if not provided
    let customer = null;
    if (!customerId && clerkUserId) {
      const customerResult = await query(
        'SELECT * FROM customers WHERE clerk_user_id = $1 LIMIT 1',
        [clerkUserId]
      );
      
      if (!customerResult.rows[0]) {
        console.log('❌ Customer not found');
        return {
          success: false,
          error: 'Customer not found',
          analytics: getEmptyAnalytics()
        };
      }
      
      customer = customerResult.rows[0];
      customerId = customer.id;
    }
    
    // Calculate date range
    const dateRange = getDateRange(period);
    
    // Get metrics based on channel
    const universalMetrics = await getUniversalMetrics(customerId, channel, dateRange);
    const behaviors = await getBehaviorCounts(customerId, channel, dateRange);
    const dailyTrend = await getDailyTrend(customerId, channel, dateRange);
    const channelBreakdown = await getChannelBreakdown(customerId, dateRange);
    const leadsCount = await getLeadsCount(customerId, dateRange);
    const avgResponseTime = await getAvgResponseTime(customerId, channel, dateRange);
    const voiceStats = await getVoiceStats(customerId, dateRange);
    
    // Calculate effectiveness score (simplified for your data structure)
    const effectivenessScore = calculateEffectivenessScore(universalMetrics, behaviors);
    
    // Generate insights
    const insights = generateInsights(universalMetrics, behaviors);
    
    // Calculate business value
    const businessValue = calculateBusinessValue(behaviors);
    
    // Format the response (backward compatible with your existing dashboard)
    const analytics = {
      period: period,
      dateRange: dateRange,
      
      // Keep your existing overview structure for backward compatibility
      overview: {
        effectiveness_score: effectivenessScore,
        total_interactions_month: universalMetrics.total_interactions || 0,
        interactions_today: universalMetrics.interactions_today || 0,
        hot_leads_today: universalMetrics.hot_leads_today || 0,
        hot_leads_month: universalMetrics.hot_leads_total || 0,
        phone_requests_today: universalMetrics.phone_requests_today || 0,
        phone_requests_month: universalMetrics.phone_requests_total || 0,
        appointments_month: universalMetrics.appointments_total || 0,
        
        // Rates against real inbound interactions, capped at 100
        ai_responses_month: universalMetrics.ai_responses || 0,
        ai_engagement_rate: Math.min(100, Math.round((universalMetrics.ai_responses / Math.max(1, universalMetrics.total_interactions)) * 100)),
        contact_capture_rate: Math.min(100, Math.round((leadsCount / Math.max(1, universalMetrics.total_interactions)) * 100)),
        avg_response_speed_minutes: avgResponseTime,
        total_leads_captured: leadsCount
      },
      
      // Channel breakdown
      channels: channelBreakdown,
      
      // Behaviors and insights
      behaviors: behaviors,
      topBehaviors: behaviors.slice(0, 5),
      insights: insights,
      
      // Business value
      businessValue: businessValue,
      
      // Trend data
      dailyTrend: dailyTrend,

      // Voice AI stats (from vapi_call_logs — separate from ai_analytics_events)
      voice: voiceStats
    };
    
    return {
      success: true,
      customer: customer,
      analytics: analytics,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ [ANALYTICS-SERVICE] Error:', error);
    return {
      success: false,
      error: error.message,
      analytics: getEmptyAnalytics()
    };
  }
}

// ── Truthful event definitions ──────────────────────────────────────────────
// The events table mixes real messages, AI replies, and regex-detected
// "behaviors", and the trackers have written two generations of names.
// Everything below counts BOTH generations, and counts an "interaction" as a
// real inbound customer message — never a behavior detection.
//
// Gmail note: the monitor historically re-logged the same email on every cron
// run (26k rows for ~271 real emails), so gmail inbound is deduped by
// gmail_message_id at read time.
const INBOUND_IDENTITY_SQL = `
  CASE
    WHEN event_type = 'email_received' AND channel = 'gmail'
      THEN 'g:' || COALESCE(metadata::jsonb->>'gmail_message_id', id::text)
    WHEN event_type IN ('message_received', 'email_received', 'call_received')
      THEN 'i:' || id::text
  END`;

const HOT_LEAD_TYPES    = `('hot_lead', 'hot_lead_detected')`;
const PHONE_REQ_TYPES   = `('phone_request', 'phone_requested')`;
const APPOINTMENT_TYPES = `('appointment_scheduled', 'appointment_booked')`; // real bookings only — NOT appointment_offered (AI merely mentioning scheduling)
const AI_RESPONSE_TYPES = `('ai_response', 'custom_response')`;

/**
 * 🎯 Get metrics — counts real interactions, both event-name generations
 */
async function getUniversalMetrics(customerId, channel, dateRange) {
  const channelFilter = channel !== 'all' ? 'AND channel = $4' : '';
  const totalsParams = channel !== 'all'
    ? [customerId, dateRange.start, dateRange.end, channel]
    : [customerId, dateRange.start, dateRange.end];

  const totalsSql = `
    SELECT
      COUNT(DISTINCT ${INBOUND_IDENTITY_SQL}) as total_interactions,
      COUNT(DISTINCT DATE(created_at)) as active_days,
      COUNT(CASE WHEN event_type IN ${HOT_LEAD_TYPES} THEN 1 END) as hot_leads_total,
      COUNT(CASE WHEN event_type IN ${PHONE_REQ_TYPES} THEN 1 END) as phone_requests_total,
      COUNT(CASE WHEN event_type IN ${APPOINTMENT_TYPES} THEN 1 END) as appointments_total,
      COUNT(CASE WHEN event_type IN ${AI_RESPONSE_TYPES} THEN 1 END) as ai_responses,
      COUNT(DISTINCT channel) as active_channels
    FROM ai_analytics_events
    WHERE customer_id = $1
      AND created_at >= $2
      AND created_at <= $3
      ${channelFilter}
  `;

  const todayChannelFilter = channel !== 'all' ? 'AND channel = $2' : '';
  const todayParams = channel !== 'all' ? [customerId, channel] : [customerId];
  const todaySql = `
    SELECT
      COUNT(DISTINCT ${INBOUND_IDENTITY_SQL}) as interactions_today,
      COUNT(CASE WHEN event_type IN ${HOT_LEAD_TYPES} THEN 1 END) as hot_leads_today,
      COUNT(CASE WHEN event_type IN ${PHONE_REQ_TYPES} THEN 1 END) as phone_requests_today
    FROM ai_analytics_events
    WHERE customer_id = $1
      AND DATE(created_at) = CURRENT_DATE
      ${todayChannelFilter}
  `;

  // Execute queries
  const totalsResult = await query(totalsSql, totalsParams);
  const todayResult = await query(todaySql, todayParams);

  return {
    // From totals query
    total_interactions: parseInt(totalsResult.rows[0]?.total_interactions || 0),
    active_days: parseInt(totalsResult.rows[0]?.active_days || 0),
    hot_leads_total: parseInt(totalsResult.rows[0]?.hot_leads_total || 0),
    phone_requests_total: parseInt(totalsResult.rows[0]?.phone_requests_total || 0),
    appointments_total: parseInt(totalsResult.rows[0]?.appointments_total || 0),
    ai_responses: parseInt(totalsResult.rows[0]?.ai_responses || 0),
    active_channels: parseInt(totalsResult.rows[0]?.active_channels || 0),

    // From today query
    interactions_today: parseInt(todayResult.rows[0]?.interactions_today || 0),
    hot_leads_today: parseInt(todayResult.rows[0]?.hot_leads_today || 0),
    phone_requests_today: parseInt(todayResult.rows[0]?.phone_requests_today || 0)
  };
}

/**
 * 🎯 Get behavior counts
 */
async function getBehaviorCounts(customerId, channel, dateRange) {
  // Behaviors = things the AI did, not raw message traffic. Inbound events
  // (email_received / message_received / call_received) would drown the list
  // — gmail alone has thousands of duplicate email_received rows.
  const channelFilter = channel !== 'all' ? 'AND channel = $4' : '';
  const params = channel !== 'all'
    ? [customerId, dateRange.start, dateRange.end, channel]
    : [customerId, dateRange.start, dateRange.end];

  const sql = `
    SELECT
      event_type,
      COUNT(*) as count
    FROM ai_analytics_events
    WHERE customer_id = $1
      AND created_at >= $2
      AND created_at <= $3
      AND event_type IS NOT NULL
      AND event_type NOT IN ('email_received', 'message_received', 'call_received')
      ${channelFilter}
    GROUP BY event_type
    ORDER BY count DESC
  `;

  const result = await query(sql, params);
  
  return result.rows.map(row => ({
    event_type: row.event_type,
    count: parseInt(row.count),
    label: formatEventTypeLabel(row.event_type)
  }));
}

/**
 * 🎯 Get daily trend data
 */
async function getDailyTrend(customerId, channel, dateRange) {
  // Last 30 active days, returned oldest→newest so charts read left-to-right
  const channelFilter = channel !== 'all' ? 'AND channel = $4' : '';
  const params = channel !== 'all'
    ? [customerId, dateRange.start, dateRange.end, channel]
    : [customerId, dateRange.start, dateRange.end];

  const sql = `
    SELECT * FROM (
      SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT ${INBOUND_IDENTITY_SQL}) as total_events,
        COUNT(CASE WHEN event_type IN ${PHONE_REQ_TYPES} THEN 1 END) as phone_requests,
        COUNT(CASE WHEN event_type IN ${APPOINTMENT_TYPES} THEN 1 END) as appointments,
        COUNT(CASE WHEN event_type IN ${HOT_LEAD_TYPES} THEN 1 END) as hot_leads
      FROM ai_analytics_events
      WHERE customer_id = $1
        AND created_at >= $2
        AND created_at <= $3
        ${channelFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    ) recent
    ORDER BY date ASC
  `;

  const result = await query(sql, params);
  
  return result.rows.map(row => ({
    date: row.date,
    metrics: {
      total: parseInt(row.total_events),
      phoneRequests: parseInt(row.phone_requests),
      appointments: parseInt(row.appointments),
      hotLeads: parseInt(row.hot_leads)
    }
  }));
}

/**
 * 🎯 Get channel breakdown
 */
async function getChannelBreakdown(customerId, dateRange) {
  const result = await query(`
    SELECT
      channel,
      COUNT(DISTINCT ${INBOUND_IDENTITY_SQL}) as total_interactions,
      COUNT(CASE WHEN event_type IN ${HOT_LEAD_TYPES} THEN 1 END) as hot_leads,
      COUNT(CASE WHEN event_type IN ${PHONE_REQ_TYPES} THEN 1 END) as phone_requests,
      COUNT(CASE WHEN event_type IN ${APPOINTMENT_TYPES} THEN 1 END) as appointments
    FROM ai_analytics_events
    WHERE customer_id = $1
      AND created_at >= $2
      AND created_at <= $3
      AND channel IS NOT NULL
    GROUP BY channel
    HAVING COUNT(DISTINCT ${INBOUND_IDENTITY_SQL})
         + COUNT(CASE WHEN event_type IN ${HOT_LEAD_TYPES} THEN 1 END)
         + COUNT(CASE WHEN event_type IN ${PHONE_REQ_TYPES} THEN 1 END)
         + COUNT(CASE WHEN event_type IN ${APPOINTMENT_TYPES} THEN 1 END) > 0
    ORDER BY total_interactions DESC
  `, [customerId, dateRange.start, dateRange.end]);
  
  return result.rows.map(row => ({
    name: row.channel,
    total_interactions: parseInt(row.total_interactions),
    hot_leads: parseInt(row.hot_leads),
    phone_requests: parseInt(row.phone_requests),
    appointments: parseInt(row.appointments)
  }));
}

/**
 * 🎯 Calculate effectiveness score (simplified)
 */
function calculateEffectivenessScore(metrics, behaviors) {
  let score = 0;
  
  // Base score from activity (30 points max)
  if (metrics.total_interactions >= 20) score += 30;
  else if (metrics.total_interactions >= 10) score += 20;
  else if (metrics.total_interactions >= 5) score += 10;
  else if (metrics.total_interactions > 0) score += 5;
  
  // Hot leads score (25 points max)
  if (metrics.hot_leads_total >= 4) score += 25;
  else if (metrics.hot_leads_total >= 2) score += 15;
  else if (metrics.hot_leads_total >= 1) score += 10;
  
  // Phone requests score (20 points max)
  if (metrics.phone_requests_total >= 3) score += 20;
  else if (metrics.phone_requests_total >= 2) score += 15;
  else if (metrics.phone_requests_total >= 1) score += 10;
  
  // Appointments score (15 points max)
  if (metrics.appointments_total >= 2) score += 15;
  else if (metrics.appointments_total >= 1) score += 10;
  
  // Channel diversity (10 points max)
  if (metrics.active_channels >= 3) score += 10;
  else if (metrics.active_channels >= 2) score += 5;
  
  return Math.min(100, Math.round(score));
}

/**
 * 🎯 Generate insights
 */
function generateInsights(metrics, behaviors) {
  const insights = [];
  
  // Activity insights
  if (metrics.total_interactions === 0) {
    insights.push({
      type: 'info',
      message: 'No AI interactions recorded yet. Start using your AI features to see analytics.',
      importance: 'high'
    });
  } else if (metrics.total_interactions >= 20) {
    insights.push({
      type: 'success',
      message: `Great activity! ${metrics.total_interactions} AI interactions this period.`,
      importance: 'medium'
    });
  }
  
  // Hot leads insights
  if (metrics.hot_leads_total >= 3) {
    insights.push({
      type: 'success',
      message: `🔥 ${metrics.hot_leads_total} hot leads identified! Follow up quickly for best results.`,
      importance: 'high'
    });
  } else if (metrics.hot_leads_today > 0) {
    insights.push({
      type: 'alert',
      message: `${metrics.hot_leads_today} new hot lead(s) today - immediate attention needed!`,
      importance: 'urgent'
    });
  }
  
  // Phone requests insights
  if (metrics.phone_requests_total > 0) {
    insights.push({
      type: 'info',
      message: `${metrics.phone_requests_total} customers requested phone calls. Make sure to follow up.`,
      importance: 'high'
    });
  }
  
  // Channel insights
  if (metrics.active_channels >= 3) {
    insights.push({
      type: 'success',
      message: 'Great multi-channel engagement across email, SMS, and chat!',
      importance: 'medium'
    });
  }
  
  // Appointment insights
  if (metrics.appointments_total > 0) {
    insights.push({
      type: 'success',
      message: `${metrics.appointments_total} appointments scheduled through AI automation.`,
      importance: 'medium'
    });
  }
  
  return insights;
}

/**
 * 🎯 Calculate business value
 */
function calculateBusinessValue(behaviors) {
  const valueMap = {
    'hot_lead': 200,
    'hot_lead_detected': 200,
    'appointment_scheduled': 150,
    'appointment_booked': 150,
    'phone_request': 75,
    'phone_requested': 75,
    'email_request': 50,
    'email_requested': 50,
    'pricing_discussed': 100,
    'demo_requested': 125,
    'follow_up': 25,
    'followup_offered': 25,
    'qualifying_questions': 30,
    'qualifying_questions_asked': 30,
    'urgency_created': 40,
    'advantages_highlighted': 20,
    'contact_form': 35,
    'contact_captured': 35,
    'message_received': 5,
    'ai_response': 3
  };
  
  let totalValue = 0;
  const breakdown = {};
  
  behaviors.forEach(behavior => {
    const value = valueMap[behavior.event_type] || 10;
    const behaviorValue = value * behavior.count;
    totalValue += behaviorValue;
    
    if (valueMap[behavior.event_type]) {
      breakdown[behavior.event_type] = behaviorValue;
    }
  });
  
  return {
    total: totalValue,
    breakdown: breakdown,
    currency: 'USD',
    note: 'Estimated value based on typical B2B automation ROI'
  };
}

/**
 * 📞 Voice AI stats — queries vapi_call_logs directly
 */
async function getVoiceStats(customerId, dateRange) {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                              AS total_calls,
        COALESCE(SUM(duration_seconds), 0)   AS total_seconds,
        COALESCE(AVG(duration_seconds), 0)   AS avg_seconds,
        COUNT(CASE WHEN duration_seconds > 0 THEN 1 END) AS answered_calls
      FROM vapi_call_logs
      WHERE customer_id = $1
        AND started_at >= $2
        AND started_at <= $3
    `, [customerId, dateRange.start, dateRange.end]).catch(() => ({ rows: [] }));

    const row = result.rows[0] || {};
    const totalSeconds = parseInt(row.total_seconds || 0);
    const avgSeconds   = Math.round(parseFloat(row.avg_seconds || 0));

    return {
      totalCalls:           parseInt(row.total_calls || 0),
      answeredCalls:        parseInt(row.answered_calls || 0),
      totalMinutes:         Math.ceil(totalSeconds / 60),
      avgDurationSeconds:   avgSeconds,
      avgDurationFormatted: avgSeconds >= 60
        ? `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`
        : `${avgSeconds}s`,
    };
  } catch {
    return { totalCalls: 0, answeredCalls: 0, totalMinutes: 0, avgDurationSeconds: 0, avgDurationFormatted: '0s' };
  }
}

/**
 * 🎯 Helper functions
 */
function getDateRange(period) {
  const end = new Date();
  let start = new Date();
  
  switch(period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setMonth(end.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'all':
      start = new Date('2024-01-01');
      break;
    default:
      start.setMonth(end.getMonth() - 1);
  }
  
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function formatEventTypeLabel(eventType) {
  const labels = {
    // Legacy names (pre-Aug-2025 tracker)
    'hot_lead': '🔥 Hot Lead',
    'phone_request': '📞 Phone Request',
    'email_request': '✉️ Email Request',
    'appointment_scheduled': '📅 Appointment Booked',
    'follow_up': '🔄 Follow-up',
    'qualifying_questions': '❓ Qualifying Questions',
    // Current behavior-analyzer names
    'hot_lead_detected': '🔥 Hot Lead',
    'phone_requested': '📞 Phone Request',
    'appointment_offered': '📅 Scheduling Offered',
    'appointment_booked': '📅 Appointment Booked',
    'email_requested': '✉️ Email Request',
    'followup_offered': '🔄 Follow-up Offered',
    'qualifying_questions_asked': '❓ Qualifying Questions',
    'cta_included': '🎯 Call-to-Action',
    'contact_captured': '📝 Contact Captured',
    'document_sent': '📄 Document Sent',
    // Shared
    'pricing_discussed': '💰 Pricing Discussion',
    'demo_requested': '🖥️ Demo Request',
    'urgency_created': '⚡ Urgency Created',
    'advantages_highlighted': '✨ Advantages Highlighted',
    'message_received': '💬 Message Received',
    'ai_response': '🤖 AI Response',
    'custom_response': '💬 Custom Reply',
    'contact_form': '📝 Contact Form'
  };
  
  return labels[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Count real contacts captured in the date range
 */
async function getLeadsCount(customerId, dateRange) {
  try {
    const result = await query(`
      SELECT COUNT(*) as total_leads
      FROM contacts
      WHERE customer_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `, [customerId, dateRange.start, dateRange.end]);
    return parseInt(result.rows[0]?.total_leads || 0);
  } catch (error) {
    console.error('❌ Error getting leads count:', error.message);
    return 0;
  }
}

/**
 * Calculate average AI response time by pairing message_received → ai_response events
 */
async function getAvgResponseTime(customerId, channel, dateRange) {
  try {
    const channelFilter = channel !== 'all' ? 'AND ar.channel = $4' : '';
    const params = channel !== 'all'
      ? [customerId, dateRange.start, dateRange.end, channel]
      : [customerId, dateRange.start, dateRange.end];

    const result = await query(`
      WITH response_times AS (
        SELECT
          ar.created_at AS responded_at,
          (
            SELECT mr.created_at
            FROM ai_analytics_events mr
            WHERE mr.customer_id = ar.customer_id
              AND mr.event_type IN ('message_received', 'email_received', 'call_received')
              AND mr.channel = ar.channel
              AND mr.created_at <= ar.created_at
              AND mr.created_at >= ar.created_at - INTERVAL '10 minutes'
            ORDER BY mr.created_at DESC
            LIMIT 1
          ) AS received_at
        FROM ai_analytics_events ar
        WHERE ar.customer_id = $1
          AND ar.event_type = 'ai_response'
          AND ar.created_at >= $2
          AND ar.created_at <= $3
          ${channelFilter}
      )
      SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (responded_at - received_at)) / 60.0)::numeric, 1
      ) AS avg_minutes
      FROM response_times
      WHERE received_at IS NOT NULL
    `, params);

    const avg = parseFloat(result.rows[0]?.avg_minutes || 0);
    return isNaN(avg) ? 0 : avg;
  } catch (error) {
    console.error('❌ Error getting avg response time:', error.message);
    return 0;
  }
}

function getEmptyAnalytics() {
  return {
    period: 'month',
    overview: {
      effectiveness_score: 0,
      total_interactions_month: 0,
      interactions_today: 0,
      hot_leads_today: 0,
      hot_leads_month: 0,
      phone_requests_today: 0,
      phone_requests_month: 0,
      appointments_month: 0,
      ai_engagement_rate: 0,
      contact_capture_rate: 0,
      avg_response_speed_minutes: 0,
      total_leads_captured: 0
    },
    channels: [],
    behaviors: [],
    topBehaviors: [],
    insights: [],
    businessValue: { total: 0, breakdown: {} },
    dailyTrend: []
  };
}

/**
 * 🎯 SPECIALIZED FUNCTIONS FOR SPECIFIC CHANNELS
 */

// Email-specific analytics
export async function getEmailAnalytics(clerkUserId) {
  return getAnalytics({ clerkUserId, channel: 'email', period: 'month' });
}

// SMS-specific analytics
export async function getSMSAnalytics(clerkUserId) {
  return getAnalytics({ clerkUserId, channel: 'sms', period: 'month' });
}

// Chat-specific analytics
export async function getChatAnalytics(clerkUserId) {
  return getAnalytics({ clerkUserId, channel: 'chat', period: 'month' });
}

// Social media analytics
export async function getSocialAnalytics(clerkUserId) {
  return getAnalytics({ clerkUserId, channel: 'social', period: 'month' });
}

// Admin analytics
export async function getAdminAnalytics(period = 'month') {
  try {
    const dateRange = getDateRange(period);
    
    const result = await query(`
      SELECT 
        COUNT(DISTINCT customer_id) as active_customers,
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'hot_lead' THEN 1 END) as total_hot_leads,
        AVG(confidence_score) as avg_confidence,
        COUNT(DISTINCT channel) as active_channels
      FROM ai_analytics_events
      WHERE created_at >= $1 AND created_at <= $2
    `, [dateRange.start, dateRange.end]);
    
    return {
      success: true,
      metrics: result.rows[0],
      period: period,
      generated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Admin analytics error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export all functions
export default {
  getAnalytics,
  getEmailAnalytics,
  getSMSAnalytics,
  getChatAnalytics,
  getSocialAnalytics,
  getAdminAnalytics,
  getEmptyAnalytics
};
