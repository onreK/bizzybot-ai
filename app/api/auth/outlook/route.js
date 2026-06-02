import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';
const SCOPES = 'Mail.Read Mail.ReadWrite Mail.Send offline_access User.Read email';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.redirect(`${BASE_URL}/sign-in`);

    if (!process.env.MICROSOFT_CLIENT_ID) {
      return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 500 });
    }

    // Generate a random nonce and bind it to the verified userId in a cookie
    const nonce = crypto.randomBytes(32).toString('hex');
    cookies().set('outlook_oauth_state', `${userId}:${nonce}`, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${BASE_URL}/api/auth/outlook/callback`,
      scope: SCOPES,
      state: nonce,
      prompt: 'consent',
      response_mode: 'query',
    });

    return NextResponse.redirect(
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
    );
  } catch (error) {
    console.error('❌ Outlook OAuth init error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
