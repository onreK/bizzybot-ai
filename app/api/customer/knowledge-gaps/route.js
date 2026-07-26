import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCustomerByClerkId } from '@/lib/database.js';
import { getOpenGapsGrouped } from '@/lib/knowledge-gaps-store.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ groups: [] });

    const groups = await getOpenGapsGrouped(customer.id);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('❌ [GAPS API] list failed:', error.message);
    return NextResponse.json({ error: 'Could not load your queue' }, { status: 500 });
  }
}
