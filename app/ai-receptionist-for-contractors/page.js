import VerticalLanding from '@/components/marketing/VerticalLanding.js';

export const metadata = {
  title: 'AI Receptionist for Contractors, Plumbers & HVAC',
  description:
    'An AI receptionist that answers every call, text, and email while you\'re on the job — books the appointment and texts you the hot ones. For contractors, plumbers & HVAC. From $29/mo.',
  keywords:
    'AI receptionist for contractors, AI answering service for plumbers, HVAC answering service, AI receptionist for HVAC, missed call text back contractors, 24/7 answering service home services',
  alternates: { canonical: 'https://bizzybotai.com/ai-receptionist-for-contractors' },
  openGraph: {
    title: 'AI Receptionist for Contractors, Plumbers & HVAC | BizzyBot',
    description:
      'Never lose a job to voicemail again. BizzyBot answers calls, texts, and emails 24/7, books appointments, and texts you the hot leads. From $29/mo.',
    url: 'https://bizzybotai.com/ai-receptionist-for-contractors',
    type: 'website',
  },
};

export default function Page() {
  return (
    <VerticalLanding
      slug="ai-receptionist-for-contractors"
      eyebrow="For Trades & Home Services"
      h1="The AI receptionist for contractors, plumbers & HVAC"
      answer="BizzyBot is an AI receptionist built for the trades. It answers every call, text, and email 24/7 — even when you're on a roof or under a sink — qualifies the lead, books the job on your calendar, and texts you the hot ones. It handles calls, SMS, email, web chat, and social from one place, starting at $29/month."
      stats={[
        { value: '$45,600', label: 'Lost per year by the average HVAC business to missed calls', source: { name: 'SkipCalls', url: 'https://skipcalls.com/blog/ai-receptionist-for-hvac-contractors-missed-calls' } },
        { value: '74%', label: 'Of contractor calls go unanswered — techs are on the job', source: { name: 'LeadTruffle', url: 'https://www.leadtruffle.co/blog/best-ai-answering-services-contractors-2026/' } },
        { value: '85%', label: 'Chance a caller rings a competitor next after a missed call', source: { name: 'SkipCalls', url: 'https://skipcalls.com/blog/ai-receptionist-for-hvac-contractors-missed-calls' } },
      ]}
      problemHeading="Every missed call is a job going to your competitor"
      problemBody={[
        'When you\'re on a job site, you physically can\'t answer the phone — and the studies show it: contractors miss the majority of their calls, and home-service businesses lose tens of thousands of dollars a year to voicemail. A homeowner with a burst pipe or a dead furnace isn\'t leaving a message. They\'re calling the next name on the list.',
        'A traditional answering service costs a fortune and still just takes a message. BizzyBot actually handles the call: it answers in your business\'s voice, quotes your pricing, qualifies whether it\'s a real job, books it on your calendar, and fires you a text the second a big one comes in — so you can call back from the truck.',
      ]}
      problemBullets={[
        'Answers 24/7 — nights, weekends, and during the heat-wave rush when 20 people call at once.',
        'Rings your cell first if you want — only picks up if you can\'t, so you never lose your personal touch.',
        'Texts the caller back automatically if they hang up before booking.',
        'Sends you an instant alert on every hot, high-value job.',
      ]}
      channelsIntro="A homeowner might call, another might text your number, another fills out the form on your website. BizzyBot answers all of it — not just the phone — so no lead slips through whichever way it comes in."
      faqs={[
        { q: 'How much does an AI receptionist for contractors cost?', a: 'BizzyBot starts at $29/month for the Starter plan, $69/month for Professional, and $199/month for Business. Every plan includes the full platform — phone, text, email, web chat, social, and booking. You only pay more for higher volume, more voice minutes, and more user seats. There\'s a 14-day free trial.' },
        { q: 'Will it sound like a robot to my customers?', a: 'No. BizzyBot uses a natural AI voice and answers in your business\'s name with your pricing, service area, and process. You can set it to ring your own cell phone first and only have the AI pick up when you can\'t answer, so your regulars still reach you directly.' },
        { q: 'Can it book jobs on my calendar?', a: 'Yes. BizzyBot checks your availability, offers the caller open times, and books the appointment directly on your connected calendar, then sends a confirmation. It works over the phone, by text, by email, and through your website chat.' },
        { q: 'Does it work if I\'m already using a phone number?', a: 'Yes. BizzyBot provisions a business number for your AI, and you can forward your existing number to it, or have it ring your cell first and back you up only on no-answer. Setup takes minutes.' },
        { q: 'What makes BizzyBot different from a voice-only AI answering service?', a: 'Most AI receptionists only answer the phone. BizzyBot answers phone, text, email, web chat, and social media DMs from one dashboard — and the multi-channel platforms that do that (like Podium) start around $399/month and charge extra for AI. BizzyBot includes everything from $29/month.' },
      ]}
    />
  );
}
