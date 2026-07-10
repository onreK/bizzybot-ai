// Auto-generates /robots.txt. Marketing pages are open to everyone —
// including AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended),
// which we WANT indexing us so AI engines can recommend BizzyBot.
// Dashboard/app/api routes are kept out of indexes.
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/admin', '/api/', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: 'https://bizzybotai.com/sitemap.xml',
  };
}
