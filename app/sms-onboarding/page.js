'use client';

import { useState, useEffect } from 'react';
import { Check, Phone, Building2, Clock, AlertCircle, Loader2, PartyPopper } from 'lucide-react';

// US states for the dropdown
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

export default function SMSOnboarding() {
  const [pageState, setPageState] = useState('loading'); // loading | form | provisioning | assigned
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Assigned number info (when customer already has one, or after provisioning)
  const [assigned, setAssigned] = useState(null);

  // Business profile form — required for toll-free verification
  const [profile, setProfile] = useState({
    businessName: '',
    website: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  useEffect(() => {
    loadInitialState();
  }, []);

  const loadInitialState = async () => {
    try {
      // Already has a number? Show status instead of the form.
      const numberRes = await fetch('/api/sms/provision');
      const numberData = await numberRes.json();
      if (numberData.assigned) {
        // If the number is still waiting on business info, try submitting
        // verification now (the profile may have been completed since).
        if (numberData.verificationStatus === 'needs_info' || !numberData.verificationStatus) {
          try {
            const retryRes = await fetch('/api/sms/retry-verification', { method: 'POST' });
            const retryData = await retryRes.json();
            if (retryData.success) {
              numberData.verificationStatus = retryData.verificationStatus;
              numberData.verified = retryData.verificationStatus === 'TWILIO_APPROVED';
              numberData.needsInfoFields = retryData.verificationNeedsInfo || [];
            } else if (retryData.error) {
              numberData.retryError = retryData.error;
            }
          } catch { /* fall through to showing current status */ }
        }
        setAssigned(numberData);
        setPageState('assigned');
        return;
      }

      // Prefill business info from their profile
      const profileRes = await fetch('/api/customer/update-profile');
      const profileData = await profileRes.json();
      if (profileData.success && profileData.profile) {
        const p = profileData.profile;
        setProfile({
          businessName: p.businessName || '',
          website: p.website || '',
          phone: p.phone || '',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          zipCode: p.zipCode || '',
        });
      }
      setPageState('form');
    } catch (err) {
      console.error('Failed to load SMS onboarding state:', err);
      setPageState('form');
    }
  };

  const validateForm = () => {
    if (!profile.businessName.trim()) return 'Business name is required';
    if (!profile.website.trim()) return 'Website (or public Facebook page URL) is required — carriers use it to verify your business';
    if (!profile.address.trim()) return 'Street address is required';
    if (!profile.city.trim()) return 'City is required';
    if (!profile.state.trim()) return 'State is required';
    if (!profile.zipCode.trim()) return 'ZIP code is required';
    return '';
  };

  const handleGetNumber = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSaving(true);
    setPageState('provisioning');

    try {
      // 1. Save the business profile (verification pulls from it)
      const saveRes = await fetch('/api/customer/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: profile.businessName.trim(),
          website: profile.website.trim(),
          phone: profile.phone.trim(),
          address: profile.address.trim(),
          city: profile.city.trim(),
          state: profile.state.trim(),
          zipCode: profile.zipCode.trim(),
          country: 'United States',
        }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error || 'Failed to save business info');

      // 2. Buy the number + auto-submit verification
      const provisionRes = await fetch('/api/sms/provision', { method: 'POST' });
      const provisionData = await provisionRes.json();
      if (!provisionData.success) throw new Error(provisionData.error || 'Failed to get your number');

      setAssigned({
        assigned: true,
        phoneNumber: provisionData.phoneNumber,
        verificationStatus: provisionData.verificationSubmitted ? 'PENDING_REVIEW' : 'needs_info',
        verified: false,
        justProvisioned: true,
      });
      setPageState('assigned');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setPageState('form');
    } finally {
      setSaving(false);
    }
  };

  const formatPhoneNumber = (number) => {
    const cleaned = String(number || '').replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  const setField = (field) => (e) => setProfile({ ...profile, [field]: e.target.value });

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  // ── Provisioning (buying the number) ──────────────────────────────────────
  if (pageState === 'provisioning') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md mx-4">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Setting up your AI number…</h2>
          <p className="text-gray-600">Reserving your number and starting carrier verification. This takes a few seconds.</p>
        </div>
      </div>
    );
  }

  // ── Assigned: show number + verification status ───────────────────────────
  if (pageState === 'assigned' && assigned) {
    const isVerified = assigned.verified || assigned.verificationStatus === 'TWILIO_APPROVED';
    const needsInfo = assigned.verificationStatus === 'needs_info';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-purple-100">
            {isVerified ? (
              <>
                <PartyPopper className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-green-600 mb-2">Your AI number is live!</h1>
              </>
            ) : (
              <>
                <Clock className="w-14 h-14 text-purple-500 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {assigned.justProvisioned ? 'Your number is reserved!' : 'Your number is being activated'}
                </h1>
              </>
            )}

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl py-6 px-4 my-6">
              <p className="text-sm text-gray-500 mb-1">Your BizzyBot business number</p>
              <p className="text-4xl font-bold text-purple-700 tracking-wide">
                {formatPhoneNumber(assigned.phoneNumber)}
              </p>
            </div>

            {isVerified ? (
              <div className="text-left space-y-4">
                <p className="text-gray-700">
                  Your AI assistant is answering texts and calls on this number 24/7. Put it everywhere customers find you:
                </p>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" /> Google Business listing</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" /> Your website and social pages</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" /> Trucks, signs, ads, and invoices</li>
                </ul>
              </div>
            ) : needsInfo ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800 mb-1">One more step needed</p>
                    <p className="text-sm text-amber-700">
                      We need your complete business info (website and address) to activate texting.
                      Please update your <a href="/settings" className="underline font-medium">Business Profile</a> — activation starts automatically once it&apos;s complete.
                    </p>
                    {assigned.needsInfoFields && assigned.needsInfoFields.length > 0 && (
                      <p className="text-xs text-amber-600 mt-2">Missing: {assigned.needsInfoFields.join(', ')}</p>
                    )}
                    {assigned.retryError && (
                      <p className="text-xs text-red-600 mt-2">Error: {assigned.retryError}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-left space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <p className="font-semibold text-blue-800 mb-2">📋 What happens next</p>
                  <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                    <li>Phone carriers verify your business for texting (required for every US business — usually <strong>1-5 business days</strong>)</li>
                    <li>We email you the moment you&apos;re approved</li>
                    <li>Your AI starts answering texts and calls 24/7</li>
                  </ol>
                </div>
                <p className="text-sm text-gray-500 text-center">
                  No action needed from you — we handle the whole verification process.
                </p>
              </div>
            )}

            <a
              href="/dashboard"
              className="inline-block mt-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
            >
              Go to Dashboard →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Form: business info → get number ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Get your AI business number</h1>
          <p className="text-gray-600">
            One number for AI texting and voice — set up in under a minute.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Your business info</h2>
          </div>

          <p className="text-sm text-gray-500 mb-6 bg-gray-50 rounded-lg p-3">
            Phone carriers require this to verify your business for texting — it&apos;s a one-time step
            that keeps your messages from being blocked as spam. We submit it for you automatically.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business name *</label>
              <input
                type="text"
                value={profile.businessName}
                onChange={setField('businessName')}
                placeholder="Mike's Plumbing LLC"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website or public Facebook page *
              </label>
              <input
                type="text"
                value={profile.website}
                onChange={setField('website')}
                placeholder="https://mikesplumbing.com or facebook.com/mikesplumbing"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">No website? A public Facebook business page works.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business phone (optional)</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={setField('phone')}
                placeholder="(804) 555-0123"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street address *</label>
              <input
                type="text"
                value={profile.address}
                onChange={setField('address')}
                placeholder="123 Main St"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={setField('city')}
                  placeholder="Richmond"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <select
                  value={profile.state}
                  onChange={setField('state')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                >
                  <option value="">Select…</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                <input
                  type="text"
                  value={profile.zipCode}
                  onChange={setField('zipCode')}
                  placeholder="23220"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleGetNumber}
            disabled={saving}
            className="w-full mt-6 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
            {saving ? 'Setting up…' : 'Get My AI Number'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            You&apos;ll get a toll-free business number (833/844/855…). Texting activates after a one-time
            carrier verification, usually 1-5 business days — we&apos;ll email you when it&apos;s live.
          </p>
        </div>
      </div>
    </div>
  );
}
