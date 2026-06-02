import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCOPES = 'Mail.Read Mail.ReadWrite Mail.Send offline_access User.Read email';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'anonymous';

    if (!process.env.MICROSOFT_CLIENT_ID) {
      return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/outlook/callback`,
      scope: SCOPES,
      state: userId,
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
