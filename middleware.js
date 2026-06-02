// Gmail OAuth enabled - v3
// middleware.js
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: [
    "/",
    "/amanda(.*)",
    "/demo(.*)",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks/clerk",
    "/api/contact",
    "/api/smtp/test",
    "/api/sms/webhook",
    "/api/facebook/webhook",
    "/api/instagram/webhook",        // Instagram webhook (public)
    "/api/email/webhook",
    "/api/widget/(.*)",
    "/api/leads",
    "/api/setup-database",
    "/api/hot-lead-detection",
    "/onboarding",
    "/pricing",
    "/privacy",
    "/terms",
    // OAuth routes - MUST be public for OAuth flows to work
    "/api/auth/google(.*)",
    "/api/auth/facebook(.*)",
    "/api/auth/outlook(.*)",
    "/api/facebook/deauthorize",
    "/api/facebook/data-deletion",
    // Cron endpoint - protected by CRON_SECRET bearer token, not Clerk
    "/api/cron/run",
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
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/google/status",
    "/api/auth/facebook/callback",
    "/api/auth/outlook/callback"
  ]
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
