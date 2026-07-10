import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database';
import { createOrUpdateContact, trackLeadEventWithContact } from '@/lib/leads-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/leads/create
 * Manually add a lead from the dashboard. Runs through the same contact
 * pipeline as channel leads (dedupes by email/phone, scores, shows in
 * Lead Management with channel 'manual').
 */
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerResult = await query(
      'SELECT id FROM customers WHERE clerk_user_id = $1',
      [userId]
    );
    if (!customerResult.rows.length) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    const customerId = customerResult.rows[0].id;

    const { name, phone, email, company, notes } = await request.json();
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim();

    if (!cleanName) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    if (!cleanPhone && !cleanEmail) {
      return NextResponse.json(
        { success: false, error: 'Add a phone number or email so you can reach this lead' },
        { status: 400 }
      );
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ success: false, error: 'That email address doesn\'t look valid' }, { status: 400 });
    }

    const contactResult = await createOrUpdateContact(customerId, {
      name: cleanName,
      phone: cleanPhone || null,
      email: cleanEmail || null,
      company: (company || '').trim() || null,
      source_channel: 'manual',
    });
    if (!contactResult.success) {
      return NextResponse.json({ success: false, error: contactResult.error || 'Failed to create lead' }, { status: 500 });
    }
    const contact = contactResult.contact;

    if ((notes || '').trim()) {
      await query(
        'UPDATE contacts SET notes = $1, updated_at = NOW() WHERE id = $2 AND customer_id = $3',
        [notes.trim(), contact.id, customerId]
      ).catch(() => {});
    }

    // Activity timeline entry + sets last_interaction so the lead sorts to the top
    await trackLeadEventWithContact(customerId, contact.id, {
      type: 'contact_captured',
      channel: 'manual',
      message: 'Lead added manually from the dashboard',
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      // 'updated' means an existing contact matched by phone/email was reused
      action: contactResult.action,
      contact: { id: contact.id, name: contact.name, phone: contact.phone, email: contact.email },
    });
  } catch (error) {
    console.error('❌ Manual lead create error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
