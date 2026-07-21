import VerticalLanding from '@/components/marketing/VerticalLanding.js';

export const metadata = {
  title: 'AI Receptionist for Real Estate Agents',
  description:
    'An AI receptionist that answers every lead in seconds — calls, texts, and emails — even during showings. Qualifies buyers and sellers and books showings 24/7. From $29/mo.',
  keywords:
    'AI receptionist for real estate, real estate lead response, speed to lead real estate, AI for real estate agents, real estate answering service, AI lead capture real estate',
  alternates: { canonical: 'https://bizzybotai.com/ai-receptionist-for-real-estate' },
  openGraph: {
    title: 'AI Receptionist for Real Estate Agents | BizzyBot',
    description:
      'The first agent to respond wins the listing. BizzyBot answers every lead in seconds across calls, texts, and email — even during showings. From $29/mo.',
    url: 'https://bizzybotai.com/ai-receptionist-for-real-estate',
    type: 'website',
  },
};

export default function Page() {
  return (
    <VerticalLanding
      slug="ai-receptionist-for-real-estate"
      eyebrow="For Real Estate Agents"
      h1="The AI receptionist for real estate agents"
      answer="BizzyBot is an AI receptionist for real estate agents. It responds to every buyer and seller lead in seconds — by call, text, or email — even while you're at a showing, qualifies them, answers questions about a listing, and books the appointment on your calendar. It covers phone, SMS, email, web chat, and social from one place, starting at $29/month."
      stats={[
        { value: '78%', label: 'Of buyers work with the first agent who responds', source: { name: 'AgentZap', url: 'https://agentzap.ai/blog/real-estate-lead-statistics' } },
        { value: '21×', label: 'Higher conversion when you respond within 5 minutes', source: { name: 'AgentZap', url: 'https://agentzap.ai/blog/real-estate-lead-statistics' } },
        { value: '15 hrs', label: 'Average agent\'s actual lead response time', source: { name: 'AgentZap', url: 'https://agentzap.ai/blog/real-estate-lead-statistics' } },
      ]}
      problemHeading="The first agent to respond usually wins the deal"
      problemBody={[
        'In real estate, speed is everything: the vast majority of buyers go with whoever responds first, and replying within five minutes multiplies your conversion many times over. Yet the average agent takes more than 15 hours to respond to a new lead — because they\'re at a showing, in a closing, or asleep when the inquiry comes in.',
        'BizzyBot closes that gap. The instant a lead comes in — from a call, a text, a Zillow-style form on your site, or an email — it responds in seconds, answers questions about the property, qualifies the buyer or seller, and books the showing or call on your calendar. You show up already in the lead\'s good graces instead of 15 hours late.',
      ]}
      problemBullets={[
        'Responds in seconds, day or night, so you\'re always the first agent to reply.',
        'Answers by text — where 89% of consumers now prefer to communicate.',
        'Qualifies buyers vs. sellers and captures budget, timeline, and area before you ever pick up.',
        'Books showings and consultations directly on your calendar.',
      ]}
      channelsIntro="Leads come from everywhere — a call off your sign, a text, a form on your site, an email from a portal. BizzyBot answers all of them in seconds from one place, so no inquiry sits unanswered while you're mid-showing."
      faqs={[
        { q: 'How much does an AI receptionist for real estate cost?', a: 'BizzyBot starts at $29/month, with Professional at $69/month and Business at $199/month. Every plan includes the full platform — phone, text, email, web chat, social, and booking. Given the average commission, capturing even one extra deal a year pays for it many times over. There\'s a 14-day free trial.' },
        { q: 'Can it respond to leads faster than I can?', a: 'Yes — that\'s the point. BizzyBot replies within seconds, 24/7, while the average agent takes over 15 hours. Since most buyers work with the first agent to respond, being instant is often the difference between winning and losing the lead.' },
        { q: 'Will it text leads, not just call?', a: 'Yes. BizzyBot answers and initiates by text, which is how most consumers prefer to communicate, as well as by phone, email, and web chat — all from one dashboard.' },
        { q: 'Can it book showings on my calendar?', a: 'Yes. BizzyBot checks your availability, offers the lead open times, and books the showing or consultation directly on your connected calendar, then confirms it.' },
        { q: 'How is this different from my CRM or lead tool?', a: 'A CRM stores leads and waits for you to act. BizzyBot is the front line that actually responds to the lead in seconds, has the conversation, qualifies them, and books the appointment — then hands you a warm, scheduled lead instead of a cold row in a database.' },
      ]}
    />
  );
}
