import { notFound } from 'next/navigation';
import { getBrandedPageData } from '@/lib/branded-pages.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const data = await getBrandedPageData(params.number);
  return { title: data ? `SMS Terms — ${data.brand}` : 'SMS Terms' };
}

export default async function BrandedSmsTerms({ params }) {
  const data = await getBrandedPageData(params.number);
  if (!data) notFound();
  const { brand, legalName, formattedNumber, websiteDomain, businessEmail, phoneDigits } = data;

  return (
    <div className="min-h-screen bg-[#070B14] text-gray-300">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-tight">{brand}</span>
          <a href={`/sms-optin/${phoneDigits}`} className="text-sm text-gray-400 hover:text-white transition-colors">How opt-in works</a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-white mb-2">SMS Messaging Terms</h1>
        <p className="text-gray-400 text-lg mb-1">{brand}{legalName && legalName !== brand ? ` (${legalName})` : ''}</p>
        <p className="text-gray-500 text-sm mb-10">Texting number: {formattedNumber}</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Program description</h2>
            <p className="mb-3">
              {brand} uses {formattedNumber} to reply to text message inquiries from its own customers and leads. Messaging is <strong className="text-gray-200">consumer-initiated</strong>: you will only receive messages if you text {brand} first. Replies answer questions about services, pricing, and appointment scheduling. Message frequency varies based on your conversation.
            </p>
            <p><strong className="text-gray-200">Message and data rates may apply.</strong> Carriers are not liable for delayed or undelivered messages.</p>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Opting out and getting help</h2>
            <ul className="space-y-2 pl-4">
              <li className="flex gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Reply STOP</strong> (or UNSUBSCRIBE, CANCEL, QUIT, END) at any time to opt out. You will receive one confirmation message and nothing further.</span></li>
              <li className="flex gap-2"><span className="text-yellow-400 mt-0.5">•</span><span><strong className="text-white">Reply HELP</strong> (or INFO) for assistance at any time.</span></li>
              <li className="flex gap-2"><span className="text-green-400 mt-0.5">•</span><span><strong className="text-white">Reply START</strong> (or JOIN) to re-subscribe after opting out.</span></li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Privacy</h2>
            <p>
              {brand} does not send unsolicited marketing messages. Mobile phone numbers and text message content are <strong className="text-gray-200">never shared with or sold to third parties or affiliates for marketing or promotional purposes</strong>. Your number is used only to respond to your inquiries.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about text messaging from {brand}? {businessEmail ? (
                <>Email <span className="text-violet-400">{businessEmail}</span>{websiteDomain ? <> or visit <span className="text-violet-400">{websiteDomain}</span></> : null}.</>
              ) : websiteDomain ? (
                <>Visit <span className="text-violet-400">{websiteDomain}</span>.</>
              ) : (
                <>Text HELP to {formattedNumber}.</>
              )}
            </p>
          </section>

          <p className="text-xs text-gray-600 pt-2">Messaging service powered by BizzyBot AI.</p>
        </div>
      </div>
    </div>
  );
}
