// Shared server-rendered chrome for the SEO landing pages (nav + footer + CTA
// + JSON-LD helper). Server components so each page ships crawlable static HTML
// with its own <script type="application/ld+json">. CTAs are plain links to
// /sign-up (no Clerk hooks) so these pages stay fully server-rendered.
import Image from 'next/image';

export function MarketingNav() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#070B14]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/Bizzybot Logo 2.png" alt="BizzyBot" width={28} height={28} className="w-full h-full object-contain" />
          </div>
          <span className="font-semibold text-white">BizzyBot</span>
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/pricing" className="hidden sm:inline text-gray-400 hover:text-white transition-colors">Pricing</a>
          <a href="/sign-in" className="text-gray-400 hover:text-white transition-colors">Sign in</a>
          <a href="/sign-up" className="bg-white text-[#070B14] font-medium px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
            Start free
          </a>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/Bizzybot Logo 2.png" alt="BizzyBot" width={28} height={28} className="w-full h-full object-contain" />
          </div>
          <span className="font-semibold text-white">BizzyBot</span>
        </a>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <a href="/ai-receptionist-for-contractors" className="hover:text-white transition-colors">For Contractors</a>
          <a href="/ai-receptionist-for-salons" className="hover:text-white transition-colors">For Salons</a>
          <a href="/ai-receptionist-for-real-estate" className="hover:text-white transition-colors">For Real Estate</a>
          <a href="/podium-alternative" className="hover:text-white transition-colors">Podium Alternative</a>
          <a href="/pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms</a>
        </div>
        <p className="text-xs text-gray-600">&copy; 2026 BizzyBot. All rights reserved.</p>
      </div>
    </footer>
  );
}

// Primary + secondary CTA pair, reused across pages.
export function CtaButtons({ primaryLabel = 'Start your 14-day free trial', className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row items-center gap-3 ${className}`}>
      <a
        href="/sign-up"
        className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity text-center"
      >
        {primaryLabel}
      </a>
      <a
        href="/pricing"
        className="w-full sm:w-auto border border-white/15 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/5 transition-colors text-center"
      >
        See pricing
      </a>
    </div>
  );
}

// Renders one or more schema.org objects as JSON-LD. Pass a single object or an
// array. Data here is 100% developer-authored static content (no user input),
// but we still escape '<' → < so a value could never break out of the
// <script> tag — the standard-safe way to emit JSON-LD.
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function JsonLd({ data }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(obj) }}
        />
      ))}
    </>
  );
}
