import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';

// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com'}/api/auth/google/callback`
);

// Gmail + Google Calendar scopes
// calendar and calendar.events added for the Google OAuth submission —
// these will be verified by Google along with Gmail scopes.
// Note: gmail.modify intentionally excluded (requires $15k+ security audit).
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export async function GET() {
  console.log('🚀 === GMAIL OAUTH STARTER (secure server session) ===');

  try {
    // Identify the user from the verified Clerk session — never trust a URL param.
    const { userId } = auth();
    if (!userId) return NextResponse.redirect(`${BASE_URL}/sign-in`);

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth credentials');
      return NextResponse.json({
        error: 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.'
      }, { status: 500 });
    }

    // Bind a random nonce to the verified userId in an httpOnly cookie. The
    // callback trusts this cookie, not anything Google echoes back in the URL.
    const nonce = crypto.randomBytes(32).toString('hex');
    cookies().set('google_oauth_state', `${userId}:${nonce}`, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: nonce,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error('❌ Gmail OAuth error:', error);
    return NextResponse.json({ 
      error: 'Failed to initiate Gmail OAuth',
      details: process.env.NODE_ENV === 'development' ? error.message : 'OAuth error'
    }, { status: 500 });
  }
}

export async function POST(request) {
  console.log('📊 Gmail connection status check');
  
  try {
    // For now, return a simple status without requiring database
    // This will be enhanced once the OAuth flow is working
    return NextResponse.json({
      success: true,
      connected: false,
      email: null,
      status: 'disconnected',
      message: 'Gmail OAuth is ready - complete the flow to connect'
    });

  } catch (error) {
    console.error('❌ Gmail connection check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check Gmail connection',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Status check error'
    }, { status: 500 });
  }
}
