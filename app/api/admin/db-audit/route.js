import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function isAdmin(userId) {
  if (!userId) return false;
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    return email === 'kernopay@gmail.com' || email === process.env.ADMIN_EMAIL;
  } catch {
    return false;
  }
}

// GET: read-only health audit of the customers table and key data integrity.
// Admin only. Surfaces the dual-ID / duplicate-row issues behind recent bugs.
export async function GET() {
  try {
    const { userId } = auth();
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const out = {};

    // Column types for customers.id / user_id / clerk_user_id
    out.customerColumnTypes = (await query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'customers' AND column_name IN ('id','user_id','clerk_user_id')
       ORDER BY column_name`
    ).catch((e) => ({ rows: [{ error: e.message }] }))).rows;

    // Row counts and integrity checks
    out.totals = (await query(
      `SELECT
         COUNT(*) AS total_customers,
         COUNT(*) FILTER (WHERE clerk_user_id IS NULL OR clerk_user_id::text = '') AS null_clerk_id,
         COUNT(*) FILTER (WHERE user_id IS NULL OR user_id::text = '') AS null_user_id,
         COUNT(*) FILTER (WHERE clerk_user_id::text <> user_id::text) AS mismatched_ids
       FROM customers`
    ).catch((e) => ({ rows: [{ error: e.message }] }))).rows[0];

    // Duplicate customer rows sharing a clerk_user_id
    out.duplicateClerkIds = (await query(
      `SELECT clerk_user_id::text AS clerk_user_id, COUNT(*) AS rows
       FROM customers
       WHERE clerk_user_id IS NOT NULL AND clerk_user_id::text <> ''
       GROUP BY clerk_user_id::text
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 25`
    ).catch((e) => ({ rows: [{ error: e.message }] }))).rows;

    // Business profiles orphaned or missing user_id
    out.businessProfiles = (await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE customer_id IS NULL) AS null_customer_id
       FROM business_profiles`
    ).catch((e) => ({ rows: [{ error: e.message }] }))).rows[0];

    // Phone numbers without a linked customer_id
    out.phoneNumbers = (await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE customer_id IS NULL) AS null_customer_id,
         COUNT(*) FILTER (WHERE status = 'active') AS active
       FROM customer_phone_numbers`
    ).catch((e) => ({ rows: [{ error: e.message }] }))).rows[0];

    return NextResponse.json({ success: true, audit: out, ranAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: one-time heal — make user_id consistent with clerk_user_id on any
// rows where they diverged (legacy rows left user_id at its 'default_user'
// default). Admin only. Safe + idempotent.
export async function POST() {
  try {
    const { userId } = auth();
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const before = (await query(
      `SELECT COUNT(*) FILTER (WHERE clerk_user_id::text <> user_id::text) AS mismatched
       FROM customers`
    ).catch(() => ({ rows: [{ mismatched: 'error' }] }))).rows[0];

    const result = await query(
      `UPDATE customers
       SET user_id = clerk_user_id, updated_at = NOW()
       WHERE clerk_user_id IS NOT NULL
         AND clerk_user_id::text <> ''
         AND clerk_user_id::text <> user_id::text`
    );

    const after = (await query(
      `SELECT COUNT(*) FILTER (WHERE clerk_user_id::text <> user_id::text) AS mismatched
       FROM customers`
    ).catch(() => ({ rows: [{ mismatched: 'error' }] }))).rows[0];

    return NextResponse.json({
      success: true,
      healed: result.rowCount ?? 0,
      mismatchedBefore: before.mismatched,
      mismatchedAfter: after.mismatched,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
