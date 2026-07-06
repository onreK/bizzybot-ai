import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VERSION = 'db-audit-v2';

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

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

// One-time heal: align user_id with clerk_user_id on legacy rows.
async function healUserIds() {
  const countMismatched = async () => {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM customers WHERE clerk_user_id::text <> user_id::text`
    );
    return r.rows[0]?.n ?? 0;
  };

  const mismatchedBefore = await countMismatched();
  const result = await query(
    `UPDATE customers
     SET user_id = clerk_user_id, updated_at = NOW()
     WHERE clerk_user_id IS NOT NULL
       AND clerk_user_id::text <> ''
       AND clerk_user_id::text <> user_id::text`
  );
  const mismatchedAfter = await countMismatched();

  return { healed: result.rowCount ?? 0, mismatchedBefore, mismatchedAfter };
}

async function runAudit() {
  const out = { version: VERSION };

  out.customerColumnTypes = (await query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name IN ('id','user_id','clerk_user_id')
     ORDER BY column_name`
  ).catch((e) => ({ rows: [{ error: e.message }] }))).rows;

  out.totals = (await query(
    `SELECT
       COUNT(*)::int AS total_customers,
       COUNT(*) FILTER (WHERE clerk_user_id IS NULL OR clerk_user_id::text = '')::int AS null_clerk_id,
       COUNT(*) FILTER (WHERE user_id IS NULL OR user_id::text = '')::int AS null_user_id,
       COUNT(*) FILTER (WHERE clerk_user_id::text <> user_id::text)::int AS mismatched_ids
     FROM customers`
  ).catch((e) => ({ rows: [{ error: e.message }] }))).rows[0];

  out.duplicateClerkIds = (await query(
    `SELECT clerk_user_id::text AS clerk_user_id, COUNT(*)::int AS rows
     FROM customers
     WHERE clerk_user_id IS NOT NULL AND clerk_user_id::text <> ''
     GROUP BY clerk_user_id::text HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC LIMIT 25`
  ).catch((e) => ({ rows: [{ error: e.message }] }))).rows;

  return out;
}

export async function GET(request) {
  try {
    const { userId } = auth();
    if (!(await isAdmin(userId))) return json({ error: 'Unauthorized', version: VERSION }, 401);

    const action = new URL(request.url).searchParams.get('action');
    if (action === 'heal') {
      const heal = await healUserIds();
      return json({ success: true, version: VERSION, heal, ranAt: new Date().toISOString() });
    }

    const audit = await runAudit();
    return json({ success: true, version: VERSION, audit, ranAt: new Date().toISOString() });
  } catch (error) {
    return json({ success: false, version: VERSION, error: error.message }, 500);
  }
}

export async function POST() {
  try {
    const { userId } = auth();
    if (!(await isAdmin(userId))) return json({ error: 'Unauthorized', version: VERSION }, 401);
    const heal = await healUserIds();
    return json({ success: true, version: VERSION, heal, ranAt: new Date().toISOString() });
  } catch (error) {
    return json({ success: false, version: VERSION, error: error.message }, 500);
  }
}
