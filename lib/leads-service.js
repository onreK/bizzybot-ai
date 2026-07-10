// lib/leads-service.js
// COMPLETE VERSION WITH ALL FIXES - Ready to copy and paste
import { query } from './database';

/**
 * 🎯 Main function to get all leads from contacts table
 * MULTI-TENANT SAFE - Always filters by customer_id
 */
export async function getLeads({
  customerId,
  channel = 'all',
  temperatureFilter = 'all',
  searchTerm = '',
  sortBy = 'score',
  limit = 100,
  offset = 0
}) {
  try {
    // CRITICAL: Always validate customerId for multi-tenancy
    if (!customerId) {
      throw new Error('Customer ID is required for multi-tenant data access');
    }
    
    // Build the WHERE clause with customer_id ALWAYS first
    let whereConditions = ['c.customer_id = $1'];
    let params = [customerId];
    
    // Add channel filter
    if (channel !== 'all') {
      params.push(channel);
      whereConditions.push(`c.source_channel = $${params.length}`);
    }
    
    // Add temperature filter
    if (temperatureFilter !== 'all') {
      params.push(temperatureFilter);
      whereConditions.push(`c.lead_temperature = $${params.length}`);
    }
    
    // Add search filter
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      const searchParam = `$${params.length}`;
      whereConditions.push(`(
        c.name ILIKE ${searchParam}
        OR c.email ILIKE ${searchParam}
        OR c.phone ILIKE ${searchParam}
        OR c.company ILIKE ${searchParam}
      )`);
    }
    
    // Build ORDER BY clause
    let orderBy = 'c.lead_score DESC'; // Default
    switch (sortBy) {
      case 'recent':
        orderBy = 'c.last_interaction_at DESC NULLS LAST';
        break;
      case 'value':
        orderBy = 'c.potential_value DESC NULLS LAST';
        break;
      case 'name':
        orderBy = 'c.name ASC';
        break;
      case 'score':
      default:
        orderBy = 'c.lead_score DESC NULLS LAST';
    }
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM contacts c
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);
    
    // Get the leads with pagination
    params.push(limit);
    params.push(offset);
    
    const leadsQuery = `
      SELECT 
        c.id,
        c.customer_id,
        c.name,
        c.email,
        c.phone,
        c.company,
        c.title,
        c.location,
        COALESCE(c.lead_score, 0) as score,
        COALESCE(c.lead_temperature, 'cold') as temperature,
        COALESCE(c.lead_status, 'new') as status,
        COALESCE(c.potential_value, 0) as potential_value,
        c.first_interaction_at,
        c.last_interaction_at as last_interaction,
        COALESCE(c.total_interactions, 0) as interaction_count,
        COALESCE(c.hot_lead_count, 0) as hot_lead_count,
        COALESCE(c.appointment_count, 0) as appointment_count,
        COALESCE(c.phone_request_count, 0) as phone_request_count,
        COALESCE(c.source_channel, 'unknown') as primary_channel,
        c.channels_used,
        c.tags,
        c.created_at,
        -- Get recent events for this contact
        (
          SELECT COUNT(*)
          FROM ai_analytics_events e
          WHERE e.contact_id = c.id
            AND e.created_at >= CURRENT_DATE - INTERVAL '7 days'
        ) as recent_activity_count,
        -- Get last event type
        (
          SELECT e.event_type
          FROM ai_analytics_events e
          WHERE e.contact_id = c.id
          ORDER BY e.created_at DESC
          LIMIT 1
        ) as last_event_type
      FROM contacts c
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    
    const leadsResult = await query(leadsQuery, params);
    
    // FIXED: Calculate summary statistics without breaking the WHERE clause
    // Remove only the pagination params (last 2 params)
    const summaryParams = params.slice(0, params.length - 2);
    
    const summaryQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN lead_temperature = 'hot' THEN 1 END) as hot,
        COUNT(CASE WHEN lead_temperature = 'warm' THEN 1 END) as warm,
        COUNT(CASE WHEN lead_temperature = 'cold' THEN 1 END) as cold,
        COALESCE(SUM(potential_value), 0) as total_value,
        COALESCE(AVG(lead_score), 0) as avg_score
      FROM contacts c
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const summaryResult = await query(summaryQuery, summaryParams);
    const summary = {
      total: parseInt(summaryResult.rows[0].total) || 0,
      hot: parseInt(summaryResult.rows[0].hot) || 0,
      warm: parseInt(summaryResult.rows[0].warm) || 0,
      cold: parseInt(summaryResult.rows[0].cold) || 0,
      total_value: parseFloat(summaryResult.rows[0].total_value) || 0,
      avg_score: Math.round(parseFloat(summaryResult.rows[0].avg_score)) || 0,
      channels: {} // Will be populated if needed
    };
    
    // Count by channel if leads exist
    if (leadsResult.rows.length > 0) {
      leadsResult.rows.forEach(lead => {
        const channel = lead.primary_channel || 'unknown';
        if (!summary.channels[channel]) {
          summary.channels[channel] = 0;
        }
        summary.channels[channel]++;
      });
    }
    
    // Format leads for compatibility with UI
    const formattedLeads = leadsResult.rows.map(lead => ({
      ...lead,
      // Ensure all expected fields exist with defaults
      score: lead.score || 0,
      temperature: lead.temperature || 'cold',
      status: lead.status || 'new',
      potential_value: lead.potential_value || 0,
      last_interaction: lead.last_interaction || lead.created_at,
      interaction_count: lead.interaction_count || 0,
      primary_channel: lead.primary_channel || 'unknown'
    }));
    
    return {
      success: true,
      leads: formattedLeads,
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      summary,
      filters_applied: {
        channel,
        temperature: temperatureFilter,
        search: searchTerm,
        sort: sortBy
      }
    };
    
  } catch (error) {
    console.error('❌ Error in getLeads:', error);
    return {
      success: false,
      error: error.message,
      leads: [],
      summary: {
        total: 0,
        hot: 0,
        warm: 0,
        cold: 0,
        total_value: 0,
        avg_score: 0,
        channels: {}
      }
    };
  }
}

/**
 * 📊 Get a single lead's complete history
 * MULTI-TENANT SAFE - Validates customer_id ownership
 */
export async function getLeadDetails(customerId, contactId) {
  try {
    // CRITICAL: Verify the contact belongs to this customer
    const contactResult = await query(`
      SELECT * FROM contacts 
      WHERE id = $1 AND customer_id = $2
    `, [contactId, customerId]);
    
    if (contactResult.rows.length === 0) {
      return {
        success: false,
        error: 'Contact not found or access denied'
      };
    }
    
    const contact = contactResult.rows[0];
    
    // Get all interactions for this contact
    const interactions = await query(`
      SELECT 
        e.id,
        e.event_type,
        e.channel,
        e.user_message,
        e.ai_response,
        e.metadata,
        e.confidence_score,
        e.created_at
      FROM ai_analytics_events e
      WHERE e.contact_id = $1 AND e.customer_id = $2
      ORDER BY e.created_at DESC
      LIMIT 100
    `, [contactId, customerId]);
    
    // Get contact events
    const events = await query(`
      SELECT * FROM contact_events
      WHERE contact_id = $1 AND customer_id = $2
      ORDER BY created_at DESC
      LIMIT 50
    `, [contactId, customerId]);
    
    // Build timeline
    const timeline = buildLeadTimeline(interactions.rows, events.rows);
    
    return {
      success: true,
      lead: {
        ...contact,
        interactions: interactions.rows,
        events: events.rows,
        timeline: timeline
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting lead details:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🎯 Calculate lead score (0-100)
 * Centralized scoring algorithm used everywhere
 */
const AUTOMATED_SENDER_PREFIXES = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'notifications', 'notification', 'mailer-daemon', 'postmaster',
  'bounce', 'auto-reply', 'autoreply'
];

function isAutomatedSender(email) {
  if (!email) return false;
  const local = email.toLowerCase().split('@')[0];
  return AUTOMATED_SENDER_PREFIXES.some(prefix => local === prefix || local.startsWith(prefix + '.') || local.startsWith(prefix + '+'));
}

export function calculateLeadScore(lead) {
  // Automated senders that slip through filtering should never score
  if (isAutomatedSender(lead.email)) return 0;

  let score = 0;

  // 1. Engagement Signals (40 points max)
  const engagementScore = calculateEngagementScore(lead);
  score += engagementScore;
  
  // 2. Recency Score (20 points max)
  const recencyScore = calculateRecencyScore(lead.last_interaction || lead.last_interaction_at || lead.last_event);
  score += recencyScore;
  
  // 3. Contact Completeness (20 points max)
  const contactScore = calculateContactCompletenessScore(lead);
  score += contactScore;
  
  // 4. Interaction Frequency (20 points max)
  const frequencyScore = calculateFrequencyScore(lead.interaction_count || lead.total_interactions || 0);
  score += frequencyScore;
  
  // Ensure score is between 0-100
  return Math.min(Math.max(score, 0), 100);
}

/**
 * 🌡️ Classify lead temperature based on score and signals
 */
export function classifyLeadTemperature(score, lead) {
  // Hot leads: High score OR strong buying signals
  if (score >= 70 || 
      lead.hot_lead_count > 0 || 
      lead.appointment_count > 0) {
    return 'hot';
  }
  
  // Warm leads: Medium score OR interest signals
  if (score >= 40 || 
      lead.phone_request_count > 0 || 
      lead.pricing_discussion_count > 0) {
    return 'warm';
  }
  
  // Cold leads: Low engagement
  return 'cold';
}

/**
 * 💰 Estimate potential value based on engagement
 */
export function estimateLeadValue(lead) {
  // Based on your pricing: $97 (basic), $197 (growth), $297 (pro), $497 (premium)
  
  if (lead.appointment_count > 0) {
    return 497; // Likely premium customer
  }
  
  if (lead.hot_lead_count > 0) {
    return 297; // Likely pro customer
  }
  
  if (lead.pricing_discussion_count > 0) {
    return 197; // Likely growth customer
  }
  
  return 97; // Potential basic customer
}

/**
 * 🔍 Identify and merge duplicate leads
 */
export async function resolveLeadIdentity(customerId, email, phone, name) {
  try {
    // Check for existing contacts with same identifiers
    const matches = await query(`
      SELECT DISTINCT
        email,
        phone,
        name
      FROM contacts
      WHERE customer_id = $1
        AND (
          email = $2
          OR phone = $3
          OR (
            name = $4
            AND $4 != ''
          )
        )
    `, [customerId, email, phone, name]);
    
    // Return merged identity
    return {
      email: email || matches.rows[0]?.email,
      phone: phone || matches.rows[0]?.phone,
      name: name || matches.rows[0]?.name,
      is_duplicate: matches.rows.length > 1
    };
    
  } catch (error) {
    console.error('Error resolving lead identity:', error);
    return { email, phone, name, is_duplicate: false };
  }
}

/**
 * 📧 Track new lead event
 */
export async function trackLeadEvent(customerId, eventData) {
  try {
    const { type, channel, email, phone, name, company, message } = eventData;
    
    // First, create or update the contact
    const contactResult = await createOrUpdateContact(customerId, {
      email,
      phone,
      name,
      company,
      source_channel: channel
    });
    
    if (!contactResult.success) {
      throw new Error('Failed to create/update contact');
    }
    
    const contactId = contactResult.contact.id;
    
    // Track the event with the contact
    await trackLeadEventWithContact(customerId, contactId, {
      type,
      channel,
      message,
      metadata: {
        contact_email: email,
        contact_phone: phone,
        contact_name: name,
        company: company
      }
    });
    
    return { success: true, lead_identity: contactResult.contact };
    
  } catch (error) {
    console.error('Error tracking lead event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 📥 Record a real inbound message from a channel that has no built-in
 * contact identity (social DMs, web chat). Logs a message_received event so
 * Analytics counts the interaction, and if the text contains an email or
 * phone number, promotes the sender to a contact.
 */
export async function captureInboundMessage(customerId, { channel, text, metadata = {} }) {
  try {
    await query(`
      INSERT INTO ai_analytics_events
      (customer_id, event_type, metadata, user_message, channel, confidence_score, created_at)
      VALUES ($1, 'message_received', $2, $3, $4, 1.0, CURRENT_TIMESTAMP)
    `, [customerId, JSON.stringify(metadata), (text || '').substring(0, 1000), channel]);

    const email = text?.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] || null;
    const rawPhone = text?.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] || null;
    const phone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : null;

    if (email || phone) {
      await trackLeadEvent(customerId, {
        type: 'contact_captured',
        channel,
        email,
        phone,
        message: (text || '').substring(0, 500),
      });
    }

    return { success: true, contactCaptured: !!(email || phone) };
  } catch (error) {
    console.error(`❌ Error capturing inbound ${channel} message:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 🎯 Create or update a contact
 * MULTI-TENANT SAFE - Creates within customer's scope
 */
export async function createOrUpdateContact(customerId, contactData) {
  try {
    const {
      email,
      phone,
      name,
      company,
      title,
      location,
      source_channel,
      tags
    } = contactData;
    
    // Check if contact exists (by email or phone)
    let existingContact = null;
    
    if (email) {
      const emailCheck = await query(`
        SELECT * FROM contacts 
        WHERE customer_id = $1 AND email = $2
      `, [customerId, email]);
      existingContact = emailCheck.rows[0];
    }
    
    if (!existingContact && phone) {
      const phoneCheck = await query(`
        SELECT * FROM contacts 
        WHERE customer_id = $1 AND phone = $2
      `, [customerId, phone]);
      existingContact = phoneCheck.rows[0];
    }
    
    if (existingContact) {
      // Update existing contact
      const updateResult = await query(`
        UPDATE contacts SET
          name = COALESCE($1, name),
          company = COALESCE($2, company),
          title = COALESCE($3, title),
          location = COALESCE($4, location),
          email = COALESCE($5, email),
          phone = COALESCE($6, phone),
          tags = CASE 
            WHEN $7::text[] IS NOT NULL 
            THEN ARRAY(SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || $7::text[]))
            ELSE tags 
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND customer_id = $9
        RETURNING *
      `, [
        name, company, title, location,
        email, phone, tags,
        existingContact.id, customerId
      ]);
      
      return {
        success: true,
        contact: updateResult.rows[0],
        action: 'updated'
      };
      
    } else {
      // Create new contact
      const insertResult = await query(`
        INSERT INTO contacts (
          customer_id, email, phone, name, company, 
          title, location, source_channel, tags,
          first_interaction_at, last_interaction_at,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        customerId, email, phone, name || 'Unknown',
        company, title, location, source_channel, tags
      ]);
      
      return {
        success: true,
        contact: insertResult.rows[0],
        action: 'created'
      };
    }
    
  } catch (error) {
    console.error('❌ Error creating/updating contact:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🔄 Update lead score and temperature
 * MULTI-TENANT SAFE - Updates within customer scope
 */
export async function updateLeadScoring(customerId, contactId) {
  try {
    // Get contact with latest metrics
    const contact = await query(`
      SELECT 
        c.*,
        COUNT(e.id) as total_events,
        MAX(e.created_at) as last_event
      FROM contacts c
      LEFT JOIN ai_analytics_events e ON e.contact_id = c.id
      WHERE c.id = $1 AND c.customer_id = $2
      GROUP BY c.id
    `, [contactId, customerId]);
    
    if (contact.rows.length === 0) {
      throw new Error('Contact not found');
    }
    
    const lead = contact.rows[0];
    
    // Calculate new score
    const score = calculateLeadScore(lead);
    const temperature = classifyLeadTemperature(score, lead);
    const value = estimateLeadValue(lead);
    
    // Update the contact
    await query(`
      UPDATE contacts SET
        lead_score = $1,
        lead_temperature = $2,
        potential_value = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND customer_id = $5
    `, [score, temperature, value, contactId, customerId]);
    
    return {
      success: true,
      score,
      temperature,
      potential_value: value
    };
    
  } catch (error) {
    console.error('❌ Error updating lead scoring:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 📈 Track a new lead event with contact ID
 * MULTI-TENANT SAFE - Creates events within customer scope
 */
export async function trackLeadEventWithContact(customerId, contactId, eventData) {
  try {
    const { type, channel, message, ai_response, metadata, confidence_score } = eventData;
    
    // Verify contact belongs to customer
    const contactCheck = await query(
      'SELECT id FROM contacts WHERE id = $1 AND customer_id = $2',
      [contactId, customerId]
    );
    
    if (contactCheck.rows.length === 0) {
      throw new Error('Contact not found or access denied');
    }
    
    // Insert event into ai_analytics_events
    await query(`
      INSERT INTO ai_analytics_events (
        customer_id, contact_id, event_type, channel,
        user_message, ai_response, metadata, confidence_score,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    `, [
      customerId, contactId, type, channel,
      message, ai_response, metadata, confidence_score
    ]);
    
    // Update contact metrics
    const updateMetrics = {
      'hot_lead': 'hot_lead_count = COALESCE(hot_lead_count, 0) + 1',
      'appointment_scheduled': 'appointment_count = COALESCE(appointment_count, 0) + 1',
      'phone_request': 'phone_request_count = COALESCE(phone_request_count, 0) + 1'
    };
    
    if (updateMetrics[type]) {
      await query(`
        UPDATE contacts SET
          ${updateMetrics[type]},
          total_interactions = COALESCE(total_interactions, 0) + 1,
          last_interaction_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND customer_id = $2
      `, [contactId, customerId]);
    } else {
      await query(`
        UPDATE contacts SET
          total_interactions = COALESCE(total_interactions, 0) + 1,
          last_interaction_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND customer_id = $2
      `, [contactId, customerId]);
    }
    
    // Update lead scoring
    await updateLeadScoring(customerId, contactId);
    
    // Track in contact_events for detailed history
    const scoreImpact = calculateScoreImpact(type);
    await query(`
      INSERT INTO contact_events (
        customer_id, contact_id, event_type, event_category,
        channel, description, metadata, score_impact, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    `, [
      customerId, contactId, type,
      categorizeEvent(type), channel,
      `${type} via ${channel}`, metadata, scoreImpact
    ]);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error tracking lead event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔍 Search for duplicate contacts
 * MULTI-TENANT SAFE - Searches within customer scope
 */
export async function findDuplicateContacts(customerId, limit = 50) {
  try {
    const duplicates = await query(`
      WITH duplicate_groups AS (
        SELECT 
          LOWER(TRIM(name)) as normalized_name,
          email,
          phone,
          COUNT(*) as duplicate_count,
          ARRAY_AGG(id ORDER BY created_at) as contact_ids,
          ARRAY_AGG(name) as names,
          ARRAY_AGG(company) as companies
        FROM contacts
        WHERE customer_id = $1
        GROUP BY LOWER(TRIM(name)), email, phone
        HAVING COUNT(*) > 1
      )
      SELECT * FROM duplicate_groups
      ORDER BY duplicate_count DESC
      LIMIT $2
    `, [customerId, limit]);
    
    return {
      success: true,
      duplicates: duplicates.rows
    };
    
  } catch (error) {
    console.error('❌ Error finding duplicates:', error);
    return {
      success: false,
      error: error.message,
      duplicates: []
    };
  }
}

/**
 * 🔀 Merge duplicate contacts
 * MULTI-TENANT SAFE - Merges within customer scope
 */
export async function mergeContacts(customerId, primaryContactId, duplicateContactIds) {
  try {
    // Begin transaction
    await query('BEGIN');
    
    // Verify all contacts belong to this customer
    const verifyResult = await query(`
      SELECT id FROM contacts 
      WHERE customer_id = $1 
        AND id = ANY($2::int[])
    `, [customerId, [primaryContactId, ...duplicateContactIds]]);
    
    if (verifyResult.rows.length !== duplicateContactIds.length + 1) {
      throw new Error('Some contacts not found or access denied');
    }
    
    // Update all events to point to primary contact
    for (const duplicateId of duplicateContactIds) {
      await query(`
        UPDATE ai_analytics_events 
        SET contact_id = $1 
        WHERE contact_id = $2 AND customer_id = $3
      `, [primaryContactId, duplicateId, customerId]);
      
      await query(`
        UPDATE contact_events 
        SET contact_id = $1 
        WHERE contact_id = $2 AND customer_id = $3
      `, [primaryContactId, duplicateId, customerId]);
    }
    
    // Aggregate metrics from duplicates to primary
    const metricsResult = await query(`
      SELECT 
        SUM(COALESCE(total_interactions, 0)) as total_interactions,
        SUM(COALESCE(hot_lead_count, 0)) as hot_lead_count,
        SUM(COALESCE(appointment_count, 0)) as appointment_count,
        SUM(COALESCE(phone_request_count, 0)) as phone_request_count
      FROM contacts
      WHERE id = ANY($1::int[]) AND customer_id = $2
    `, [duplicateContactIds, customerId]);
    
    const metrics = metricsResult.rows[0];
    
    // Update primary contact with aggregated metrics
    await query(`
      UPDATE contacts SET
        total_interactions = COALESCE(total_interactions, 0) + $1,
        hot_lead_count = COALESCE(hot_lead_count, 0) + $2,
        appointment_count = COALESCE(appointment_count, 0) + $3,
        phone_request_count = COALESCE(phone_request_count, 0) + $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND customer_id = $6
    `, [
      metrics.total_interactions || 0,
      metrics.hot_lead_count || 0,
      metrics.appointment_count || 0,
      metrics.phone_request_count || 0,
      primaryContactId,
      customerId
    ]);
    
    // Delete duplicate contacts
    await query(`
      DELETE FROM contacts
      WHERE id = ANY($1::int[]) AND customer_id = $2
    `, [duplicateContactIds, customerId]);
    
    // Commit transaction
    await query('COMMIT');
    
    // Update scoring for primary contact
    await updateLeadScoring(customerId, primaryContactId);
    
    return {
      success: true,
      merged_count: duplicateContactIds.length,
      primary_contact_id: primaryContactId
    };
    
  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error merging contacts:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 📊 Get lead analytics and insights
 * MULTI-TENANT SAFE - Analytics scoped to customer
 */
export async function getLeadAnalytics(customerId, period = '30d') {
  try {
    // Calculate date range
    const days = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Using CASE statements for PostgreSQL compatibility
    const analytics = await query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_leads,
        COUNT(DISTINCT CASE 
          WHEN c.lead_temperature = 'hot' 
          THEN c.id
        END) as hot_leads,
        COUNT(DISTINCT CASE 
          WHEN c.appointment_count > 0 
          THEN c.id
        END) as appointments_scheduled,
        SUM(COALESCE(c.total_interactions, 0)) as total_interactions,
        AVG(COALESCE(c.lead_score, 0)) as avg_lead_score,
        SUM(COALESCE(c.potential_value, 0)) as total_potential_value,
        ARRAY_AGG(DISTINCT c.source_channel) FILTER (WHERE c.source_channel IS NOT NULL) as channels_used
      FROM contacts c
      WHERE c.customer_id = $1
        AND c.created_at >= $2
    `, [customerId, startDate]);
    
    return {
      success: true,
      analytics: analytics.rows[0],
      period: period,
      insights: generateLeadInsights(analytics.rows[0])
    };
    
  } catch (error) {
    console.error('Error getting lead analytics:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate engagement score component
 */
function calculateEngagementScore(lead) {
  let score = 0;
  
  if (lead.hot_lead_count > 0) score += 20;
  if (lead.appointment_count > 0) score += 15;
  if (lead.phone_request_count > 0) score += 10;
  if (lead.pricing_discussion_count > 0) score += 10;
  
  return Math.min(score, 40);
}

/**
 * Calculate recency score component
 */
function calculateRecencyScore(lastInteraction) {
  if (!lastInteraction) return 0;
  
  const daysSinceContact = Math.floor(
    (new Date() - new Date(lastInteraction)) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceContact === 0) return 20;
  if (daysSinceContact <= 1) return 15;
  if (daysSinceContact <= 3) return 10;
  if (daysSinceContact <= 7) return 5;
  return 0;
}

/**
 * Calculate contact completeness score
 */
function calculateContactCompletenessScore(lead) {
  let score = 0;
  
  if (lead.email) score += 10;
  if (lead.phone) score += 10;
  
  return score;
}

/**
 * Calculate frequency score component
 */
function calculateFrequencyScore(interactionCount) {
  if (interactionCount >= 10) return 20;
  if (interactionCount >= 5) return 15;
  if (interactionCount >= 3) return 10;
  if (interactionCount >= 1) return 5;
  return 0;
}

/**
 * Build timeline of lead interactions
 */
function buildLeadTimeline(interactions, events) {
  const timeline = [];
  
  // Add interactions
  interactions.forEach(i => {
    timeline.push({
      type: 'interaction',
      date: i.created_at,
      event_type: i.event_type,
      channel: i.channel,
      message: i.user_message,
      response: i.ai_response,
      metadata: i.metadata
    });
  });
  
  // Add events
  events.forEach(e => {
    timeline.push({
      type: 'event',
      date: e.created_at,
      event_type: e.event_type,
      category: e.event_category,
      description: e.description,
      metadata: e.metadata
    });
  });
  
  // Sort by date
  return timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Calculate score impact for event types
 */
function calculateScoreImpact(eventType) {
  const impacts = {
    'hot_lead': 20,
    'appointment_scheduled': 15,
    'phone_request': 10,
    'email_request': 5,
    'pricing_discussed': 8,
    'demo_requested': 12,
    'contact_captured': 3
  };
  return impacts[eventType] || 1;
}

/**
 * Categorize event types
 */
function categorizeEvent(eventType) {
  const categories = {
    'hot_lead': 'conversion',
    'appointment_scheduled': 'conversion',
    'phone_request': 'engagement',
    'email_request': 'engagement',
    'message_received': 'communication',
    'ai_response': 'communication'
  };
  return categories[eventType] || 'engagement';
}

/**
 * Generate insights from lead analytics data
 */
function generateLeadInsights(analytics) {
  const insights = [];
  
  if (analytics.hot_leads > 0) {
    insights.push({
      type: 'success',
      message: `You have ${analytics.hot_leads} hot leads ready for immediate follow-up!`
    });
  }
  
  if (analytics.appointments_scheduled > 0) {
    insights.push({
      type: 'success',
      message: `${analytics.appointments_scheduled} appointments scheduled - great conversion!`
    });
  }
  
  const conversionRate = analytics.total_leads > 0 
    ? (analytics.appointments_scheduled / analytics.total_leads * 100).toFixed(1)
    : 0;
    
  if (conversionRate > 10) {
    insights.push({
      type: 'success',
      message: `Your ${conversionRate}% conversion rate is excellent!`
    });
  } else if (conversionRate < 5 && analytics.total_leads > 10) {
    insights.push({
      type: 'warning',
      message: `Consider improving follow-up - conversion rate is only ${conversionRate}%`
    });
  }
  
  return insights;
}

// Export all functions
export default {
  getLeads,
  getLeadDetails,
  calculateLeadScore,
  classifyLeadTemperature,
  estimateLeadValue,
  resolveLeadIdentity,
  trackLeadEvent,
  createOrUpdateContact,
  updateLeadScoring,
  trackLeadEventWithContact,
  findDuplicateContacts,
  mergeContacts,
  getLeadAnalytics
};
