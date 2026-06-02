import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ connected: false });

    const result = await query(
      `SELECT outlook_email FROM outlook_connections
       WHERE user_id = $1 AND status = 'connected' LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) return NextResponse.json({ connected: false });

    return NextResponse.json({ connected: true, email: result.rows[0].outlook_email });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
