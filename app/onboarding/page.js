'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Building2, MessageSquare, BookOpen, ChevronRight, ChevronLeft, Check, Zap, Star, Shield, Clock, Phone, Globe } from 'lucide-react';
import { getStoredAttribution } from '@/lib/attribution-client.js';

const TOTAL_STEPS = 4;

const INDUSTRIES = [
  'Real Estate', 'Healthcare', 'Legal Services', 'Financial Services',
  'Home Services', 'Retail / E-commerce', 'Fitness & Wellness', 'Restaurants & Food',
  'Education', 'Marketing & Agency', 'SaaS / Technology', 'Consulting', 'Other'
];

const TONES = [
  { value: 'Professional', label: 'Professional', desc: 'Polished and business-like' },
  { value: 'Friendly',     label: 'Friendly',     desc: 'Warm and approachable' },
  { value: 'Formal',       label: 'Formal',       desc: 'Authoritative and precise' },
  { value: 'Casual',       label: 'Casual',       desc: 'Relaxed and conversational' },
];

const LENGTHS = [
  { value: 'Short',  label: 'Short',  desc: '1–3 sentences' },
  { value: 'Medium', label: 'Medium', desc: '2–5 sentences' },
  { value: 'Long',   label: 'Long',   desc: 'Detailed & thorough' },
];

const STEP_META = [
  { icon: Building2, label: 'Your Business' },
  { icon: MessageSquare, label: 'What You Do' },
  { icon: Bot,          label: 'AI Personality' },
  { icon: BookOpen,     label: "AI's Knowledge" },
];

// Small badge that shows what a field unlocks
function ImpactBadge({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
      <Icon className="w-3 h-3" />{text}
    </span>
  );
}

// Contrast box showing generic vs custom AI example
function BeforeAfter({ bad, good }) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
        <p className="text-xs text-red-400 font-medium mb-1.5">Without detail</p>
        <p className="text-xs text-gray-500 leading-relaxed italic">"{bad}"</p>
      </div>
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
        <p className="text-xs text-emerald-400 font-medium mb-1.5">With your detail</p>
        <p className="text-xs text-gray-300 leading-relaxed italic">"{good}"</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    phone: '',
    website: '',
    businessDescription: '',
    tone: 'Professional',
    responseLength: 'Medium',
    knowledgeBase: '',
    heardAboutUs: '',
  });

  useEffect(() => {
    fetch('/api/create-customer', { method: 'POST' }).catch(() => {});
  }, []);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isValid = () => {
    if (step === 1) return form.businessName.trim().length > 0 && form.industry.length > 0;
    if (step === 2) return form.businessDescription.trim().length > 0;
    if (step === 3) return form.tone.length > 0 && form.responseLength.length > 0;
    if (step === 4) return true;
    return false;
  };

  const complete = async () => {
    setSaving(true);
    try {
      const attribution = getStoredAttribution(); // how they first found us, if known
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...attribution }),
      });
    } catch (_) {}
    router.push('/dashboard');
  };

  const inputClass = "w-full px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500 text-sm";

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center py-12 px-4">

      {/* Logo / title */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Bot className="w-6 h-6 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Let's build your AI</h1>
        <p className="text-sm text-gray-500 mt-1">4 steps. The more you share, the smarter it gets.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_META.map((s, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <div key={num} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                done   ? 'bg-violet-600 text-white' :
                active ? 'bg-violet-500/20 border border-violet-500 text-violet-400' :
                         'bg-gray-800 text-gray-600'
              }`}>
                {done ? <Check className="w-4 h-4" /> : num}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-white' : 'text-gray-600'}`}>{s.label}</span>
              {i < STEP_META.length - 1 && <div className="w-6 h-px bg-gray-800" />}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="w-full max-w-xl bg-[#161B22] border border-gray-800 rounded-2xl p-8">

        {/* ── STEP 1: Business name + industry ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">What's your business called?</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Your AI will introduce itself using this name on every channel — email, SMS, chat, and social. To your customers, it will feel like a real member of your team.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <ImpactBadge icon={Zap} text="Used in every AI reply" />
                <ImpactBadge icon={Shield} text="Your brand, not ours" />
              </div>
            </div>

            <input
              autoFocus
              placeholder="e.g. Sunrise Plumbing, Dr. Kim Dental, Atlas Marketing"
              value={form.businessName}
              onChange={e => set('businessName', e.target.value)}
              className={inputClass}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> Business phone <span className="text-gray-700">(optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. (555) 123-4567"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Website <span className="text-gray-700">(optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://yoursite.com"
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-xs text-gray-600 -mt-2">Your AI will share these when leads ask — and they'll be saved to your account profile.</p>

            <div>
              <label className="text-sm text-gray-400 block mb-1">What industry are you in?</label>
              <p className="text-xs text-gray-600 mb-3">This helps your AI understand the context of every conversation — so it never gives a response that sounds out of place for your type of business.</p>
              <div className="grid grid-cols-2 gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind}
                    onClick={() => set('industry', ind)}
                    className={`px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                      form.industry === ind
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >{ind}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Business description ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Describe your business</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                This is the single most impactful thing you'll do in this setup. Your AI reads this before every response — it's how it knows what you offer, what makes you different, and how to talk about your business confidently.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <ImpactBadge icon={Star} text="Most impactful step" />
                <ImpactBadge icon={Zap} text="Read before every reply" />
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400 font-medium mb-1">Don't just write "plumbing company."</p>
              <p className="text-xs text-gray-500 leading-relaxed">Include your services, location, what makes you different, how long you've been in business, and anything customers commonly ask. The more specific you are, the more your AI sounds like <em>you</em> — not a generic bot.</p>
            </div>

            <textarea
              autoFocus
              rows={6}
              placeholder={`Example: "We're a family-run plumbing company serving the Denver metro area. We specialise in emergency repairs, water heater installation, and drain cleaning. Same-day service is available 7 days a week. Licensed, bonded, and insured. We've been in business for 12 years and have over 400 five-star reviews."`}
              value={form.businessDescription}
              onChange={e => set('businessDescription', e.target.value)}
              className={`${inputClass} resize-none`}
            />

            <BeforeAfter
              bad="Thanks for reaching out! We'd love to help with your plumbing needs."
              good={`Thanks for reaching out! We serve the Denver metro area and offer same-day emergency repairs. We've been family-run for 12 years with 400+ five-star reviews. What issue are you dealing with?`}
            />
          </div>
        )}

        {/* ── STEP 3: Tone + response length ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">How should your AI sound?</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                A plumber and a law firm should sound completely different. These settings make your AI match your brand voice — so every response feels like it came from your business, not off a template.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <ImpactBadge icon={Shield} text="Applied to every channel" />
                <ImpactBadge icon={Zap} text="Change any time in settings" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-2 uppercase tracking-wide">Tone of voice</label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => set('tone', t.value)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      form.tone === t.value
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1 uppercase tracking-wide">Response length</label>
              <p className="text-xs text-gray-600 mb-2">SMS conversations work better short. Email and chat can go longer. You can set this per-channel later — this is your default.</p>
              <div className="grid grid-cols-3 gap-2">
                {LENGTHS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => set('responseLength', l.value)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      form.responseLength === l.value
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-sm">{l.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Knowledge base ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Give your AI its knowledge</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                This is your AI's brain. Without this, it will give vague, generic answers. With this, it can quote your actual pricing, explain your process, handle common objections, and answer the questions your leads ask every single day — correctly, every time.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <ImpactBadge icon={Star} text="Highest quality answers" />
                <ImpactBadge icon={Clock} text="Saves hours of back-and-forth" />
                <ImpactBadge icon={Shield} text="Never guesses at your pricing" />
              </div>
            </div>

            <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 space-y-1">
              <p className="text-xs text-violet-300 font-medium">What to include:</p>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>Your pricing or starting rates</li>
                <li>Services you offer (and don't offer)</li>
                <li>Your service area or location</li>
                <li>Hours, turnaround times, response time</li>
                <li>Your most common FAQs</li>
                <li>What happens after someone contacts you</li>
              </ul>
            </div>

            <textarea
              rows={8}
              placeholder={`Example:\n\nPricing: Drain cleaning from $149. Water heater install from $850. Emergency call-out: $75 fee.\nService area: Denver, Aurora, Lakewood, Englewood, Littleton.\nHours: Mon–Sat 7am–8pm. 24/7 emergency line.\nResponse time: 2-hour arrival for emergencies, next-day for standard jobs.\nPayment: Cash, all major cards, and financing available.\n\nFAQ: Do you offer free estimates? Yes, for non-emergency work.\nFAQ: Are you licensed? Yes — licensed, bonded, and insured in Colorado.`}
              value={form.knowledgeBase}
              onChange={e => set('knowledgeBase', e.target.value)}
              className={`${inputClass} resize-none`}
            />

            <BeforeAfter
              bad="Our pricing varies depending on the job. Please contact us for a quote."
              good="Drain cleaning starts at $149. Emergency call-out is $75. We can usually give you an exact quote over the phone — want me to help with that?"
            />

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                How did you hear about us? <span className="text-gray-700">(optional)</span>
              </label>
              <select
                value={form.heardAboutUs}
                onChange={e => set('heardAboutUs', e.target.value)}
                className={inputClass}
              >
                <option value="">Select one...</option>
                <option value="google_search">Google search</option>
                <option value="referral">A friend or colleague told me</option>
                <option value="social_media">Social media (X, LinkedIn, Facebook, Instagram)</option>
                <option value="ai_assistant">ChatGPT / AI assistant recommended it</option>
                <option value="direct_contact">The founder reached out to me directly</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              step === 1 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!isValid()}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isValid()
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={complete}
              disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60"
            >
              {saving ? 'Setting up your AI…' : 'Launch my AI'} <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Skip on step 4 */}
        {step === 4 && (
          <p className="text-center mt-4">
            <button
              onClick={complete}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Skip for now — I'll add this in AI Settings later
            </button>
          </p>
        )}
      </div>

      <p className="text-xs text-gray-700 mt-6">Step {step} of {TOTAL_STEPS}</p>
    </div>
  );
}
