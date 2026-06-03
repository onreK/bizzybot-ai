import { query } from './database.js';
import { PLAN_LIMITS } from './stripe.js';

// Map ai-service channel names to PLAN_LIMITS channel names
const CHANNEL_MAP = {
  gmail: 'email',
  email: 'email',
  sms:   'sms',
  chat:  'chat',
  facebook:  'facebook',
  instagram: 'instagram',
  voice:     'voice',
};

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS customer_usage (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      channel VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_cu_customer_id ON customer_usage(customer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cu_created_at  ON customer_usage(created_at)`);
}

async function getCustomerRecord(clerkUserId) {
  const result = await query(
    'SELECT id, plan FROM customers WHERE clerk_user_id = $1',
    [clerkUserId]
  );
  return result.rows[0] || null;
}

// Returns { count, limit, plan, remaining, overLimit }
export async function getMonthlyUsage(clerkUserId) {
  try {
    await ensureTable();
    const customer = await getCustomerRecord(clerkUserId);
    if (!customer) return { count: 0, limit: 300, plan: 'starter', remaining: 300, overLimit: false };

    const plan = customer.plan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const limit = limits.responsesPerMonth;

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM customer_usage
       WHERE customer_id = $1
       AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [customer.id]
    );

    const count = result.rows[0].count;
    return { count, limit, plan, remaining: Math.max(0, limit - count), overLimit: count >= limit };
  } catch (error) {
    console.error('❌ getMonthlyUsage error:', error);
    return { count: 0, limit: 300, plan: 'starter', remaining: 300, overLimit: false };
  }
}

// Returns { allowed, reason, upgradeMessage }
export async function checkCanRespond(clerkUserId, channel) {
  try {
    if (!clerkUserId) return { allowed: true }; // Can't check without ID — fail open

    await ensureTable();
    const customer = await getCustomerRecord(clerkUserId);
    if (!customer) return { allowed: true }; // New account edge case — fail open

    const plan = customer.plan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const mappedChannel = CHANNEL_MAP[channel] || channel;

    // Check monthly response pool (shared across all channels)
    const usage = await getMonthlyUsage(clerkUserId);
    if (usage.overLimit) {
      return {
        allowed: false,
        reason: 'monthly_limit_reached',
        upgradeMessage: `Thanks for reaching out! We'll get back to you shortly.`,
        ownerMessage: `You've used all ${usage.limit} AI responses this month. Upgrade at bizzybotai.com/pricing to keep responding automatically.`,
      };
    }

    return { allowed: true, remaining: usage.remaining };
  } catch (error) {
    console.error('❌ checkCanRespond error:', error);
    return { allowed: true }; // Fail open — never block customers due to a tracking bug
  }
}

// Call this after every successful AI response
export async function trackMessage(clerkUserId, channel) {
  try {
    await ensureTable();
    const customer = await getCustomerRecord(clerkUserId);
    if (!customer) return;

    const mappedChannel = CHANNEL_MAP[channel] || channel;
    await query(
      'INSERT INTO customer_usage (customer_id, channel) VALUES ($1, $2)',
      [customer.id, mappedChannel]
    );
  } catch (error) {
    // Never throw — a tracking failure must not break the AI response
    console.error('❌ trackMessage error:', error);
  }
}
