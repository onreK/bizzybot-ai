'use client';

import { useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Check, Zap, Star, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { PRICING_PLANS } from '../../lib/stripe';
import { PLATFORM_FEATURES, PLAN_VOLUME } from '../../lib/plan-features';

const ICONS = {
  starter:      <Zap  className="w-6 h-6 text-blue-400" />,
  professional: <Star className="w-6 h-6 text-violet-400" />,
  business:     <Crown className="w-6 h-6 text-amber-400" />,
};

const ACCENT = {
  starter:      'text-blue-400',
  professional: 'text-violet-400',
  business:     'text-amber-400',
};

export default function PricingPage() {
  const [loading, setLoading] = useState(null);
  const { user, isLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handleSubscribe = async (priceId, planName) => {
    if (!isSignedIn) { router.push('/sign-up'); return; }
    setLoading(planName);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planName }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      if (stripe) await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const currentPlan = user?.publicMetadata?.subscriptionPlan || null;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-6xl mx-auto px-6 py-20">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Simple, honest pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AI that works while you don't
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            BizzyBot responds to your leads 24/7 across email, SMS, and web — so you never miss a customer again.
          </p>
          {currentPlan && (
            <div className="mt-6 inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full border border-green-500/20 text-sm">
              <Check className="w-4 h-4" />
              Currently on {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {Object.entries(PRICING_PLANS).map(([key, plan]) => {
            const isCurrentPlan = currentPlan === key;
            const isPopular = plan.popular;

            return (
              <div
                key={key}
                className={`relative rounded-2xl p-8 border transition-all ${
                  isPopular
                    ? 'bg-violet-500/5 border-violet-500/40 shadow-xl shadow-violet-500/10'
                    : 'bg-[#161B22] border-gray-800'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white px-4 py-1 rounded-full text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    {ICONS[key]}
                    <h3 className={`text-lg font-bold ${ACCENT[key]}`}>{plan.name}</h3>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-500 mb-1">/month</span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">
                    {PLAN_VOLUME[key]?.tagline || ''}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={loading === plan.name || isCurrentPlan}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20 cursor-not-allowed'
                      : isPopular
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-[#0D1117] border border-gray-700 text-white hover:border-gray-500'
                  }`}
                >
                  {loading === plan.name ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    <>
                      {isSignedIn ? `Get ${plan.name}` : `Start for $${plan.price}/mo`}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Everything included — no feature gates */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              No feature gates
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Every plan includes the full platform</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Pick a plan for your volume — everything below is yours from day one, on every tier.
            </p>
          </div>
          <div className="bg-[#161B22] border border-gray-800 rounded-2xl p-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              {PLATFORM_FEATURES.map((feature, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Common questions</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Changes take effect immediately and your billing is prorated.' },
              { q: 'Is there a free trial?', a: 'All plans come with a 14-day free trial. No credit card required to start.' },
              { q: 'What counts as an AI response?', a: 'Each time the AI sends a reply to a lead — via email, SMS, web chat, or social — that counts as one response.' },
              { q: 'Can I cancel anytime?', a: 'Yes, no long-term contracts. Cancel from your dashboard and you keep access until the end of your billing period.' },
            ].map((faq, i) => (
              <div key={i} className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-2 text-sm">{faq.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {!isSignedIn && (
          <div className="text-center">
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-10 max-w-xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to stop missing leads?</h2>
              <p className="text-gray-400 mb-6 text-sm">Start your 14-day free trial. No credit card required.</p>
              <button
                onClick={() => router.push('/sign-up')}
                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
              >
                Get started free
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
