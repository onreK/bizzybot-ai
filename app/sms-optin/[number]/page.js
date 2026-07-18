import { notFound } from 'next/navigation';
import { getBrandedPageData } from '@/lib/branded-pages.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const data = await getBrandedPageData(params.number);
  return { title: data ? `SMS Opt-In — ${data.brand}` : 'SMS Opt-In' };
}

export default async function BrandedSmsOptin({ params }) {
  const data = await getBrandedPageData(params.number);
  if (!data) notFound();
  const { brand, formattedNumber, websiteDomain, phoneDigits } = data;

  return (
    <div className="min-h-screen bg-[#070B14] text-gray-300">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-tight">{brand}</span>
          <a href={`/sms-terms/${phoneDigits}`} className="text-sm text-gray-400 hover:text-white transition-colors">SMS Terms</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">How customers opt in to text messages from {brand}</h1>
          <p className="text-gray-400 text-lg">SMS opt-in documentation for {formattedNumber}</p>
        </div>

        {/* Overview */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">How it works</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            All text messaging with {brand} is <strong className="text-white">consumer-initiated (mobile-originated)</strong> — a consumer chooses to text {brand} first, and an automated reply answers their inquiry.
          </p>
          <p className="text-gray-300 leading-relaxed">
            No messages are ever sent to a consumer unless they initiate contact. The consumer&apos;s act of texting {brand} constitutes consent to receive a reply. Every reply includes STOP opt-out instructions.
          </p>
        </div>

        {/* Step by step */}
        <h2 className="text-2xl font-bold text-white mb-6">Step-by-step opt-in</h2>

        <div className="space-y-6 mb-12">

          {/* Step 1 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">1</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer finds {brand}&apos;s phone number</h3>
                <p className="text-gray-400 text-sm mb-4">
                  {brand} advertises {formattedNumber} publicly{websiteDomain ? ` on its website (${websiteDomain}),` : ' on'} business listings, and printed materials, inviting customers to call or text.
                </p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">{websiteDomain ? `${websiteDomain} — contact section:` : 'Business contact section:'}</p>
                  <div className="border border-gray-700 rounded-lg p-4 bg-[#111827]">
                    <p className="text-white font-semibold text-lg mb-1">{brand}</p>
                    <div className="flex items-start gap-3 bg-white/5 rounded-lg p-3 mt-3">
                      <div className="text-2xl">💬</div>
                      <div>
                        <p className="text-white text-sm font-medium">Questions? Call or text us</p>
                        <p className="text-violet-400 text-sm font-mono">{formattedNumber}</p>
                        <p className="text-gray-500 text-xs mt-1">Text us any time with questions. Standard message and data rates may apply. Reply STOP to opt out.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">2</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer texts {brand} (opt-in)</h3>
                <p className="text-gray-400 text-sm mb-4">The consumer chooses to send a text to {formattedNumber}. This act of texting constitutes their consent to receive an automated reply to their inquiry.</p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Consumer sends first message:</p>
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-br-md px-4 py-2 max-w-xs">
                      Hi, I&apos;m interested in your services. Can you tell me more?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">3</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">{brand} replies to the inquiry</h3>
                <p className="text-gray-400 text-sm mb-4">An automated reply answers the consumer&apos;s question. Every reply identifies {brand} and includes STOP opt-out instructions and the Msg &amp; data rates disclosure.</p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Reply to consumer:</p>
                  <div className="flex justify-start">
                    <div className="bg-gray-700 text-white text-sm rounded-2xl rounded-bl-md px-4 py-2 max-w-sm">
                      Hi! Thanks for reaching out to {brand}. Happy to help — what are you looking for? Reply STOP to opt out, HELP for help. Msg &amp; data rates may apply.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 — STOP */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">✕</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer can opt out at any time by replying STOP</h3>
                <p className="text-gray-400 text-sm mb-4">If the consumer replies STOP (or UNSUBSCRIBE, CANCEL, END, QUIT), they are immediately unsubscribed. No further messages are sent.</p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Opt-out flow:</p>
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-br-md px-4 py-2">STOP</div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-gray-700 text-white text-sm rounded-2xl rounded-bl-md px-4 py-2 max-w-sm">
                      You have been unsubscribed from {brand}. No further messages will be sent. Reply START to resubscribe.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Keyword reference */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Standard messaging keywords</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { keyword: 'STOP / UNSUBSCRIBE / CANCEL / QUIT / END', desc: 'Immediately opt out — no further messages will be sent.', color: 'text-red-400' },
              { keyword: 'HELP / INFO', desc: 'Returns help message with business name and opt-out instructions.', color: 'text-yellow-400' },
              { keyword: 'START / JOIN', desc: 'Re-subscribes a consumer who previously opted out.', color: 'text-green-400' },
            ].map((k, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-[#0D1421] p-4">
                <p className={`font-mono text-sm font-bold mb-1 ${k.color}`}>{k.keyword}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{k.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Legal note */}
        <div className="text-sm text-gray-500 space-y-2">
          <p>Messages are sent by {brand}. Mobile information is never shared with third parties or affiliates for marketing or promotional purposes.</p>
          <p>
            See the full{' '}
            <a href={`/sms-terms/${phoneDigits}`} className="text-violet-400 hover:text-violet-300">SMS Messaging Terms for {brand}</a>.
          </p>
          <p className="pt-4 text-xs text-gray-600">Messaging service powered by BizzyBot AI.</p>
        </div>

      </div>
    </div>
  );
}
