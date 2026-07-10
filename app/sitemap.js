// Auto-generates /sitemap.xml — add new public marketing pages here so
// search engines and AI crawlers discover them.
const BASE_URL = 'https://bizzybotai.com';

export default function sitemap() {
  const pages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/demo', priority: 0.8, changeFrequency: 'monthly' },
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
