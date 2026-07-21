import VerticalLanding from '@/components/marketing/VerticalLanding.js';

export const metadata = {
  title: 'AI Receptionist for Salons & Spas',
  description:
    'An AI receptionist that books appointments while your hands are busy — answers calls, texts, and DMs 24/7, fills your calendar, and cuts no-shows. For salons & spas. From $29/mo.',
  keywords:
    'AI receptionist for salons, salon answering service, AI booking for spas, salon appointment booking AI, AI receptionist for spa, after hours booking salon',
  alternates: { canonical: 'https://bizzybotai.com/ai-receptionist-for-salons' },
  openGraph: {
    title: 'AI Receptionist for Salons & Spas | BizzyBot',
    description:
      'Bookings answered while your hands are busy. BizzyBot answers calls, texts, and DMs, fills your calendar 24/7, and reduces no-shows. From $29/mo.',
    url: 'https://bizzybotai.com/ai-receptionist-for-salons',
    type: 'website',
  },
};

export default function Page() {
  return (
    <VerticalLanding
      slug="ai-receptionist-for-salons"
      eyebrow="For Salons, Spas & Studios"
      h1="The AI receptionist for salons & spas"
      answer="BizzyBot is an AI receptionist for salons and spas. It answers every call, text, and DM 24/7 — while your hands are busy with a client — shares your booking link or books the appointment directly, sends reminders to cut no-shows, and covers the after-hours rush. It handles phone, SMS, email, web chat, and social from one place, starting at $29/month."
      stats={[
        { value: '46–50%', label: 'Of salon bookings happen outside business hours', source: { name: 'CloudTalk', url: 'https://www.cloudtalk.io/blog/best-ai-receptionist-for-salons-spas/' } },
        { value: '35–40%', label: 'Of calls missed during peak hours at hair & nail salons', source: { name: 'CloudTalk', url: 'https://www.cloudtalk.io/blog/best-ai-receptionist-for-salons-spas/' } },
        { value: '$150–300', label: 'Lost revenue from a single missed color appointment', source: { name: 'CloudTalk', url: 'https://www.cloudtalk.io/blog/best-ai-receptionist-for-salons-spas/' } },
      ]}
      problemHeading="You can't answer the phone mid-appointment — so bookings walk"
      problemBody={[
        'When your hands are in a client\'s hair, you can\'t stop to answer the phone or reply to a DM. But that\'s exactly when new clients are trying to book — and nearly half of all salon bookings happen after you\'ve closed for the day. Every unanswered call and after-hours message is a chair that stays empty.',
        'BizzyBot answers the moment a message lands, any hour of the day. It shares your booking link or books directly, answers questions about services and pricing, and sends reminders that keep no-shows down — so your calendar fills itself while you focus on the client in front of you.',
      ]}
      problemBullets={[
        'Answers and books 24/7, including the after-hours window where half your bookings come from.',
        'Replies to Instagram and Facebook DMs — where a lot of salon clients reach out first.',
        'Sends appointment reminders to cut the 20–30% no-show rate.',
        'Answers "how much is a balayage?" and "do you have Saturday?" instantly, every time.',
      ]}
      channelsIntro="Salon clients don't all pick up the phone — many text, and even more slide into your Instagram or Facebook DMs. BizzyBot answers every one of those, so you're not losing a booking just because it came in on the channel you couldn't watch."
      faqs={[
        { q: 'How much does an AI receptionist for salons cost?', a: 'BizzyBot starts at $29/month, with Professional at $69/month and Business at $199/month. Every plan includes phone, text, email, web chat, social DMs, and booking — no features are locked behind a higher tier. There\'s a 14-day free trial.' },
        { q: 'Can it book directly into my scheduling software?', a: 'BizzyBot can share your existing booking link (Vagaro, Booksy, Fresha, Calendly, and others) so clients book in the system you already use, and it can book directly on a connected calendar. It confirms the appointment on the spot over phone, text, email, or chat.' },
        { q: 'Does it answer Instagram and Facebook messages?', a: 'Yes. BizzyBot answers social media DMs alongside calls, texts, and email from one dashboard, so the clients who reach out on Instagram or Facebook get an instant reply instead of waiting until you\'re free.' },
        { q: 'Will it help with no-shows?', a: 'Yes. BizzyBot can send appointment reminders and follow-ups, which is one of the most effective ways to reduce the 20–30% no-show rate salons typically see.' },
        { q: 'How is this different from the booking app I already have?', a: 'Your booking app waits for a client to come find it. BizzyBot proactively answers the call, text, or DM the client actually sent, has the conversation, and then books them — capturing the people who would otherwise hang up or never fill out the form.' },
      ]}
    />
  );
}
