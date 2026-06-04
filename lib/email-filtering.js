// lib/email-filtering.js
// Email filtering service that applies business rules and filtering settings
import { query } from './database';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Sender address patterns that are never real customers
const AUTOMATED_SENDER_PATTERNS = [
  /^(noreply|no-reply|do-not-reply|donotreply)@/i,
  /^(notifications?|alerts?|updates?|mailer|bounce|bounces)@/i,
  /^(system|automated|auto|robot|bot|daemon|postmaster)@/i,
  /^(support-noreply|reply-noreply|no\.reply)@/i,
  /(noreply|no-reply|donotreply)\+/i,
  /\+[a-f0-9]{16,}@/i  // Long hex hash in address (automated routing)
];

// Subdomains that signal automated/bulk sending (e.g. news.railway.app, notify.company.com)
// Only applied when the domain has 3+ parts, so uber.com is never affected
const AUTOMATED_SUBDOMAINS = [
  'news', 'notify', 'notifications', 'notification',
  'marketing', 'promo', 'promotional', 'promos',
  'noreply', 'no-reply', 'donotreply',
  'bounce', 'bounces', 'campaign', 'campaigns',
  'bulk', 'blast', 'em', 'e'
];

// Known marketing/transactional platforms — their emails are never customer inquiries
const KNOWN_AUTOMATED_DOMAINS = [
  'mailchimp.com', 'list-manage.com', 'mc.sendgrid.net', 'sendgrid.net',
  'constantcontact.com', 'klaviyo.com', 'hubspot.com', 'marketo.com',
  'salesforce.com', 'mailgun.org', 'amazonses.com', 'exacttarget.com',
  'bounce.linkedin.com', 'e.linkedin.com', 'em.reddit.com',
  'facebookmail.com', 'twitter.com', 'notifications.google.com',
  'stripe.com', 'mail.stripe.com', 'paypal.com', 'intuit.com',
  'notifications.slack.com', 'asana.com', 'trello.com'
];

// Subject patterns that indicate transactional/automated emails
const TRANSACTIONAL_SUBJECT_PATTERNS = [
  /^(your (receipt|invoice|order|booking|confirmation|statement|bill|payment|subscription))/i,
  /^(receipt|invoice) (for|from|#)/i,
  /^(order|booking) (confirmation|#)/i,
  /(has been (shipped|delivered|processed|confirmed|updated|cancelled))/i,
  /^(password reset|verify your email|confirm your|action required|security alert)/i,
  /^(welcome to|thanks for (signing up|joining|subscribing))/i,
  /^\[(notification|alert|update|info)\]/i
];

/**
 * Layer 1: Check email/domain headers for automated signals
 */
function checkAutomatedHeaders(headers = {}) {
  // Auto-Submitted is the RFC 3834 industry standard for automated emails
  const autoSubmitted = headers['auto-submitted'] || '';
  if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') {
    return { isAutomated: true, reason: 'Auto-Submitted header present' };
  }

  // Microsoft Exchange / Outlook automated email suppression
  if (headers['x-auto-response-suppress']) {
    return { isAutomated: true, reason: 'X-Auto-Response-Suppress header (Microsoft automated)' };
  }

  // Google adds Feedback-ID to bulk/marketing sends — log it but don't hard-block.
  // Some Google Workspace accounts also add this header to legitimate emails,
  // so we let the AI classifier make the final call instead of blocking outright.
  if (headers['feedback-id']) {
    console.log('⚠️ Feedback-ID header present — passing to AI classifier');
  }

  // X-Campaign-Id is added by email marketing tools
  if (headers['x-campaign-id'] || headers['x-campaign']) {
    return { isAutomated: true, reason: 'Marketing campaign header' };
  }

  // Known marketing platform mailers
  const xMailer = (headers['x-mailer'] || '').toLowerCase();
  const marketingMailers = ['mailchimp', 'constant contact', 'sendgrid', 'klaviyo', 'hubspot', 'marketo', 'campaign monitor'];
  if (marketingMailers.some(m => xMailer.includes(m))) {
    return { isAutomated: true, reason: `Marketing platform detected: ${xMailer}` };
  }

  return { isAutomated: false };
}

/**
 * Layer 1: Check sender address and domain
 */
function checkSenderPatterns(from) {
  const emailMatch = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  const senderEmail = (emailMatch ? emailMatch[1] || emailMatch[0] : from).toLowerCase();
  const senderDomain = senderEmail.split('@')[1] || '';

  for (const pattern of AUTOMATED_SENDER_PATTERNS) {
    if (pattern.test(senderEmail)) {
      return { isAutomated: true, reason: `Automated sender address pattern` };
    }
  }

  for (const domain of KNOWN_AUTOMATED_DOMAINS) {
    if (senderDomain === domain || senderDomain.endsWith(`.${domain}`)) {
      return { isAutomated: true, reason: `Known automated platform: ${domain}` };
    }
  }

  // Check for automation-indicating subdomains (e.g. news.railway.app, notify.company.com)
  // Only fires when domain has 3+ parts so root domains like uber.com are unaffected
  const domainParts = senderDomain.split('.');
  if (domainParts.length >= 3 && AUTOMATED_SUBDOMAINS.includes(domainParts[0].toLowerCase())) {
    return { isAutomated: true, reason: `Automated subdomain: ${senderDomain}` };
  }

  return { isAutomated: false };
}

/**
 * Layer 1: Check subject line for transactional patterns
 */
function checkTransactionalSubject(subject = '') {
  for (const pattern of TRANSACTIONAL_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      return { isAutomated: true, reason: 'Transactional/automated subject line' };
    }
  }
  return { isAutomated: false };
}

/**
 * Layer 3: AI classification for borderline emails that pass hard rules
 * Only runs if OpenAI is configured. Fails open (allows through if uncertain).
 */
async function classifyWithAI(from, subject, body) {
  if (!openai) return { isCustomerEmail: true, confidence: 50, reason: 'OpenAI not configured' };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an email classifier for a business AI assistant. Determine if an email is a genuine customer inquiry that deserves a personal business response.

Reply with JSON only: {"isCustomerEmail": true/false, "confidence": 0-100, "reason": "brief reason"}

Genuine customer emails: questions about services, requests for quotes, complaints, follow-ups, meeting requests, product inquiries.
NOT customer emails: newsletters, receipts, automated notifications, marketing campaigns, system alerts, delivery confirmations, subscription updates, social media notifications.

When uncertain, lean toward isCustomerEmail: true.`
        },
        {
          role: 'user',
          content: `From: ${from}\nSubject: ${subject}\nBody: ${body.substring(0, 600)}`
        }
      ],
      max_tokens: 80,
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`🤖 AI email classification: ${result.isCustomerEmail ? '✅ customer' : '🚫 automated'} (${result.confidence}% confidence) — ${result.reason}`);
    return result;
  } catch (error) {
    console.error('⚠️ AI email classification failed, allowing through:', error.message);
    return { isCustomerEmail: true, confidence: 50, reason: 'Classification failed — allowing through' };
  }
}

/**
 * Helper function to safely parse JSON
 */
function tryParseJSON(jsonString, defaultValue = []) {
  try {
    if (!jsonString) return defaultValue;
    if (typeof jsonString === 'object') return jsonString; // Already parsed
    if (Array.isArray(jsonString)) return jsonString; // Already an array
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON parse error:', e);
    return defaultValue;
  }
}

/**
 * Check if an email should be filtered based on business rules and settings
 * @param {Object} emailData - Email data to check (from, subject, body, headers, isMassEmail)
 * @param {Object} filterSettings - Customer's filter settings (can be null = use smart defaults)
 * @returns {Object} - Filter result with reason and action
 */
export async function checkEmailFilter(emailData, filterSettings) {
  const { from, subject, body, headers = {}, isMassEmail } = emailData;
  const settings = filterSettings || {};

  // Extract email address from "Name <email@domain.com>" format
  const emailMatch = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  const senderEmail = emailMatch ? emailMatch[1] || emailMatch[0] : from;
  const senderDomain = senderEmail.split('@')[1] || '';


  // Parse JSON fields safely
  const whitelist = tryParseJSON(settings.whitelist_emails, []);
  const blacklist = tryParseJSON(settings.blacklist_emails, []);
  const keywords = tryParseJSON(settings.priority_keywords, []);

  // ── STEP 1: Whitelist (always allow, skip all other checks) ──
  if (whitelist.length > 0) {
    for (const whitelistItem of whitelist) {
      if (isMatchingRule(senderEmail, senderDomain, whitelistItem)) {
        console.log('✅ Email whitelisted:', whitelistItem);
        return { shouldFilter: false, reason: 'whitelisted', matchedRule: whitelistItem };
      }
    }
  }

  // ── STEP 2: Blacklist (always block) ──
  if (blacklist.length > 0) {
    for (const blacklistItem of blacklist) {
      if (isMatchingRule(senderEmail, senderDomain, blacklistItem)) {
        console.log('🚫 Email blacklisted:', blacklistItem);
        return { shouldFilter: true, reason: 'blacklisted', filterType: 'blacklist', matchedRule: blacklistItem };
      }
    }
  }

  // ── STEP 3: Priority keywords — if matched, skip remaining filters and always reply ──
  if (keywords.length > 0) {
    const contentToCheck = `${subject} ${body}`.toLowerCase();
    for (const keyword of keywords) {
      if (contentToCheck.includes(keyword.toLowerCase())) {
        console.log('⭐ Priority keyword matched:', keyword);
        return { shouldFilter: false, isPriority: true, reason: 'priority keyword', matchedKeyword: keyword };
      }
    }
  }

  // ── LAYER 1: Hard automated-email detection (headers + sender + subject) ──
  // These signals are definitive — no AI check needed, just block them.

  const headerCheck = checkAutomatedHeaders(headers);
  if (headerCheck.isAutomated) {
    return { shouldFilter: true, reason: headerCheck.reason, filterType: 'automated_header' };
  }

  const senderCheck = checkSenderPatterns(from);
  if (senderCheck.isAutomated) {
    return { shouldFilter: true, reason: senderCheck.reason, filterType: 'automated_sender' };
  }

  const subjectCheck = checkTransactionalSubject(subject);
  if (subjectCheck.isAutomated) {
    return { shouldFilter: true, reason: subjectCheck.reason, filterType: 'transactional_subject' };
  }

  // ── LAYER 2: Mass email signals (List-Unsubscribe, List-Id, unsubscribe in body) ──
  if (isMassEmail) {
    return { shouldFilter: true, reason: 'mass email (newsletter or bulk send)', filterType: 'mass_email' };
  }

  // Catch unsubscribe links in body even without headers
  const bodyLower = (body || '').toLowerCase();
  if (bodyLower.includes('unsubscribe') || bodyLower.includes('email preferences') || bodyLower.includes('opt out')) {
    console.log('📧 Email contains unsubscribe language — filtered');
    return { shouldFilter: true, reason: 'contains unsubscribe/opt-out language', filterType: 'mass_email' };
  }

  // ── LAYER 2: Spam check ──
  if (settings.auto_archive_spam !== false) {
    const spamIndicators = checkSpamIndicators(from, subject, body);
    if (spamIndicators.isSpam) {
      console.log('🗑️ Spam detected:', spamIndicators.reason);
      return { shouldFilter: true, reason: spamIndicators.reason, filterType: 'spam', confidence: spamIndicators.confidence };
    }
  }

  // ── LAYER 3: AI classification for borderline emails ──
  // Only runs if email passed all hard rules above.
  // Blocks only if AI is highly confident (>75%) it's NOT a customer email.
  try {
    const aiResult = await classifyWithAI(from, subject, body);
    if (!aiResult.isCustomerEmail && aiResult.confidence >= 75) {
      console.log(`🤖 AI blocked non-customer email (${aiResult.confidence}% confident): ${aiResult.reason}`);
      return {
        shouldFilter: true,
        reason: `AI classification: ${aiResult.reason}`,
        filterType: 'ai_classified',
        confidence: aiResult.confidence
      };
    }
  } catch (aiError) {
    console.error('⚠️ AI filter layer failed — allowing email through:', aiError.message);
  }

  // Email passed all layers — reply to it
  console.log('✅ Email passed all filters — will respond');
  return { shouldFilter: false, reason: 'passed all filters' };
}

/**
 * Check if email/domain matches a rule
 */
function isMatchingRule(email, domain, rule) {
  if (!rule) return false;
  
  const ruleLower = rule.toLowerCase().trim();
  const emailLower = email.toLowerCase().trim();
  const domainLower = domain.toLowerCase().trim();
  
  // Check if it's a domain rule (starts with @ or is just a domain)
  if (ruleLower.startsWith('@')) {
    return domainLower === ruleLower.substring(1);
  } else if (!ruleLower.includes('@')) {
    // Assume it's a domain if no @ symbol
    // Check both exact match and subdomain match
    return domainLower === ruleLower || domainLower.endsWith(`.${ruleLower}`);
  } else {
    // It's a full email address
    return emailLower === ruleLower;
  }
}

/**
 * Check for spam indicators
 */
function checkSpamIndicators(from, subject, body) {
  let spamScore = 0;
  const reasons = [];
  
  // Handle empty inputs
  if (!subject) subject = '';
  if (!body) body = '';
  if (!from) from = '';
  
  // Common spam patterns in subject
  const spamSubjectPatterns = [
    /\b(viagra|cialis|pharmacy|pills|medication)\b/i,
    /\b(winner|won|prize|lottery|million|thousand)\s*(dollar|usd|\$)/i,
    /\b(free|100%|guarantee|act now|limited time|urgent)\b/i,
    /\b(click here|unsubscribe|opt.?out|remove me)\b/i,
    /💰|🎰|💊|💵|🤑/,
    /\b(crypto|bitcoin|investment opportunity)\b/i,
    /\b(work from home|make money|earn cash)\b/i
  ];
  
  // Check subject for spam patterns
  for (const pattern of spamSubjectPatterns) {
    if (pattern.test(subject)) {
      spamScore += 30;
      reasons.push('spam subject pattern');
      break;
    }
  }
  
  // Check for excessive capitals (only if subject has content)
  if (subject.length > 10) {
    const capitalRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (capitalRatio > 0.5) {
      spamScore += 20;
      reasons.push('excessive capitals');
    }
  }
  
  // Check for suspicious sender patterns
  const suspiciousSenderPatterns = [
    /no.?reply/i,
    /mailer.?daemon/i,
    /postmaster/i,
    /\d{5,}/  // Many numbers in email
  ];
  
  for (const pattern of suspiciousSenderPatterns) {
    if (pattern.test(from)) {
      spamScore += 15;
      reasons.push('suspicious sender');
      break;
    }
  }
  
  // Check body for spam content
  const spamBodyPatterns = [
    /\b(unsubscribe|stop receiving|opt.?out)\b/i,
    /\b(this is not spam|not junk mail)\b/i,
    /\b(risk.?free|money.?back|satisfaction guaranteed)\b/i
  ];
  
  const bodyLower = body.toLowerCase();
  for (const pattern of spamBodyPatterns) {
    if (pattern.test(bodyLower)) {
      spamScore += 10;
      reasons.push('spam body content');
      break;
    }
  }
  
  return {
    isSpam: spamScore >= 40,
    confidence: Math.min(spamScore, 100),
    reason: reasons.join(', ') || 'spam indicators'
  };
}

/**
 * Check for personal email indicators
 */
function checkPersonalIndicators(from, subject, body) {
  let personalScore = 0;
  const reasons = [];
  
  // Handle empty inputs
  if (!subject) subject = '';
  if (!body) body = '';
  if (!from) from = '';
  
  // Check for personal greeting patterns
  const personalGreetings = [
    /^(hi|hello|hey|dear)\s+\w+/i,
    /\b(thank you|thanks|appreciate)\b/i,
    /\b(looking forward|hope you|wondering if)\b/i
  ];
  
  const bodyLower = body.toLowerCase();
  for (const pattern of personalGreetings) {
    if (pattern.test(bodyLower)) {
      personalScore += 30;
      reasons.push('personal greeting');
      break;
    }
  }
  
  // Check for questions (indicates conversation)
  if (bodyLower.includes('?')) {
    personalScore += 20;
    reasons.push('contains questions');
  }
  
  // Check sender - personal emails usually from individual addresses
  const fromLower = from.toLowerCase();
  if (!fromLower.includes('noreply') && !fromLower.includes('no-reply') && 
      !fromLower.includes('newsletter') && !fromLower.includes('marketing')) {
    personalScore += 20;
    reasons.push('personal sender');
  }
  
  // Check subject length - personal emails tend to have shorter subjects
  if (subject.length < 100 && subject.length > 3) {
    personalScore += 15;
    reasons.push('appropriate subject length');
  }
  
  // Check for absence of marketing language
  const marketingPatterns = [
    /\b(sale|discount|offer|deal|save|buy now)\b/i,
    /\b(newsletter|update|announcement)\b/i,
    /\b(unsubscribe|preferences|email settings)\b/i
  ];
  
  let hasMarketing = false;
  for (const pattern of marketingPatterns) {
    if (pattern.test(bodyLower) || pattern.test(subject.toLowerCase())) {
      hasMarketing = true;
      break;
    }
  }
  
  if (!hasMarketing) {
    personalScore += 25;
    reasons.push('no marketing language');
  }
  
  return {
    isPersonal: personalScore >= 50,
    confidence: Math.min(personalScore, 100),
    reasons: reasons.join(', ')
  };
}

/**
 * Log filtered email to database
 */
export async function logFilteredEmail(customerId, gmailConnectionId, emailData, filterResult) {
  try {
    // Create the table if it doesn't exist
    await createFilterLogsTableIfNeeded();
    
    const logQuery = `
      INSERT INTO email_filter_logs (
        customer_id, gmail_connection_id, email_from, email_subject,
        filter_reason, filter_type, matched_rule, gmail_message_id, thread_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await query(logQuery, [
      customerId,
      gmailConnectionId || null,
      emailData.from || 'unknown',
      emailData.subject || 'No subject',
      filterResult.reason || 'unknown',
      filterResult.filterType || 'other',
      filterResult.matchedRule || null,
      emailData.messageId || null,
      emailData.threadId || null
    ]);
    
    console.log('📝 Logged filtered email');
  } catch (error) {
    console.error('Error logging filtered email:', error);
    // Don't throw - logging failure shouldn't break filtering
  }
}

/**
 * Create filter logs table if it doesn't exist
 */
async function createFilterLogsTableIfNeeded() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS email_filter_logs (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        gmail_connection_id INTEGER,
        email_from VARCHAR(255) NOT NULL,
        email_subject VARCHAR(500),
        filter_reason VARCHAR(255) NOT NULL,
        filter_type VARCHAR(100) NOT NULL,
        matched_rule TEXT,
        filtered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        gmail_message_id VARCHAR(255),
        thread_id VARCHAR(255)
      )
    `;
    await query(createTableQuery);
  } catch (error) {
    // Table might already exist, that's fine
    if (!error.message.includes('already exists')) {
      console.error('Error creating filter logs table:', error);
    }
  }
}

/**
 * Get filter statistics for a customer
 */
export async function getFilterStatistics(customerId, days = 7) {
  try {
    const statsQuery = `
      SELECT 
        filter_type,
        COUNT(*) as count,
        COUNT(DISTINCT email_from) as unique_senders
      FROM email_filter_logs
      WHERE customer_id = $1
        AND filtered_at >= NOW() - INTERVAL '${days} days'
      GROUP BY filter_type
      ORDER BY count DESC
    `;
    
    const result = await query(statsQuery, [customerId]);
    
    return {
      totalFiltered: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      byType: result.rows.map(row => ({
        type: row.filter_type,
        count: parseInt(row.count),
        uniqueSenders: parseInt(row.unique_senders)
      }))
    };
  } catch (error) {
    console.error('Error getting filter statistics:', error);
    return { totalFiltered: 0, byType: [] };
  }
}
