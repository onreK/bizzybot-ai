import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';

async function ensureOutlookTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS outlook_connections (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      outlook_email TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry BIGINT,
      user_name TEXT,
      microsoft_user_id TEXT,
      status TEXT DEFAULT 'connected',
      last_checked TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, outlook_email)
    )
  `).catch(() => {});
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${BASE_URL}/email/setup?error=oauth_denied`);
    }
    if (!code || !state) {
      return NextResponse.redirect(`${BASE_URL}/email/setup?error=missing_params`);
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: `${BASE_URL}/api/auth/outlook/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error('❌ No access token from Microsoft:', JSON.stringify(tokens));
      return NextResponse.redirect(`${BASE_URL}/email/setup?error=token_failed`);
    }

    // Get user profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const outlookEmail = profile.mail || profile.userPrincipalName;
    const tokenExpiry = Date.now() + tokens.expires_in * 1000;

    await ensureOutlookTable();

    await query(`
      INSERT INTO outlook_connections
        (user_id, outlook_email, access_token, refresh_token, token_expiry, user_name, microsoft_user_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected')
      ON CONFLICT (user_id, outlook_email) DO UPDATE SET
        access_token       = EXCLUDED.access_token,
        refresh_token      = COALESCE(EXCLUDED.refresh_token, outlook_connections.refresh_token),
        token_expiry       = EXCLUDED.token_expiry,
        user_name          = EXCLUDED.user_name,
        microsoft_user_id  = EXCLUDED.microsoft_user_id,
        status             = 'connected',
        updated_at         = CURRENT_TIMESTAMP
    `, [state, outlookEmail, tokens.access_token, tokens.refresh_token, tokenExpiry, profile.displayName, profile.id]);

    console.log(`✅ Outlook connected for ${state}: ${outlookEmail}`);

    return NextResponse.redirect(
      `${BASE_URL}/email/setup?success=outlook_connected&email=${encodeURIComponent(outlookEmail)}`
    );
  } catch (error) {
    console.error('❌ Outlook OAuth callback error:', error);
    return NextResponse.redirect(`${BASE_URL}/email/setup?error=oauth_failed`);
  }
}
