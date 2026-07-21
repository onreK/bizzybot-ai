// Data-driven template for the industry SEO landing pages. Each page file
// (contractors, salons, real estate) exports its own metadata + passes content
// props here. GEO-structured on purpose: a 40-60 word direct answer at the very
// top (lifts AI-citation likelihood), industry stats WITH sources, an
// answer-ready FAQ mirrored into FAQPage schema, and the multi-channel + price
// positioning shared across every vertical.
import { MarketingNav, MarketingFooter, CtaButtons, JsonLd } from './MarketingChrome.js';

const BASE_URL = 'https://bizzybotai.com';

export default function VerticalLanding({
  slug,            // e.g. 'ai-receptionist-for-contractors'
  eyebrow,         // small label above H1
  h1,              // page headline
  answer,          // 40-60 word direct answer paragraph (the GEO money shot)
  stats,           // [{ value, label, source: { name, url } }]
  problemHeading,
  problemBody,     // array of paragraphs
  problemBullets,  // array of strings
  channelsIntro,   // one industry-tailored sentence for the "every channel" section
  faqs,            // [{ q, a }]
}) {
  const pageUrl = `${BASE_URL}/${slug}`;

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'BizzyBot',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: answer,
      url: pageUrl,
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Professional', price: '69', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Business', price: '199', priceCurrency: 'USD' },
      ],
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
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: h1, item: pageUrl },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-white overflow-x-hidden">
      <JsonLd data={schema} />
      <MarketingNav />

      {/* Hero — H1 + the 40-60 word direct answer */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-600/10 to-transparent blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-violet-400 mb-4">{eyebrow}</span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">{h1}</h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8">{answer}</p>
          <CtaButtons className="justify-center" />
          <p className="text-sm text-gray-500 mt-4">
            Founding customers get <span className="text-violet-300 font-medium">50% off for 12 months</span> with code{' '}
            <span className="font-mono text-violet-300">BIZZYFOUNDER</span>
          </p>
        </div>
      </section>

      {/* Stat band — real numbers, each cited (GEO: stats + sources get cited more) */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-sm text-gray-400 mb-2">{s.label}</div>
              <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-600 hover:text-gray-400 underline">
                Source: {s.source.name}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* The problem */}
      <section className="px-6 py-16 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">{problemHeading}</h2>
          {problemBody.map((p, i) => (
            <p key={i} className="text-gray-300 leading-relaxed mb-4">{p}</p>
          ))}
          {problemBullets?.length > 0 && (
            <ul className="mt-6 space-y-3">
              {problemBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-300">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Positioning: multi-channel + price (shared across every vertical) */}
      <section className="px-6 py-16 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Every channel, one plan — not just the phone</h2>
          <p className="text-gray-300 leading-relaxed mb-8">{channelsIntro}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              ['📞 Phone calls', 'Answers your business line 24/7 — or rings your cell first and only picks up if you can\'t.'],
              ['💬 Text messages', 'Replies to SMS instantly on the same number, so no lead goes quiet while your hands are full.'],
              ['✉️ Email', 'Reads every inbound email and sends a personalized reply in your voice — even at 2am.'],
              ['🌐 Web chat', 'A chat widget on your site that answers visitors and captures their details.'],
              ['📱 Facebook & Instagram DMs', 'Answers social messages the moment they land (as approvals roll out).'],
              ['📅 Booking', 'Checks your calendar, offers times, and books the appointment on the spot.'],
            ].map(([title, desc], i) => (
              <div key={i} className="bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-5">
                <div className="font-semibold text-white mb-1">{title}</div>
                <div className="text-sm text-gray-400 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
          <p className="text-gray-400 leading-relaxed mt-8">
            Most AI receptionists only answer the phone. The multi-channel platforms that do more — like Podium — start
            around <span className="text-white">$399/month</span> and charge extra for AI. BizzyBot does all of it from{' '}
            <span className="text-white">$29/month</span>, with every feature included on every plan. You only pay more for
            higher volume, more seats, and more voice minutes — never to unlock a channel.
          </p>
        </div>
      </section>

      {/* Pricing strip */}
      <section className="px-6 py-16 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Simple pricing — the whole platform on every tier</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-left">
            {[
              { name: 'Starter', price: '$29', line: '300 AI responses/mo · 15 voice min · 1 seat' },
              { name: 'Professional', price: '$69', line: '1,500 AI responses/mo · 100 voice min · 2 seats', popular: true },
              { name: 'Business', price: '$199', line: '5,000 AI responses/mo · 400 voice min · 5 seats' },
            ].map((p) => (
              <div key={p.name} className={`bg-[#0D1421] border rounded-2xl p-6 ${p.popular ? 'border-violet-500/50' : 'border-[#1E2D40]'}`}>
                {p.popular && <div className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider mb-2">Most popular</div>}
                <div className="font-semibold text-white mb-1">{p.name}</div>
                <div className="text-3xl font-bold text-white mb-3">{p.price}<span className="text-sm text-gray-500 font-normal">/mo</span></div>
                <div className="text-sm text-gray-400 leading-relaxed">{p.line}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <CtaButtons className="justify-center" />
          </div>
        </div>
      </section>

      {/* FAQ — visible + mirrored into FAQPage schema above */}
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
          <h2 className="text-3xl font-bold mb-4">Stop losing leads to voicemail</h2>
          <p className="text-gray-300 mb-8">Set up in minutes. 14-day free trial. No credit card to start.</p>
          <CtaButtons className="justify-center" />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
