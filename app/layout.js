import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import AttributionTracker from '@/components/AttributionTracker.js';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  metadataBase: new URL('https://bizzybotai.com'),
  title: {
    default: 'BizzyBot — The AI Receptionist for Calls, Texts, Email & Social Media',
    template: '%s | BizzyBot',
  },
  description:
    'AI receptionist that answers calls, texts, emails, chat & social DMs — captures, scores & books every lead. From $29/mo, 14-day free trial.',
  keywords:
    'AI receptionist, AI answering service, missed call text back, AI phone answering, AI receptionist for small business, lead capture software, AI appointment booking',
  authors: [{ name: 'BizzyBot' }],
  alternates: { canonical: 'https://bizzybotai.com' },
  openGraph: {
    title: 'BizzyBot — The AI Receptionist That Answers Everything',
    description:
      'Calls, texts, emails, web chat, and social DMs — answered in seconds, every lead captured, scored, nurtured, and booked on your calendar. From $29/mo.',
    url: 'https://bizzybotai.com',
    siteName: 'BizzyBot',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BizzyBot — The AI Receptionist That Answers Everything',
    description:
      'Calls, texts, emails, web chat, and social DMs — answered 24/7, every lead captured and booked. From $29/mo.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        elements: {
          formButtonPrimary: 
            'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
          card: 'shadow-lg',
          headerTitle: 'text-2xl font-bold',
          headerSubtitle: 'text-gray-600',
        },
        variables: {
          colorPrimary: '#2563eb',
          colorBackground: '#ffffff',
          colorText: '#1f2937',
        },
      }}
    >
      <html lang="en">
        <head>
          {/* Favicon is served from app/icon.png (Next.js convention) — it
              auto-injects the correct <link rel="icon">. The old manual link
              pointed to /favicon.ico, which didn't exist (404 → Google showed
              a generic globe). */}
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* Organization schema — entity disambiguation. Several unrelated
              companies share the "BizzyBot" name, so Google/AI were blending us
              with them. This declares us as one distinct entity (legal name +
              logo + our real category + description).
              TODO: add a `sameAs: [...]` array once we have official brand
              profiles we actually own (LinkedIn company page, G2, Capterra,
              etc.) — sameAs is the strongest disambiguation signal, but every
              URL must be a profile we truly control. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'BizzyBot',
                legalName: 'Bizzy Bot Ai LLC',
                url: 'https://bizzybotai.com',
                logo: 'https://bizzybotai.com/icon.png',
                description:
                  'BizzyBot is an AI receptionist for small businesses that answers phone calls, texts, emails, web chat, and social media DMs 24/7 — capturing, scoring, and booking every lead automatically. From $29/month.',
              }).replace(/</g, '\\u003c'),
            }}
          />
        </head>
        <body className={`${inter.className} antialiased`}>
          <AttributionTracker />
          <div id="__next">
            <main className="min-h-screen">
              {children}
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
