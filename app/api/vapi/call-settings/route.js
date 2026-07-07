import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function ensureColumns() {
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS forward_cell TEXT`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS call_mode TEXT DEFAULT 'human_first'`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS ring_seconds INTEGER DEFAULT 18`).catch(() => {});
}

// GET: current call-handling settings for the caller's number
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await ensureColumns();
    const r = await query(
      `SELECT forward_cell, call_mode, ring_seconds FROM customer_phone_numbers
       WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    const row = r.rows[0] || {};
    return NextResponse.json({
      success: true,
      forwardCell: row.forward_cell || '',
      callMode: row.call_mode || 'human_first',
      ringSeconds: row.ring_seconds ?? 18,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: update call-handling settings
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { forwardCell, callMode, ringSeconds } = await request.json();

    const mode = callMode === 'ai_first' ? 'ai_first' : 'human_first';
    const cell = (forwardCell || '').trim();
    const ring = Math.min(45, Math.max(5, parseInt(ringSeconds, 10) || 18));

    if (mode === 'human_first' && cell && cell.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Please enter a valid cell phone number' }, { status: 400 });
    }

    await ensureColumns();
    const result = await query(
      `UPDATE customer_phone_numbers
       SET forward_cell = $1, call_mode = $2, ring_seconds = $3, updated_at = CURRENT_TIMESTAMP
       WHERE clerk_user_id = $4 AND status = 'active'`,
      [cell || null, mode, ring, userId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'No active number found. Provision your SMS/voice number first.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, forwardCell: cell, callMode: mode, ringSeconds: ring });
  } catch (error) {
    console.error('❌ call-settings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
