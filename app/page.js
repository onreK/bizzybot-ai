'use client';

import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Brain, ArrowRight, CheckCircle, Star, Zap,
  MessageSquare, Mail, Smartphone, BarChart3,
  Menu, X, Bot, ChevronRight, TrendingUp, Shield,
  Phone, Wrench, Home, Scissors, HeartHandshake,
} from 'lucide-react';

function DashboardPreview() {
  const leads = [
    { name: 'Sarah Mitchell', score: 94, channel: 'Voice', message: 'Called about a consultation this week — AI booked it', time: '2m', hot: true },
    { name: 'James Kowalski', score: 71, channel: 'SMS', message: 'What are your rates for a full inspection?', time: '9m', hot: false },
    { name: 'Maria Lopez', score: 68, channel: 'Chat', message: 'Do you service the downtown area?', time: '17m', hot: false },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-6 bg-gradient-to-r from-violet-600/15 to-cyan-500/15 blur-3xl rounded-3xl" />
      <div className="relative bg-[#0D1421] border border-[#1E2D40] rounded-2xl overflow-hidden shadow-2xl">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2D40] bg-[#090E19]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1">
            <div className="bg-[#1A2438] rounded-md px-3 py-1 text-xs text-gray-500 flex items-center gap-2 max-w-xs mx-auto">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              bizzybot.ai/dashboard
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Today's Leads", value: '14', delta: '+3', color: 'text-green-400' },
              { label: 'AI Replies Sent', value: '31', delta: '100%', color: 'text-violet-400' },
              { label: 'Hot Leads', value: '6', delta: '↑2', color: 'text-amber-400' },
            ].map((stat, i) => (
              <div key={i} className="bg-[#0A1020] rounded-xl p-3 border border-[#1E2D40]">
                <div className="text-[10px] text-gray-500 mb-1">{stat.label}</div>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold text-white">{stat.value}</span>
                  <span className={`text-xs font-medium mb-0.5 ${stat.color}`}>{stat.delta}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Lead rows */}
          <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wider mb-3">Recent Conversations</div>
          <div className="space-y-2">
            {leads.map((lead, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#0A1020] rounded-xl p-3.5 border border-[#1E2D40]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {lead.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{lead.name}</span>
                    {lead.hot && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">HOT</span>
                    )}
                    <span className="text-[10px] text-gray-600 ml-auto">{lead.time} ago</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{lead.message}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-600">{lead.channel}</span>
                    <span className="text-[10px] text-gray-700">·</span>
                    <span className="text-[10px] text-violet-400 flex items-center gap-1">
                      <Bot className="w-2.5 h-2.5" /> AI replied
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${lead.score >= 80 ? 'text-red-400' : 'text-amber-400'}`}>
                    {lead.score}
                  </div>
                  <div className="text-[10px] text-gray-600">score</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            AI is monitoring 6 channels in real time
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && user) router.push('/dashboard');
  }, [isLoaded, user, router]);

  const features = [
    {
      icon: <Phone className="w-5 h-5" />,
      gradient: 'from-violet-600 to-purple-600',
      title: 'AI Voice Calls',
      description: 'Your AI answers your business line 24/7 — or rings your cell first and only picks up if you can\'t. Every call transcribed, summarized, and scored.',
    },
    {
      icon: <Smartphone className="w-5 h-5" />,
      gradient: 'from-blue-600 to-cyan-600',
      title: 'SMS AI',
      description: 'Responds to texts instantly on the same number your AI answers calls on — so no lead goes quiet while your hands are full.',
    },
    {
      icon: <Mail className="w-5 h-5" />,
      gradient: 'from-cyan-600 to-blue-600',
      title: 'Email AI',
      description: 'Reads every inbound email, drafts a personalized reply in your voice, and sends it — even at 2am.',
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      gradient: 'from-emerald-600 to-teal-600',
      title: 'Web Chat AI',
      description: 'Embeddable chat widget that qualifies visitors, answers questions, and captures contact info while you are busy.',
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      gradient: 'from-amber-500 to-orange-600',
      title: 'Lead Intelligence',
      description: 'Every conversation gets a lead score. Hot leads surface instantly — with a text + email alert the moment one appears.',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      gradient: 'from-rose-600 to-orange-600',
      title: 'Scheduling',
      description: 'The AI shares your booking link — or books directly on your calendar and sends the invite — when a lead is ready.',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Connect your channels',
      body: 'Get your business number (AI answers calls and texts on it), connect your email, and drop the chat widget on your site — all in under 10 minutes.',
    },
    {
      step: '02',
      title: 'Configure your AI',
      body: 'Describe your business, set your tone, and add your pricing. The AI learns your voice and represents your brand.',
    },
    {
      step: '03',
      title: 'Watch it work',
      body: 'Leads get instant replies. Follow-ups go out automatically. Hot leads land in your inbox the moment they are ready.',
    },
  ];

  const industries = [
    {
      icon: <Wrench className="w-5 h-5" />,
      name: 'Trades & Home Services',
      pain: 'Never miss a call from a crawlspace again. The AI answers while you\'re on the job — and texts you when it\'s a hot one.',
    },
    {
      icon: <Home className="w-5 h-5" />,
      name: 'Real Estate',
      pain: 'The first agent to respond usually wins the listing. Your AI replies to every inquiry in seconds — even during showings.',
    },
    {
      icon: <Scissors className="w-5 h-5" />,
      name: 'Salons & Studios',
      pain: 'Bookings answered while your hands are busy. The AI shares your booking link and fills your calendar between clients.',
    },
    {
      icon: <HeartHandshake className="w-5 h-5" />,
      name: 'Clinics & Practices',
      pain: 'Full waiting room, zero phone tag. After-hours inquiries get answered, qualified, and scheduled before you open.',
    },
  ];

  const plans = [
    {
      name: 'Starter',
      price: '$29',
      description: 'Solo operators and small businesses getting started with AI',
      features: ['300 AI responses/mo', 'Voice AI — 15 min/mo', 'Email, SMS & Web Chat AI', 'Facebook & Instagram AI (coming soon)', 'Lead tracking & analytics'],
      cta: 'Start free trial',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$69',
      description: 'Growing businesses that need more volume and seats',
      features: [
        'Everything in Starter',
        '1,500 AI responses/mo',
        'Voice AI — 100 min/mo',
        '2 user seats',
      ],
      cta: 'Start free trial',
      popular: true,
    },
    {
      name: 'Business',
      price: '$199',
      description: 'High-volume operations at full scale',
      features: [
        'Everything in Professional',
        '5,000 AI responses/mo',
        'Voice AI — 400 min/mo',
        '5 user seats',
        'Priority support',
      ],
      cta: 'Start free trial',
      popular: false,
    },
  ];

  const capabilities = [
    'Automated follow-ups',
    'Lead scoring',
    'Escalation handling',
    'Multi-channel inbox',
    'Analytics dashboard',
    'Document link sending',
    'Facebook & Instagram DMs (coming soon)',
    'Custom AI tone & voice',
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-white overflow-x-hidden">
      <SignedOut>
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none select-none">
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(to right, rgb(255 255 255) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
            }}
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-violet-600/10 to-transparent blur-3xl" />
        </div>

        {/* Nav */}
        <nav className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#070B14]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                <Image src="/Bizzybot Logo 2.png" alt="BizzyBot" width={28} height={28} className="w-full h-full object-contain" />
              </div>
              <span className="font-semibold text-white">BizzyBot</span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
              <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="/demo" className="hover:text-white transition-colors">Demo</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <SignInButton mode="modal">
                <button className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
                  Sign in
                </button>
              </SignInButton>
              <SignInButton mode="modal">
                <button className="text-sm bg-white text-[#070B14] font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Start free trial
                </button>
              </SignInButton>
            </div>

            <button className="md:hidden text-gray-400" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {isMenuOpen && (
            <div className="md:hidden border-t border-white/[0.06] bg-[#070B14]/95 backdrop-blur-xl">
              <div className="px-6 py-4 space-y-4 text-sm">
                <a href="#how-it-works" className="block text-gray-400 hover:text-white" onClick={() => setIsMenuOpen(false)}>How it works</a>
                <a href="#features" className="block text-gray-400 hover:text-white" onClick={() => setIsMenuOpen(false)}>Features</a>
                <a href="#pricing" className="block text-gray-400 hover:text-white" onClick={() => setIsMenuOpen(false)}>Pricing</a>
                <a href="/demo" className="block text-gray-400 hover:text-white" onClick={() => setIsMenuOpen(false)}>Demo</a>
                <SignInButton mode="modal">
                  <button className="block text-gray-400 hover:text-white">Sign in</button>
                </SignInButton>
                <SignInButton mode="modal">
                  <button className="block w-full bg-white text-[#070B14] font-semibold py-2.5 rounded-lg text-center">
                    Start free trial
                  </button>
                </SignInButton>
              </div>
            </div>
          )}
        </nav>

        {/* Structured data — helps Google + AI engines (ChatGPT, Perplexity)
            understand and cite BizzyBot when answering "best AI receptionist" */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'BizzyBot AI',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description:
                'AI receptionist that answers calls, texts, emails, web chat, and social media DMs 24/7 — capturing, scoring, and nurturing every lead and booking appointments automatically.',
              url: 'https://bizzybotai.com',
              offers: [
                { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'USD' },
                { '@type': 'Offer', name: 'Professional', price: '69', priceCurrency: 'USD' },
                { '@type': 'Offer', name: 'Business', price: '199', priceCurrency: 'USD' },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'What is BizzyBot AI?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'BizzyBot AI is an AI receptionist for small businesses. It answers your phone calls, text messages, emails, website chat, and social media DMs 24/7, captures and scores every lead, books appointments directly on your calendar, and alerts you the moment a hot lead comes in.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How much does an AI receptionist cost?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'BizzyBot AI starts at $29/month for the Starter plan (all channels included), $69/month for Professional, and $199/month for Business with 400 AI voice minutes. Every plan includes a 14-day free trial with no credit card required. Comparable voice-only AI receptionists typically cost $49-$500/month.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What channels does the AI answer?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Phone calls (with the option to ring your cell first and have the AI pick up only if you miss it), SMS text messages, email (Gmail and Outlook), your website chat widget, and Facebook Messenger and Instagram DMs — all from one number and one dashboard.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Can the AI book appointments for me?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. Connect your calendar and the AI offers your real open time slots to leads, books confirmed appointments directly on your calendar at your chosen meeting length, and sends the lead a confirmation — over text, email, or chat.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How long does setup take?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Under 10 minutes: get your business number (the AI answers calls and texts on it), connect your email, and drop the chat widget on your website. The AI learns your business from a simple settings page you control — no coding required.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Will I lose control of how the AI talks to my customers?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'No. You control the AI’s tone, knowledge, pricing answers, and escalation rules from your dashboard. You can have it ring you first on calls, escalate complex questions to you, and alert you instantly by text and email for hot leads.',
                  },
                },
              ],
            }),
          }}
        />

        {/* Hero */}
        <section className="relative pt-40 pb-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
                <Zap className="w-3 h-3" />
                The AI receptionist for any client-facing business
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
                Every lead answered.
                <br />
                <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  While you sleep.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                BizzyBot is the AI receptionist that answers your calls, texts, emails, web chat, and social
                DMs — capturing and scoring every lead, booking appointments straight onto your calendar,
                and following up so nothing slips.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <SignInButton mode="modal">
                  <button className="flex items-center gap-2 bg-white text-[#070B14] font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-100 transition-all text-sm">
                    Start 14-day free trial
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </SignInButton>
                <a
                  href="/demo"
                  className="flex items-center gap-2 border border-white/10 text-gray-300 px-7 py-3.5 rounded-xl hover:bg-white/5 transition-all text-sm"
                >
                  See it in action
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              <p className="text-xs text-gray-600 mt-4">No credit card required · Cancel anytime</p>
            </div>

            <DashboardPreview />
          </div>
        </section>

        {/* Founding customer strip */}
        <section className="border-y border-white/[0.06] py-10 px-6 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-semibold rounded-full whitespace-nowrap">
                FOUNDING CUSTOMERS
              </span>
              <span className="text-gray-400 text-sm">
                Be one of our first — <span className="text-white font-medium">50% off for 12 months</span> with code <span className="text-violet-300 font-mono">BIZZYFOUNDER</span>
              </span>
            </div>
            <div className="flex gap-10 text-center">
              {[
                { value: '24/7', label: 'Your AI never clocks out' },
                { value: '6', label: 'Channels, one dashboard' },
                { value: '10 min', label: 'Setup, no developers' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">How it works</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Live in under 10 minutes</h2>
              <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                No developers, no complicated setup. Connect your accounts, describe your business, and BizzyBot starts working immediately.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-10 relative">
              <div className="hidden md:block absolute top-6 left-[calc(33%+24px)] right-[calc(33%+24px)] h-px bg-gradient-to-r from-violet-500/40 to-cyan-500/40" />
              {steps.map((step, i) => (
                <div key={i}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm mb-5">
                    {step.step}
                  </div>
                  <h3 className="font-semibold text-white text-lg mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-28 px-6 bg-white/[0.02] border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Features</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Your business, always on</h2>
              <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                One AI that handles every inbound channel — configured exactly for your business, not a generic chatbot.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="group bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-8 hover:border-[#2A3A55] transition-all duration-300"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-5`}>
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-white text-lg mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
              {capabilities.map((cap, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  {cap}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries */}
        <section id="industries" className="py-28 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Built for your business</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Any business that lives on leads</h2>
              <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                You describe your business once — pricing, services, tone — and the AI represents it on every channel.
                No industry templates, no generic chatbot answers.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {industries.map((ind, i) => (
                <div key={i} className="bg-[#0D1421] border border-[#1E2D40] rounded-2xl p-7 hover:border-[#2A3A55] transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-5">
                    {ind.icon}
                  </div>
                  <h3 className="font-semibold text-white text-base mb-2">{ind.name}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{ind.pain}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-28 px-6 bg-white/[0.02] border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Pricing</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Transparent, simple pricing</h2>
              <p className="text-gray-400 mt-4 text-sm">14-day free trial on every plan. No credit card required.</p>
              <p className="text-violet-300 mt-2 text-sm">
                Founding customers: <span className="font-semibold">50% off for 12 months</span> with code <span className="font-mono">BIZZYFOUNDER</span>
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, i) => (
                <div
                  key={i}
                  className={`relative rounded-2xl p-8 ${
                    plan.popular
                      ? 'bg-gradient-to-b from-violet-600/20 to-[#0D1421] border-2 border-violet-500/50'
                      : 'bg-[#0D1421] border border-[#1E2D40]'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      Most popular
                    </div>
                  )}
                  <div className="mb-6">
                    <div className="font-semibold text-white text-lg mb-1">{plan.name}</div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-gray-500 text-sm">/mo</span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{plan.description}</p>
                  </div>
                  <div className="space-y-2.5 mb-8">
                    {plan.features.map((feature, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-300">
                        <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <SignInButton mode="modal">
                    <button
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        plan.popular
                          ? 'bg-violet-600 hover:bg-violet-700 text-white'
                          : 'bg-white/8 hover:bg-white/12 text-white border border-white/10'
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </SignInButton>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-28 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/15 to-cyan-600/15 blur-3xl rounded-3xl" />
              <div className="relative bg-[#0D1421] border border-[#1E2D40] rounded-3xl p-16 text-center">
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                  Start for free.
                  <br />
                  <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    See results this week.
                  </span>
                </h2>
                <p className="text-gray-400 mb-10 max-w-lg mx-auto text-sm leading-relaxed">
                  Connect your first channel in under 10 minutes. 14 days free — no credit card, no commitment.
                </p>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center gap-2 bg-white text-[#070B14] font-semibold px-8 py-4 rounded-xl hover:bg-gray-100 transition-all text-sm">
                    Start your free trial
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </SignInButton>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] py-12 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                <Image src="/Bizzybot Logo 2.png" alt="BizzyBot" width={28} height={28} className="w-full h-full object-contain" />
              </div>
              <span className="font-semibold text-white">BizzyBot AI</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="/demo" className="hover:text-white transition-colors">Demo</a>
            </div>
            <p className="text-xs text-gray-600">&copy; 2026 BizzyBot AI. All rights reserved.</p>
          </div>
        </footer>
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Redirecting to your dashboard...</p>
          </div>
        </div>
      </SignedIn>
    </div>
  );
}
