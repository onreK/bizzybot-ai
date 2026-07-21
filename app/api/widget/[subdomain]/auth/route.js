// Public widget auth — called cross-origin from customer websites.
// The [subdomain] segment is the customer's widget id (their Clerk user id,
// as handed out by the Web Chat page's embed snippet).
import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { hasActiveAccess } from '@/lib/trial-access.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request, { params }) {
  const { subdomain } = params;

  try {
    const result = await query(
      `SELECT id, business_name, stripe_subscription_id, created_at
       FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [subdomain]
    );
    const customer = result.rows[0];

    if (!customer) {
      return NextResponse.json(
        { error: 'Widget not found', active: false },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (!hasActiveAccess(customer)) {
      return NextResponse.json(
        {
          error: 'Subscription inactive',
          active: false,
          message: 'This AI assistant is temporarily unavailable. Please contact the business owner.',
        },
        { status: 402, headers: CORS_HEADERS }
      );
    }

    const businessName = customer.business_name || 'Our Business';
    return NextResponse.json(
      {
        active: true,
        config: {
          businessName,
          primaryColor: '#7c3aed',
          welcomeMessage: `Hi! I'm the ${businessName} AI assistant. How can I help you today?`,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('❌ Widget auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', active: false },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
