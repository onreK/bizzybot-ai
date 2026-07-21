import { MarketingNav, MarketingFooter, CtaButtons, JsonLd } from '@/components/marketing/MarketingChrome.js';

export const metadata = {
  title: 'How Much Does an AI Receptionist Cost? (2026 Pricing Guide)',
  description:
    'AI receptionists range from about $25 to $400+/month in 2026. Here\'s what each tier includes, what drives the price, and how to pick the right plan for a small business.',
  keywords:
    'AI receptionist cost, AI receptionist pricing, how much does an AI receptionist cost, AI answering service price, AI receptionist price 2026',
  alternates: { canonical: 'https://bizzybotai.com/blog/ai-receptionist-cost' },
  openGraph: {
    title: 'How Much Does an AI Receptionist Cost? (2026 Pricing Guide)',
    description:
      'AI receptionists range from ~$25 to $400+/month. What each tier includes, what drives the price, and how to choose. Full 2026 breakdown.',
    url: 'https://bizzybotai.com/blog/ai-receptionist-cost',
    type: 'article',
  },
};

const priceTable = [
  ['AIRA / Upfirst', '$24.95/mo', 'Voice, entry-level call volume'],
  ['Dialzara', '$29/mo', 'Voice, ~60 min included'],
  ['BizzyBot', '$29–199/mo', 'Voice + text + email + chat + social, AI included'],
  ['Rosie', '$49/mo', 'Voice, ~250 min, home-services focus'],
  ['Trillet', '$49/mo', 'Voice + SMS + WhatsApp'],
  ['Goodcall', '$59–208/mo', 'Voice, per-customer billing'],
  ['Smith.ai', '$95–300/mo', 'Hybrid AI + live human agents'],
  ['Jobber AI / My AI Front Desk', '$99/mo', 'Voice receptionist'],
  ['Birdeye', '$299+/mo', 'Multi-channel + reviews, AI included'],
  ['Podium', '$399/mo + $99 AI add-on', 'Multi-channel, built for multi-location'],
];

const faqs = [
  { q: 'How much does an AI receptionist cost per month?', a: 'In 2026, AI receptionists typically cost between about $25 and $400+ per month. Entry-level voice-only tools like AIRA and Upfirst start around $24.95/month, mid-tier options like Rosie and Goodcall run $49–208/month, and multi-channel platforms like Podium start at $399/month plus a $99 AI add-on. BizzyBot covers every channel from $29/month with AI included.' },
  { q: 'Why is there such a big price range?', a: 'Price is driven mainly by four things: how many voice minutes or calls are included, whether it covers just the phone or also text, email, chat and social, whether there\'s live human backup, and whether AI is included or sold as an add-on. Voice-only tools are cheapest; multi-channel platforms with AI as an upsell are the most expensive.' },
  { q: 'Is a cheaper AI receptionist worse?', a: 'Not necessarily. The cheapest tools are usually voice-only, so they\'re a fine fit if all you need is phone answering. The gap most small businesses hit is that their leads also text, email, and DM — and covering those has historically meant jumping to a $300–400/month platform. Newer tools close that gap at a low price.' },
  { q: 'What\'s the cheapest AI receptionist that answers more than the phone?', a: 'BizzyBot answers phone, text, email, web chat, and social DMs from $29/month, with AI included on every plan. That makes it one of the least expensive ways to get true multi-channel coverage, versus $299–400+/month for platforms like Birdeye or Podium.' },
];

export default function Page() {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'How Much Does an AI Receptionist Cost? (2026 Pricing Guide)',
      description:
        'A 2026 breakdown of AI receptionist pricing — what each tier includes, what drives the cost, and how to choose.',
      datePublished: '2026-07-21',
      dateModified: '2026-07-21',
      author: { '@type': 'Organization', name: 'BizzyBot' },
      publisher: {
        '@type': 'Organization',
        name: 'BizzyBot',
        logo: { '@type': 'ImageObject', url: 'https://bizzybotai.com/Bizzybot Logo 2.png' },
      },
      mainEntityOfPage: 'https://bizzybotai.com/blog/ai-receptionist-cost',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-white overflow-x-hidden">
      <JsonLd data={schema} />
      <MarketingNav />

      <article className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-violet-400 mb-4">Pricing Guide</span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">How much does an AI receptionist cost?</h1>

          {/* GEO: 40-60 word direct answer up top */}
          <div className="bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-6 mb-10">
            <p className="text-lg text-gray-200 leading-relaxed">
              In 2026, an AI receptionist typically costs between <span className="text-white font-semibold">$25 and $400+ per month</span>.
              Entry-level voice-only tools start around $25/month, mid-tier options run $49–208/month, and multi-channel
              platforms like Podium start at $399/month plus a $99 AI add-on. BizzyBot covers every channel — phone, text,
              email, chat, and social — from <span className="text-white font-semibold">$29/month with AI included</span>.
            </p>
          </div>

          {/* Pricing table */}
          <h2 className="text-2xl font-bold mb-4">AI receptionist pricing in 2026, compared</h2>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm border border-[#1E2D40] rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-[#0D1421]">
                  <th className="text-left font-medium text-gray-400 px-4 py-3">Tool</th>
                  <th className="text-left font-medium text-gray-400 px-4 py-3">Starting price</th>
                  <th className="text-left font-medium text-gray-400 px-4 py-3">What you get</th>
                </tr>
              </thead>
              <tbody>
                {priceTable.map((r, i) => (
                  <tr key={i} className={r[0] === 'BizzyBot' ? 'bg-violet-500/10' : i % 2 ? 'bg-[#0A0F1C]' : 'bg-[#0D1421]'}>
                    <td className="px-4 py-3 font-medium text-white">{r[0]}</td>
                    <td className="px-4 py-3 text-gray-300">{r[1]}</td>
                    <td className="px-4 py-3 text-gray-400">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mb-10">
            Pricing compiled July 2026 from public sources including{' '}
            <a href="https://www.getnextphone.com/blog/best-ai-receptionist" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">NextPhone</a>,{' '}
            <a href="https://www.vellum.ai/blog/best-ai-receptionist-for-small-business" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">Vellum</a>, and{' '}
            <a href="https://www.replifast.com/blog/podium-pricing-2026" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">Replifast</a>. Plans and features change frequently — check each vendor for current pricing.
          </p>

          {/* What drives price */}
          <h2 className="text-2xl font-bold mb-4">What actually drives the price</h2>
          <p className="text-gray-300 leading-relaxed mb-4">Four things explain almost the entire price range:</p>
          <ul className="space-y-3 mb-10">
            {[
              ['Voice minutes / call volume', 'The biggest cost lever. AI voice is far more expensive to run than a text or email, so plans are metered by minutes or calls included.'],
              ['How many channels it covers', 'Phone-only tools are cheapest. Answering text, email, web chat, and social too has historically meant paying for an enterprise platform.'],
              ['Human backup', 'Hybrid services with live agents (like Smith.ai) cost more because you\'re also paying for people.'],
              ['Whether AI is included or an add-on', 'Some platforms (Podium) charge a separate monthly fee for the AI on top of the base plan. Others include it.'],
            ].map(([t, d], i) => (
              <li key={i} className="flex items-start gap-3 text-gray-300">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                <span><span className="text-white font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>

          {/* The gap */}
          <h2 className="text-2xl font-bold mb-4">The catch most small businesses hit</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            The cheap tools are almost all voice-only. But your leads don&apos;t only call — they text, they email, they DM you on
            Instagram. Covering all of that used to mean jumping from a $49 voice bot to a $300–400/month platform like Birdeye or
            Podium, with AI as a paid add-on on top.
          </p>
          <p className="text-gray-300 leading-relaxed mb-10">
            That&apos;s the gap BizzyBot was built for: every channel — phone, text, email, web chat, and social — with AI included on
            every plan, from $29/month. You only pay more for higher volume, more voice minutes, and more seats, never to unlock a
            channel. See how it works for{' '}
            <a href="/ai-receptionist-for-contractors" className="text-violet-300 underline hover:text-violet-200">contractors</a>,{' '}
            <a href="/ai-receptionist-for-salons" className="text-violet-300 underline hover:text-violet-200">salons</a>, and{' '}
            <a href="/ai-receptionist-for-real-estate" className="text-violet-300 underline hover:text-violet-200">real estate</a>,
            or compare it directly as a{' '}
            <a href="/podium-alternative" className="text-violet-300 underline hover:text-violet-200">Podium alternative</a>.
          </p>

          {/* FAQ */}
          <h2 className="text-2xl font-bold mb-6">Frequently asked questions</h2>
          <div className="space-y-4 mb-12">
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

          <div className="bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Try the multi-channel AI receptionist for $29/mo</h2>
            <p className="text-gray-300 mb-6">14-day free trial. Every channel included. Set up in minutes.</p>
            <CtaButtons className="justify-center" />
          </div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
