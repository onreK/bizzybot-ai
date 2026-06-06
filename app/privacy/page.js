export const metadata = {
  title: 'Privacy Policy — BizzyBot AI',
  description: 'How BizzyBot AI collects, uses, and protects your data.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#070B14] text-gray-300">
      {/* Nav bar */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-white font-bold text-lg tracking-tight">BizzyBot AI</a>
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← Back to home</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: June 5, 2026 · Effective: June 5, 2026</p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed">

          {/* Intro */}
          <section>
            <p>
              BizzyBot AI ("BizzyBot," "we," "us," or "our") operates the website{' '}
              <a href="https://bizzybotai.com" className="text-violet-400 hover:text-violet-300">bizzybotai.com</a>{' '}
              and related services (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard information about you when you use our Service. By using BizzyBot, you agree to the practices described in this policy.
            </p>
          </section>

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>

            <h3 className="text-base font-semibold text-gray-200 mb-2">1.1 Account Information</h3>
            <p className="mb-4">
              When you register, we collect your name, email address, and any business details you provide (business name, industry, phone number, website). This information is necessary to create and maintain your account.
            </p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">1.2 Business Configuration Data</h3>
            <p className="mb-4">
              We store the AI settings, knowledge base text, tone preferences, escalation rules, and other configuration you enter into the platform. This data is used exclusively to operate the AI assistant on your behalf.
            </p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">1.3 Conversation Data</h3>
            <p className="mb-4">
              We store messages and conversation threads that pass through the platform — including emails, SMS messages, and chat transcripts — so your AI can maintain context across interactions and so you can review leads in your dashboard.
            </p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">1.4 Usage and Analytics Data</h3>
            <p>
              We collect aggregated, non-personally identifiable usage data such as feature usage frequency, response times, and error logs to improve the reliability and performance of the Service.
            </p>
          </section>

          {/* 2 — Gmail (Critical for Google review) */}
          <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">2. Google API Services & Gmail Data</h2>
            <p className="mb-4">
              BizzyBot's use and transfer of information received from Google APIs adheres to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">What we access</h3>
            <p className="mb-4">
              When you connect your Gmail account, BizzyBot requests the following Google OAuth scopes:
            </p>
            <ul className="mb-4 space-y-2 pl-4">
              <li className="flex gap-2">
                <span className="text-violet-400 mt-1">•</span>
                <span><code className="bg-white/5 px-1.5 py-0.5 rounded text-sm">gmail.readonly</code> — Read incoming emails to generate AI responses for your leads.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 mt-1">•</span>
                <span><code className="bg-white/5 px-1.5 py-0.5 rounded text-sm">gmail.send</code> — Send AI-generated replies from your Gmail account on your behalf.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 mt-1">•</span>
                <span><code className="bg-white/5 px-1.5 py-0.5 rounded text-sm">userinfo.email</code> and <code className="bg-white/5 px-1.5 py-0.5 rounded text-sm">userinfo.profile</code> — Identify which Gmail account is connected.</span>
              </li>
            </ul>

            <h3 className="text-base font-semibold text-gray-200 mb-2">How we use Gmail data</h3>
            <p className="mb-4">
              Gmail data is accessed solely for the following purposes directly requested by you:
            </p>
            <ul className="mb-4 space-y-1.5 pl-4">
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>Reading the content of incoming emails to generate contextual, AI-powered responses to your leads and customers.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>Sending those AI-generated replies from your Gmail address as your designated AI assistant.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>Storing email threads in our database so your dashboard can display conversation history and lead tracking.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>Triggering automated follow-up emails when a lead goes quiet, according to the schedule you configure.</span></li>
            </ul>

            <h3 className="text-base font-semibold text-gray-200 mb-2">What we do NOT do with Gmail data</h3>
            <ul className="mb-4 space-y-1.5 pl-4">
              <li className="flex gap-2"><span className="text-red-400 mt-1">✗</span><span>We do <strong className="text-gray-200">not</strong> use Gmail data to train, improve, or develop AI or machine learning models.</span></li>
              <li className="flex gap-2"><span className="text-red-400 mt-1">✗</span><span>We do <strong className="text-gray-200">not</strong> sell, share, or transfer your Gmail data to any third party for advertising, analytics, or any other purpose.</span></li>
              <li className="flex gap-2"><span className="text-red-400 mt-1">✗</span><span>We do <strong className="text-gray-200">not</strong> allow human employees to read the contents of your emails, except where you explicitly request support assistance.</span></li>
              <li className="flex gap-2"><span className="text-red-400 mt-1">✗</span><span>We do <strong className="text-gray-200">not</strong> retain Gmail data beyond what is needed to provide the Service.</span></li>
            </ul>

            <h3 className="text-base font-semibold text-gray-200 mb-2">Revoking Gmail access</h3>
            <p>
              You can disconnect your Gmail account at any time from your BizzyBot dashboard under Settings → Connections. You may also revoke access directly from your Google Account at{' '}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">myaccount.google.com/permissions</a>.
              Revoking access will stop all email monitoring and AI replies immediately. Previously stored conversation history in your dashboard will remain until you request deletion.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Operate, maintain, and improve the BizzyBot platform.',
                'Provide AI-powered responses to your leads across email, SMS, and web chat channels.',
                'Display conversation history, lead scoring, and analytics in your dashboard.',
                'Process payments and manage your subscription through Stripe.',
                'Send transactional emails (account alerts, billing receipts, service notices). We do not send marketing email without your consent.',
                'Respond to support requests and troubleshoot issues.',
                'Comply with legal obligations and enforce our Terms of Service.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-violet-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Information Sharing & Disclosure</h2>
            <p className="mb-4">We do not sell your personal information. We share information only in the following limited circumstances:</p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">4.0 SMS / Mobile Data</h3>
            <p className="mb-4">
              Mobile information — including phone numbers, SMS message content, and opt-in/opt-out status — is <strong className="text-gray-200">never shared with third parties or affiliates for marketing or promotional purposes</strong>. This data is used solely to deliver AI-powered SMS responses on behalf of businesses using the BizzyBot platform. All mobile messaging is conducted in compliance with CTIA guidelines and applicable carrier requirements.
            </p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">4.1 Service Providers</h3>
            <p className="mb-4">
              We work with trusted third-party vendors who process data on our behalf under strict confidentiality agreements:
            </p>
            <ul className="mb-4 space-y-1.5 pl-4">
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span><strong className="text-gray-200">Clerk</strong> — Authentication and user session management.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span><strong className="text-gray-200">Stripe</strong> — Payment processing and subscription management. Stripe stores payment card data; BizzyBot never sees or stores raw card numbers.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span><strong className="text-gray-200">OpenAI</strong> — AI response generation. Message content is sent to OpenAI's API to generate replies. OpenAI's data use is governed by their{' '}<a href="https://openai.com/policies/api-data-usage-policies" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">API data usage policy</a>; as of this writing, OpenAI does not use API data to train models by default.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span><strong className="text-gray-200">Twilio</strong> — SMS message delivery for the SMS channel.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span><strong className="text-gray-200">Railway / Supabase</strong> — Database hosting for your stored data.</span></li>
            </ul>

            <h3 className="text-base font-semibold text-gray-200 mb-2">4.2 Legal Requirements</h3>
            <p>
              We may disclose information if required to do so by law or in good-faith belief that such disclosure is necessary to comply with a legal obligation, protect the rights or safety of BizzyBot or others, or investigate fraud.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Retention</h2>
            <p className="mb-3">
              We retain your account data and conversation history for as long as your account is active. If you cancel your subscription:
            </p>
            <ul className="space-y-1.5 pl-4">
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>Your data is retained for 30 days after cancellation to allow for reactivation or export.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>After 30 days, your data is permanently deleted from our production systems.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>Backups may retain data for an additional 90 days before cycling out.</span></li>
              <li className="flex gap-2"><span className="text-violet-400 mt-1">•</span><span>You may request immediate deletion of your data at any time by contacting us at{' '}<a href="mailto:privacy@bizzybotai.com" className="text-violet-400 hover:text-violet-300">privacy@bizzybotai.com</a>.</span></li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Data Security</h2>
            <p className="mb-3">
              We implement technical and organizational measures to protect your information:
            </p>
            <ul className="space-y-1.5 pl-4">
              {[
                'All data is transmitted over HTTPS/TLS encryption.',
                'Database credentials and OAuth tokens are stored encrypted at rest.',
                'Access to production systems is restricted to authorized personnel only.',
                'Google and Stripe OAuth tokens are stored per-user and never shared across accounts.',
                'We conduct regular security reviews of our infrastructure.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-violet-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-gray-500 text-sm">
              No method of electronic transmission or storage is 100% secure. While we take reasonable precautions, we cannot guarantee absolute security.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Your Rights & Choices</h2>
            <p className="mb-3">Depending on your location, you may have the right to:</p>
            <ul className="space-y-1.5 pl-4">
              {[
                'Access and receive a copy of the personal data we hold about you.',
                'Correct inaccurate or incomplete personal data.',
                'Delete your personal data ("right to be forgotten").',
                'Restrict or object to certain types of processing.',
                'Data portability — receive your data in a structured, machine-readable format.',
                'Withdraw consent at any time where processing is based on consent (e.g., disconnect Gmail).',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-violet-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@bizzybotai.com" className="text-violet-400 hover:text-violet-300">privacy@bizzybotai.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Cookies & Tracking</h2>
            <p>
              BizzyBot uses session cookies set by Clerk for authentication. We do not use advertising cookies, third-party tracking pixels, or behavioral analytics services. Session cookies are deleted when you log out or close your browser.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Children's Privacy</h2>
            <p>
              BizzyBot is a business tool intended for users 18 years of age and older. We do not knowingly collect personal information from anyone under 18. If you become aware that a child has provided us with personal data, please contact us and we will delete it.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. International Data Transfers</h2>
            <p>
              BizzyBot is operated from the United States. If you access the Service from outside the United States, your information may be transferred to, stored, and processed in the United States where our servers are located. By using the Service, you consent to this transfer.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email (at the address on your account) and update the "Last updated" date at the top of this page. Your continued use of the Service after changes become effective constitutes your acceptance of the updated policy.
            </p>
          </section>

          {/* 13 — SMS Messaging Terms (required for CTIA / Twilio A2P compliance) */}
          <section id="sms-terms" className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
            <h2 className="text-xl font-semibold text-white mb-1">13. SMS Messaging Terms</h2>
            <p className="text-xs text-blue-400 mb-4 uppercase tracking-widest font-medium">CTIA Compliant · A2P 10DLC</p>

            <h3 className="text-base font-semibold text-gray-200 mb-2">How consumers opt in</h3>
            <p className="mb-4">
              All SMS conversations through BizzyBot AI are <strong className="text-gray-200">consumer-initiated (mobile-originated)</strong>. A consumer opts in by texting a business's BizzyBot-powered phone number directly. The consumer initiates all contact — no messages are ever sent to a consumer unless they text first.
            </p>
            <p className="mb-4">
              The act of texting a business's BizzyBot number constitutes consent to receive automated AI replies to that inquiry. The business's phone number is publicly listed on their website, Google Business profile, or other business directories. A consumer who chooses to text that number is initiating the conversation and consenting to a reply.
            </p>

            <div className="rounded-lg border border-white/10 bg-[#0D1421] p-4 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-2">How a typical consumer opt-in works:</p>
              <p className="text-gray-200 text-sm leading-relaxed">
                A consumer sees a business's phone number on their website or Google listing (e.g., "Call or text us: [number]"). The consumer chooses to text that number with a question. BizzyBot's AI replies to that inquiry. Every reply includes STOP opt-out instructions and "Msg &amp; data rates may apply."
              </p>
            </div>

            <h3 className="text-base font-semibold text-gray-200 mb-2">Standard messaging keywords</h3>
            <ul className="mb-4 space-y-2 pl-4 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong className="text-gray-200">STOP / UNSUBSCRIBE / CANCEL / QUIT / END</strong> — Immediately unsubscribes the consumer. No further messages will be sent.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong className="text-gray-200">HELP / INFO</strong> — Returns a help message with the business name and opt-out instructions.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span><strong className="text-gray-200">START / JOIN</strong> — Re-subscribes a consumer who previously opted out.</span></li>
            </ul>

            <h3 className="text-base font-semibold text-gray-200 mb-2">What every message includes</h3>
            <ul className="mb-4 space-y-1.5 pl-4 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span>Identification of the business the consumer contacted.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span>STOP opt-out instructions in every outbound message.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 mt-0.5">•</span><span>"Msg &amp; data rates may apply" disclosure.</span></li>
            </ul>

            <h3 className="text-base font-semibold text-gray-200 mb-2">What we never do</h3>
            <ul className="mb-4 space-y-1.5 pl-4 text-sm">
              <li className="flex gap-2"><span className="text-red-400 mt-0.5">✗</span><span>We do <strong className="text-gray-200">not</strong> send unsolicited outbound marketing messages.</span></li>
              <li className="flex gap-2"><span className="text-red-400 mt-0.5">✗</span><span>We do <strong className="text-gray-200">not</strong> share or sell mobile phone numbers or SMS content to third parties for marketing purposes.</span></li>
              <li className="flex gap-2"><span className="text-red-400 mt-0.5">✗</span><span>We do <strong className="text-gray-200">not</strong> send messages to consumers who have replied STOP.</span></li>
            </ul>

            <p className="text-sm text-gray-400">
              For questions about SMS messaging, contact{' '}
              <a href="mailto:support@bizzybotai.com" className="text-blue-400 hover:text-blue-300">support@bizzybotai.com</a>.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">12. Contact Us</h2>
            <p className="mb-3">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices:
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-1.5">
              <p><span className="text-gray-500">Company:</span> <span className="text-gray-200">BizzyBot AI</span></p>
              <p><span className="text-gray-500">Privacy inquiries:</span>{' '}<a href="mailto:privacy@bizzybotai.com" className="text-violet-400 hover:text-violet-300">privacy@bizzybotai.com</a></p>
              <p><span className="text-gray-500">General support:</span>{' '}<a href="mailto:support@bizzybotai.com" className="text-violet-400 hover:text-violet-300">support@bizzybotai.com</a></p>
              <p><span className="text-gray-500">Website:</span>{' '}<a href="https://bizzybotai.com" className="text-violet-400 hover:text-violet-300">bizzybotai.com</a></p>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row gap-4 justify-between text-sm text-gray-600">
            <div className="flex gap-6">
              <a href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</a>
              <a href="/" className="hover:text-gray-400 transition-colors">Home</a>
            </div>
            <p>© 2026 BizzyBot AI. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
