import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database.js';
import { hasActiveAccess } from '@/lib/trial-access.js';

// Lightweight check the dashboard polls to know whether the trial has ended
// with no subscription — drives the "pick a plan" banner. Fails open
// (hasAccess: true) on any error so a DB hiccup never locks a real customer
// out of their own dashboard.
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await query(
      `SELECT id, stripe_subscription_id, created_at FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const customer = result.rows[0];
    if (!customer) {
      return NextResponse.json({ hasAccess: true });
    }

    return NextResponse.json({ hasAccess: hasActiveAccess(customer) });
  } catch (error) {
    console.error('❌ access-status error:', error.message);
    return NextResponse.json({ hasAccess: true });
  }
}
