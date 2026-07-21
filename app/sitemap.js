// Auto-generates /sitemap.xml — add new public marketing pages here so
// search engines and AI crawlers discover them.
const BASE_URL = 'https://bizzybotai.com';

export default function sitemap() {
  const pages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    // Industry + comparison SEO landing pages (highest-intent buyer pages)
    { path: '/ai-receptionist-for-contractors', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/ai-receptionist-for-salons', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/ai-receptionist-for-real-estate', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/podium-alternative', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/blog/ai-receptionist-cost', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/demo', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return pages.map(p => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: new Date(),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
