// Gmail OAuth enabled - v3
// middleware.js
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: [
    "/",
    "/demo(.*)",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks/clerk",
    "/api/contact",
    "/api/sms/webhook",
    "/api/voice/(.*)",               // Twilio voice routing (TwiML) — no Clerk session
    "/api/facebook/webhook",
    "/api/instagram/webhook",        // Instagram webhook (public)
    "/api/email/webhook",
    "/api/widget/(.*)",
    "/api/leads",
    "/api/hot-lead-detection",
    "/onboarding",
    "/pricing",
    "/privacy",
    "/terms",
    "/sms-optin-example",
    // OAuth routes - MUST be public for OAuth flows to work
    "/api/auth/google(.*)",
    "/api/auth/facebook(.*)",
    "/api/auth/outlook/callback",
    "/api/facebook/deauthorize",
    "/api/facebook/data-deletion",
    // Cron endpoint - protected by CRON_SECRET bearer token, not Clerk
    "/api/cron/run",
    // Railway healthcheck probe (no session)
    "/api/health",
    "/api/stripe/webhook",
    // Gmail + Outlook monitor called internally by cron (no Clerk session available)
    "/api/gmail/monitor",
    "/api/outlook/monitor",
    // Vapi webhook — called by Vapi servers, no Clerk session
    "/api/vapi/webhook",
  ],
  
  // Routes that are completely ignored by Clerk (no auth checks)
  ignoredRoutes: [
    "/api/public(.*)",
    "/_next/static(.*)",
    "/_next/image(.*)",
    "/favicon.ico",
    // Gmail initiation must run through Clerk so it can read the session
    // (server-verified user id). Only the callback is ignored (Google redirects
    // there without a Clerk session; it verifies via the state cookie).
    "/api/auth/google/callback",
    "/api/auth/facebook/callback",
    "/api/auth/outlook/callback"
  ]
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
