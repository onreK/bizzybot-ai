import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import twilio from 'twilio';
import { query, getCustomerByClerkId } from '@/lib/database.js';
import { getGapById, recordFollowup } from '@/lib/knowledge-gaps-store.js';
import { sendEmail } from '@/lib/resend-send.js';
import { hasActiveAccess } from '@/lib/trial-access.js';

export const dynamic = 'force-dynamic';

const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { gapId, method, answer } = await request.json();
    if (!gapId || !['sms', 'email', 'manual'].includes(method)) {
      return NextResponse.json({ error: 'gapId and a valid method are required' }, { status: 400 });
    }

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const gap = await getGapById({ customerId: customer.id, gapId });
    if (!gap) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Already followed up — a double-click or retried request must not send a
    // second message to a real person. Reported as success so the UI settles
    // into the same state either way.
    if (gap.followup_at) {
      return NextResponse.json({ success: true, sent: false, alreadySent: true });
    }

    const businessName = customer.business_name || 'us';
    const body = String(answer || gap.answer || '').trim();

    // Sending costs real money, so it follows the same trial gate as every
    // other outbound path in the product. 'manual' is deliberately exempt —
    // it records that the owner handled it themselves and sends nothing, so
    // an expired-trial owner can still clear their queue.
    if (method !== 'manual' && !hasActiveAccess(customer)) {
      return NextResponse.json(
        { error: 'Your trial has ended — pick a plan to send follow-ups.' },
        { status: 402 }
      );
    }

    // 'manual' records that the owner handled it themselves — nothing is sent.
    if (method === 'manual') {
      await recordFollowup({ customerId: customer.id, gapId, method: 'manual' });
      return NextResponse.json({ success: true, sent: false });
    }

    if (!body) return NextResponse.json({ error: 'No answer to send' }, { status: 400 });

    if (method === 'sms') {
      if (!twilioClient || !gap.contact_phone) {
        return NextResponse.json({ error: 'No phone number on file for this lead' }, { status: 400 });
      }
      const numberResult = await query(
        `SELECT phone_number FROM customer_phone_numbers
         WHERE customer_id = $1 AND phone_number IS NOT NULL
         ORDER BY id DESC LIMIT 1`,
        [customer.id]
      ).catch(() => ({ rows: [] }));
      const fromNumber = numberResult.rows[0]?.phone_number;
      if (!fromNumber) {
        return NextResponse.json({ error: 'No business number configured' }, { status: 400 });
      }

      await twilioClient.messages.create({
        from: fromNumber,
        to: gap.contact_phone,
        body: `Following up from ${businessName}: ${body}`,
      });
    }

    if (method === 'email') {
      if (!gap.contact_email) {
        return NextResponse.json({ error: 'No email address on file for this lead' }, { status: 400 });
      }
      const result = await sendEmail({
        from: `${businessName} <alerts@bizzybotai.com>`,
        to: gap.contact_email,
        subject: `Following up on your question`,
        text: `Hi${gap.contact_name ? ` ${gap.contact_name}` : ''},\n\nYou asked: ${gap.question}\n\n${body}\n\n— ${businessName}`,
      }, 'knowledge-gap follow-up');

      if (!result.sent) {
        return NextResponse.json({ error: 'Email could not be delivered' }, { status: 502 });
      }
    }

    await recordFollowup({ customerId: customer.id, gapId, method });
    return NextResponse.json({ success: true, sent: true });
  } catch (error) {
    console.error('❌ [GAPS API] follow-up failed:', error.message);
    return NextResponse.json({ error: 'Could not send follow-up' }, { status: 500 });
  }
}
