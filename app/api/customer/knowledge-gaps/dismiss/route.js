import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCustomerByClerkId } from '@/lib/database.js';
import { dismissGapTopic } from '@/lib/knowledge-gaps-store.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic } = await request.json();
    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = await dismissGapTopic({ customerId: customer.id, topic });
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [GAPS API] dismiss failed:', error.message);
    return NextResponse.json({ error: 'Could not dismiss' }, { status: 500 });
  }
}
