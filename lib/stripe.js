import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const getStripe = () => {
  if (typeof window !== 'undefined') {
    return import('@stripe/stripe-js').then(({ loadStripe }) =>
      loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    );
  }
  return null;
};

export const PRICING_PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    priceId: 'price_1TcLVq01O3SsJO6lr6j8MbWK',
    features: [
      'The full BizzyBot platform — no feature gates',
      '300 AI responses/month across every channel',
      'Voice AI — 15 minutes/month',
      '1 user seat',
    ],
    popular: false
  },
  professional: {
    name: 'Professional',
    price: 69,
    priceId: 'price_1TcLVr01O3SsJO6lyOqWsyhT',
    features: [
      'The full BizzyBot platform — no feature gates',
      '1,500 AI responses/month — 5× the volume',
      'Voice AI — 100 minutes/month',
      '2 user seats',
    ],
    popular: true
  },
  business: {
    name: 'Business',
    price: 199,
    priceId: 'price_1TcLVs01O3SsJO6lUmCp5Ojl',
    features: [
      'The full BizzyBot platform — no feature gates',
      '5,000 AI responses/month',
      'Voice AI — 400 minutes/month',
      '5 user seats',
      'Priority support',
    ],
    popular: false
  }
};

// Plan feature limits — used for enforcement across the app
// All channels available on all plans; plans differ only by monthly response pool + seats
export const PLAN_LIMITS = {
  starter: {
    responsesPerMonth: 300,
    voiceMinutes: 15,
    seats: 1,
  },
  professional: {
    responsesPerMonth: 1500,
    voiceMinutes: 100,
    seats: 2,
  },
  business: {
    responsesPerMonth: 5000,
    voiceMinutes: 400,
    seats: 5,
  }
};
