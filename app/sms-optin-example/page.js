export const metadata = {
  title: 'SMS Opt-In Example — BizzyBot AI',
  description: 'How consumers opt in to receive SMS messages from businesses using BizzyBot AI.',
};

export default function SmsOptinExample() {
  return (
    <div className="min-h-screen bg-[#070B14] text-gray-300">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-white font-bold text-lg tracking-tight">BizzyBot AI</a>
          <a href="/privacy#sms-terms" className="text-sm text-gray-400 hover:text-white transition-colors">SMS Terms</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">SMS Opt-In Flow</h1>
          <p className="text-gray-400 text-lg">How consumers consent to receive messages from businesses using BizzyBot AI</p>
        </div>

        {/* Overview */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">How it works</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            BizzyBot AI is a platform that enables small businesses to respond to inbound SMS inquiries using AI. All messaging is <strong className="text-white">consumer-initiated (mobile-originated)</strong> — a consumer chooses to text the business first, and BizzyBot's AI replies to that inquiry.
          </p>
          <p className="text-gray-300 leading-relaxed">
            No messages are ever sent to a consumer unless they initiate contact. The consumer's act of texting the business constitutes consent to receive a reply. Every reply includes STOP opt-out instructions.
          </p>
        </div>

        {/* Step by step */}
        <h2 className="text-2xl font-bold text-white mb-6">Step-by-step opt-in example</h2>

        <div className="space-y-6 mb-12">

          {/* Step 1 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">1</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer finds the business phone number</h3>
                <p className="text-gray-400 text-sm mb-4">The business (a BizzyBot customer) lists their phone number publicly on their website, Google Business Profile, Yelp listing, or printed materials with a "text us" invitation.</p>

                {/* Mockup of a business website listing */}
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Example — business website contact section:</p>
                  <div className="border border-gray-700 rounded-lg p-4 bg-[#111827]">
                    <p className="text-white font-semibold text-lg mb-1">Sunshine Home Services</p>
                    <p className="text-gray-400 text-sm mb-3">Residential cleaning, landscaping &amp; home maintenance</p>
                    <div className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                      <div className="text-2xl">💬</div>
                      <div>
                        <p className="text-white text-sm font-medium">Questions? Text us</p>
                        <p className="text-violet-400 text-sm font-mono">(555) 123-4567</p>
                        <p className="text-gray-500 text-xs mt-1">Text us any time with questions about our services. Standard message and data rates may apply. Reply STOP to opt out.</p>
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
                <h3 className="text-white font-semibold mb-2">Consumer texts the business (opt-in)</h3>
                <p className="text-gray-400 text-sm mb-4">The consumer chooses to send a text to the business's number. This act of texting constitutes their consent to receive an automated AI reply to their inquiry.</p>

                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Consumer sends first message:</p>
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-br-md px-4 py-2 max-w-xs">
                      Hi, I'm interested in a quote for lawn care. What are your rates?
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
                <h3 className="text-white font-semibold mb-2">BizzyBot AI replies to the inquiry</h3>
                <p className="text-gray-400 text-sm mb-4">BizzyBot's AI automatically responds to the consumer's question using the business's information. Every reply includes STOP opt-out instructions and the Msg &amp; data rates disclosure.</p>

                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">AI reply to consumer:</p>
                  <div className="flex justify-start">
                    <div className="bg-gray-700 text-white text-sm rounded-2xl rounded-bl-md px-4 py-2 max-w-sm">
                      Hi! Thanks for reaching out to Sunshine Home Services. Lawn care starts at $65 for standard yards. We're available Mon–Sat 8am–6pm. Would you like to schedule a free estimate? Reply STOP to opt out, HELP for help. Msg &amp; data rates may apply.
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
                      You have been unsubscribed from Sunshine Home Services via BizzyBot AI. No further messages will be sent. Reply START to resubscribe.
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
          <p>All SMS messaging through BizzyBot AI complies with CTIA guidelines and A2P 10DLC requirements.</p>
          <p>
            Mobile information is never shared with third parties or affiliates for marketing or promotional purposes.
            See our full{' '}
            <a href="/privacy#sms-terms" className="text-violet-400 hover:text-violet-300">SMS Messaging Terms</a>{' '}
            and{' '}
            <a href="/terms" className="text-violet-400 hover:text-violet-300">Terms of Service</a>.
          </p>
        </div>

      </div>
    </div>
  );
}
