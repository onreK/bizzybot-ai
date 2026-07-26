import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCustomerByClerkId } from '@/lib/database.js';
import { answerGapTopic } from '@/lib/knowledge-gaps-store.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, answer } = await request.json();
    if (!topic || !answer?.trim()) {
      return NextResponse.json({ error: 'topic and answer are required' }, { status: 400 });
    }

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = await answerGapTopic({ customerId: customer.id, topic, answer });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Could not save answer' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [GAPS API] answer failed:', error.message);
    return NextResponse.json({ error: 'Could not save answer' }, { status: 500 });
  }
}
