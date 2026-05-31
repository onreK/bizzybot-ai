import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS facebook_connections (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL UNIQUE,
      customer_id INTEGER,
      page_id VARCHAR(255),
      page_name VARCHAR(255),
      page_access_token TEXT,
      verify_token VARCHAR(255),
      app_secret TEXT,
      business_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'connected',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await query(`ALTER TABLE facebook_connections ADD COLUMN IF NOT EXISTS page_name VARCHAR(255)`).catch(() => {});
}

async function fetchPageId(pageAccessToken) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${pageAccessToken}`
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;
  } catch (err) {
    console.error('❌ Could not fetch Facebook page ID:', err.message);
    return null;
  }
}

export async function GET(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();

    const result = await query(
      `SELECT page_id, COALESCE(page_name, business_name) AS page_name,
              business_name, status, created_at, updated_at,
              page_access_token IS NOT NULL AS has_page_access_token
       FROM facebook_connections WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ configured: false });
    }

    return NextResponse.json({ configured: true, connection: result.rows[0] });
  } catch (error) {
    console.error('❌ Facebook configure GET error:', error);
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();

    const { config } = await request.json();
    if (!config) return NextResponse.json({ error: 'Configuration required' }, { status: 400 });

    const { pageAccessToken, verifyToken, appSecret, businessName } = config;
    if (!pageAccessToken?.trim() || !verifyToken?.trim() || !appSecret?.trim() || !businessName?.trim()) {
      return NextResponse.json({ error: 'pageAccessToken, verifyToken, appSecret, and businessName are required' }, { status: 400 });
    }

    // Auto-fetch the page ID from Facebook so we can route webhooks correctly
    const pageId = await fetchPageId(pageAccessToken.trim());
    if (!pageId) {
      return NextResponse.json({ error: 'Invalid Page Access Token — could not verify with Facebook' }, { status: 400 });
    }

    // Look up customer ID
    const customerResult = await query(
      `SELECT id FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    const customerId = customerResult.rows[0]?.id || null;

    await query(`
      INSERT INTO facebook_connections
        (user_id, customer_id, page_id, page_access_token, verify_token, app_secret, business_name, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected', NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        customer_id       = EXCLUDED.customer_id,
        page_id           = EXCLUDED.page_id,
        page_access_token = EXCLUDED.page_access_token,
        verify_token      = EXCLUDED.verify_token,
        app_secret        = EXCLUDED.app_secret,
        business_name     = EXCLUDED.business_name,
        status            = 'connected',
        updated_at        = NOW()
    `, [userId, customerId, pageId, pageAccessToken.trim(), verifyToken.trim(), appSecret.trim(), businessName.trim()]);

    console.log('✅ Facebook connection saved to DB for user:', userId, 'page:', pageId);

    return NextResponse.json({
      success: true,
      config: { pageId, businessName: businessName.trim(), status: 'connected' }
    });
  } catch (error) {
    console.error('❌ Facebook configure POST error:', error);
    return NextResponse.json({ error: 'Failed to save configuration', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await query(
      `UPDATE facebook_connections SET status = 'disconnected', updated_at = NOW() WHERE user_id = $1`,
      [userId]
    ).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
