import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import twilio from 'twilio';
import { query } from '@/lib/database.js';
import { submitTollfreeVerification } from '@/lib/tollfree-verification.js';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TRIAL_DAYS = 14;

// A customer may provision a number if they have a Stripe subscription
// (paid or trialing) or are still within their 14-day signup trial.
function hasActiveAccess(customer) {
  if (!customer) return false;
  if (customer.stripe_subscription_id) return true;
  if (customer.created_at) {
    const ageMs = Date.now() - new Date(customer.created_at).getTime();
    if (ageMs < TRIAL_DAYS * 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS customer_phone_numbers (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      clerk_user_id TEXT,
      phone_number TEXT UNIQUE NOT NULL,
      twilio_sid TEXT,
      friendly_name TEXT,
      status TEXT DEFAULT 'available',
      assigned_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
}

// POST: buy a toll-free number on demand for the calling customer,
// then auto-submit toll-free verification with their business info.
// Numbers are purchased as needed — no pre-bought pool.
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!twilioClient) {
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
    }

    await ensureTable();

    // Already has a number — return it
    const existing = await query(
      `SELECT phone_number, twilio_sid, tfv_status FROM customer_phone_numbers
       WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    ).catch(async () => {
      // tfv columns may not exist yet on first run
      return query(
        `SELECT phone_number, twilio_sid FROM customer_phone_numbers
         WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      );
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: true,
        phoneNumber: existing.rows[0].phone_number,
        verificationStatus: existing.rows[0].tfv_status || null,
        alreadyAssigned: true
      });
    }

    const customerResult = await query(
      `SELECT id, business_name, created_at, stripe_subscription_id
       FROM customers WHERE clerk_user_id::text = $1 OR user_id::text = $1
       ORDER BY id ASC LIMIT 1`,
      [userId]
    );
    const customer = customerResult.rows[0];
    const customerId = customer?.id;

    // Gate: only paying/trialing customers can provision a number (which costs
    // money on BizzyBot's Twilio account). Allow an active Stripe subscription
    // or anyone still within their 14-day trial from signup.
    if (!hasActiveAccess(customer)) {
      return NextResponse.json({
        success: false,
        error: 'Your free trial has ended. Please choose a plan to activate your AI number.',
        needsSubscription: true,
      }, { status: 402 });
    }

    // Buy a toll-free number on demand (no A2P 10DLC needed — verification
    // is submitted per-number below and takes ~3-5 business days)
    const found = await twilioClient.availablePhoneNumbers('US').tollFree.list({
      smsEnabled: true,
      limit: 1
    });
    if (!found.length) {
      return NextResponse.json({
        success: false,
        error: 'No toll-free numbers available right now. Please contact support@bizzybotai.com.'
      }, { status: 503 });
    }

    const bought = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: found[0].phoneNumber,
      friendlyName: customer?.business_name ? `BizzyBot — ${customer.business_name}` : 'BizzyBot Customer',
      smsUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/sms/webhook`,
      smsMethod: 'POST'
    });

    // Enroll in the Messaging Service (sticky sender + unified sending)
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (messagingServiceSid) {
      await twilioClient.messaging.v1.services(messagingServiceSid).phoneNumbers.create({
        phoneNumberSid: bought.sid
      }).catch(err => console.error('⚠️ Messaging Service enroll failed:', err.message));
    }

    await query(
      `INSERT INTO customer_phone_numbers
         (phone_number, twilio_sid, friendly_name, status, clerk_user_id, customer_id, assigned_at)
       VALUES ($1, $2, $3, 'active', $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (phone_number) DO UPDATE SET
         status = 'active', clerk_user_id = $4, customer_id = $5,
         assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
      [bought.phoneNumber, bought.sid, bought.friendlyName, userId, customerId]
    );

    console.log(`✅ Bought and assigned ${bought.phoneNumber} to customer ${userId}`);

    // Submit toll-free verification with the customer's business info.
    // If their profile is missing required fields, this records 'needs_info'
    // instead of failing — the dashboard prompts them to complete it.
    let verification = { submitted: false, needsInfo: [] };
    try {
      verification = await submitTollfreeVerification({
        clerkUserId: userId,
        phoneNumberSid: bought.sid
      });
    } catch (err) {
      console.error('⚠️ TFV submission failed (non-fatal):', err.message);
    }

    // Fire-and-forget: provision Vapi voice assistant for this number
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/vapi/provision`, {
      method: 'POST',
      headers: { Cookie: request.headers.get('cookie') || '' },
    }).catch(err => console.error('⚠️ Vapi auto-provision failed:', err.message));

    return NextResponse.json({
      success: true,
      phoneNumber: bought.phoneNumber,
      verificationSubmitted: verification.submitted,
      verificationNeedsInfo: verification.needsInfo || [],
      message: verification.submitted
        ? 'Your number is being activated — texting goes live once verified (usually 1-5 business days).'
        : 'Number assigned! Complete your business profile to start verification.'
    });

  } catch (error) {
    console.error('❌ SMS provision error:', error);
    return NextResponse.json({ error: 'Failed to provision SMS number' }, { status: 500 });
  }
}

// GET: check if customer already has a number assigned + its verification status
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();

    const result = await query(
      `SELECT phone_number, assigned_at, tfv_status, tfv_approved_at FROM customer_phone_numbers
       WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    ).catch(async () => {
      return query(
        `SELECT phone_number, assigned_at FROM customer_phone_numbers
         WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      );
    });

    if (result.rows.length === 0) return NextResponse.json({ assigned: false });

    const row = result.rows[0];
    return NextResponse.json({
      assigned: true,
      phoneNumber: row.phone_number,
      assignedAt: row.assigned_at,
      verificationStatus: row.tfv_status || null,
      verified: row.tfv_status === 'TWILIO_APPROVED',
      verifiedAt: row.tfv_approved_at || null
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
