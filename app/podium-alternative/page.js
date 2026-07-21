import { MarketingNav, MarketingFooter, CtaButtons, JsonLd } from '@/components/marketing/MarketingChrome.js';

export const metadata = {
  title: 'The Affordable Podium Alternative for Small Business',
  description:
    'Podium starts at $399/mo and charges extra for AI. BizzyBot answers calls, texts, email, chat & social — with AI included — from $29/mo. A simpler Podium alternative for small business.',
  keywords:
    'Podium alternative, cheaper than Podium, Podium alternative small business, Podium pricing, AI receptionist alternative, Podium vs BizzyBot',
  alternates: { canonical: 'https://bizzybotai.com/podium-alternative' },
  openGraph: {
    title: 'The Affordable Podium Alternative | BizzyBot',
    description:
      'Everything Podium answers, one-tenth the price. Calls, texts, email, chat & social with AI included — from $29/mo instead of $399+.',
    url: 'https://bizzybotai.com/podium-alternative',
    type: 'website',
  },
};

const faqs = [
  { q: 'How much does Podium cost vs BizzyBot?', a: 'Podium starts at $399/month for its Core plan, with Pro at $599 and Enterprise at $999+, and its AI receptionist is a $99/month add-on — so most businesses pay $500–800/month all in. BizzyBot starts at $29/month with AI included on every plan, up to $199/month for the Business tier.' },
  { q: 'Is BizzyBot a good Podium alternative for a small business?', a: 'Yes. Podium is built for established multi-location operators, and it has no small-business plan — $399/month is the entry point. BizzyBot is built for solo operators and small teams, includes the full platform on every tier, and starts at $29/month, which makes it a much better fit for a single-location or one-person business.' },
  { q: 'Does BizzyBot do everything Podium does?', a: 'BizzyBot covers the core front-office jobs most small businesses need: AI answering across phone, text, email, web chat, and social DMs, lead capture and scoring, appointment booking, and owner alerts. Podium adds reputation/review-management and payments tooling aimed at larger operators. For answering and booking, BizzyBot delivers the same outcome for a fraction of the price.' },
  { q: 'Does BizzyBot charge extra for AI like Podium does?', a: 'No. With Podium, the AI receptionist is a separate $99/month add-on on top of the base plan. With BizzyBot, AI is the product — it\'s included on every plan, including the $29/month Starter tier.' },
  { q: 'Can I switch from Podium to BizzyBot easily?', a: 'Yes. Setup takes minutes: you connect your channels, tell the AI about your business, pricing, and booking link, and it starts answering. There\'s a 14-day free trial so you can run it alongside your current setup before committing.' },
];

const rows = [
  ['Starting price', '$29/mo', '$399/mo'],
  ['AI receptionist', 'Included on every plan', '+$99/mo add-on'],
  ['Phone / voice AI', '✓', '✓'],
  ['Text (SMS) AI', '✓', '✓'],
  ['Email AI', '✓', 'Limited'],
  ['Web chat AI', '✓', '✓'],
  ['Facebook & Instagram DMs', '✓', 'Limited'],
  ['Appointment booking', '✓', '✓'],
  ['Built for', 'Solo & small business', 'Multi-location operators'],
  ['Typical all-in cost', '$29–199/mo', '$500–800/mo'],
];

export default function Page() {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bizzybotai.com' },
        { '@type': 'ListItem', position: 2, name: 'Podium Alternative', item: 'https://bizzybotai.com/podium-alternative' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-white overflow-x-hidden">
      <JsonLd data={schema} />
      <MarketingNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-600/10 to-transparent blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-violet-400 mb-4">Podium Alternative</span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">The affordable Podium alternative for small business</h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8">
            Podium starts at $399/month and charges another $99/month for its AI — most businesses end up paying $500–800.
            BizzyBot answers calls, texts, email, web chat, and social DMs with AI <span className="text-white">included on every plan</span>,
            starting at $29/month. Same front office, one-tenth the price, built for the solo operator instead of the franchise.
          </p>
          <CtaButtons className="justify-center" />
          <p className="text-sm text-gray-500 mt-4">
            Founding customers get <span className="text-violet-300 font-medium">50% off for 12 months</span> with code{' '}
            <span className="font-mono text-violet-300">BIZZYFOUNDER</span>
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-6 py-12 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">BizzyBot vs Podium</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[#1E2D40] rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-[#0D1421]">
                  <th className="text-left font-medium text-gray-400 px-4 py-3"> </th>
                  <th className="text-left font-bold text-white px-4 py-3">BizzyBot</th>
                  <th className="text-left font-medium text-gray-400 px-4 py-3">Podium</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-[#0A0F1C]' : 'bg-[#0D1421]'}>
                    <td className="px-4 py-3 text-gray-400">{r[0]}</td>
                    <td className="px-4 py-3 text-white font-medium">{r[1]}</td>
                    <td className="px-4 py-3 text-gray-400">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Podium pricing per{' '}
            <a href="https://www.replifast.com/blog/podium-pricing-2026" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">
              published 2026 pricing
            </a>. Comparison reflects publicly listed plans; features vary by plan and are subject to change.
          </p>
        </div>
      </section>

      {/* Why switch */}
      <section className="px-6 py-16 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Why small businesses pick BizzyBot over Podium</h2>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p><span className="text-white font-semibold">Podium has no small-business plan.</span> Its entry point is $399/month, designed for multi-location operators. For a single-location shop or a one-person business, that&apos;s overkill you pay for whether you use it or not.</p>
            <p><span className="text-white font-semibold">AI shouldn&apos;t be an upsell.</span> Podium charges $99/month extra for its AI receptionist. With BizzyBot, the AI is the whole product — included even on the $29 plan.</p>
            <p><span className="text-white font-semibold">No feature gating.</span> Every BizzyBot plan is the full platform. You move up a tier only for more volume, more voice minutes, and more seats — never to unlock a channel or a feature.</p>
          </div>
          <div className="mt-10">
            <CtaButtons />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <details key={i} className="bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-5 group">
                <summary className="font-semibold text-white cursor-pointer list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-gray-500 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="text-gray-400 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Get the whole front office for $29/month</h2>
          <p className="text-gray-300 mb-8">14-day free trial. Set up in minutes. No credit card to start.</p>
          <CtaButtons className="justify-center" />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
