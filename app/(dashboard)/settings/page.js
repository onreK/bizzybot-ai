'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  User,
  CreditCard,
  Shield,
  Bell,
  Building,
  Globe,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Camera,
  Crown,
  Sparkles,
  ChevronRight,
  Settings,
  LogOut,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Zap,
  Star,
  Lock,
  Unlock,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle,
  XCircle,
  Info,
  Edit3,
  X,
  Mail,
  Key,
  Tag,
  Gift
} from 'lucide-react';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Discount Code State
  const [discountCode, setDiscountCode] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [activeDiscount, setActiveDiscount] = useState(null);
  
  // Password Change Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  
  // Account Information State
  const [accountInfo, setAccountInfo] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    avatarUrl: '',
    emailVerified: false,
    twoFactorEnabled: false,
    createdAt: '',
    lastSignIn: '',
    phone: ''
  });
  
  // Business Profile State
  const [businessProfile, setBusinessProfile] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    businessPhone: '',
    businessEmail: '',
    description: ''
  });
  
  // Subscription State
  const [subscription, setSubscription] = useState({
    plan: 'starter',
    status: 'active',
    billing: {
      amount: 29,
      interval: 'month',
      nextBilling: ''
    },
    discount: null
  });

  // Live usage from customer_usage table
  const [usageData, setUsageData] = useState({
    count: 0,
    limit: 300,
    plan: 'starter',
    remaining: 300,
    overLimit: false
  });
  
  // Notification Preferences
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsAlerts: false,
    pushNotifications: true,
    weeklyReports: true,
    hotLeadAlerts: false,
    marketingEmails: false
  });
  const [alertEmail, setAlertEmail] = useState('');
  
  // Integrations State
  const [integrations, setIntegrations] = useState([
    { id: 'gmail', name: 'Gmail', connected: true, icon: Mail, lastSync: '2 hours ago' },
    { id: 'facebook', name: 'Facebook', connected: false, icon: Globe, lastSync: null },
    { id: 'instagram', name: 'Instagram', connected: false, icon: Camera, lastSync: null },
    { id: 'twilio', name: 'Twilio SMS', connected: true, icon: Phone, lastSync: '1 hour ago' }
  ]);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadBusinessProfile();
      loadSubscription();
      loadNotifications();
      loadScheduling();
      loadUsage();
    }
  }, [user]);

  const loadUserData = () => {
    if (!user) return;
    
    setAccountInfo({
      email: user.emailAddresses[0]?.emailAddress || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || '',
      avatarUrl: user.imageUrl || '',
      emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
      twoFactorEnabled: user.twoFactorEnabled || false,
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
      lastSignIn: user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : '',
      phone: user.phoneNumbers?.[0]?.phoneNumber || ''
    });
  };

  const loadBusinessProfile = async () => {
    try {
      const response = await fetch('/api/customer/update-profile');
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          setBusinessProfile({
            companyName: data.profile.businessName || '',
            industry: data.profile.industry || '',
            companySize: data.profile.employeeCount || '',
            website: data.profile.website || '',
            addressLine1: data.profile.address || '',
            addressLine2: '',
            city: data.profile.city || '',
            state: data.profile.state || '',
            postalCode: data.profile.zipCode || '',
            country: data.profile.country || 'United States',
            businessPhone: data.profile.phone || '',
            businessEmail: '',
            description: data.profile.description || ''
          });
        }
      }

      // Business email lives with the SMS verification info, not the profile
      const infoResponse = await fetch('/api/sms/verification-info');
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        if (info.businessEmail) {
          setBusinessProfile(prev => ({ ...prev, businessEmail: info.businessEmail }));
        }
      }
    } catch (error) {
      console.error('Error loading business profile:', error);
    }
  };

  const loadSubscription = async () => {
    try {
      const response = await fetch('/api/customer/subscription');
      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          const planPrices = { starter: 29, professional: 69, business: 199 };
          const planName = data.subscription.plan || 'starter';
          const planPrice = planPrices[planName] || 29;

          setSubscription(prev => ({
            ...prev,
            plan: planName,
            status: data.subscription.status || 'active',
            billing: {
              amount: planPrice,
              interval: 'month',
              nextBilling: data.subscription.current_period_end || prev.billing.nextBilling
            },
            discount: data.subscription.discount || null
          }));

          if (data.subscription.discount) {
            setActiveDiscount(data.subscription.discount);
          }
        }
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadUsage = async () => {
    try {
      const response = await fetch('/api/customer/usage');
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Error loading usage:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/customer/notifications');
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setNotifications(prev => ({ ...prev, hotLeadAlerts: data.preferences.hotLeadAlerts ?? false }));
          setAlertEmail(data.preferences.alertEmail || '');
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/customer/update-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accountInfo.email,
          firstName: accountInfo.firstName,
          lastName: accountInfo.lastName,
          phone: accountInfo.phone,
          businessName: businessProfile.companyName
        })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account information updated successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update account information' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusinessProfile = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/customer/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessProfile.companyName,
          industry: businessProfile.industry,
          employeeCount: businessProfile.companySize,
          website: businessProfile.website,
          address: [businessProfile.addressLine1, businessProfile.addressLine2].filter(Boolean).join(', '),
          city: businessProfile.city,
          state: businessProfile.state,
          zipCode: businessProfile.postalCode,
          country: businessProfile.country,
          phone: businessProfile.businessPhone,
          description: businessProfile.description,
        })
      });

      const data = await response.json().catch(() => ({}));

      // Business email is stored with the SMS verification info (Twilio's
      // toll-free verification reads it from there). Merge it into the
      // existing record — the POST requires the full set of fields.
      let emailError = null;
      const businessEmail = (businessProfile.businessEmail || '').trim();
      try {
        const infoResponse = await fetch('/api/sms/verification-info');
        const info = infoResponse.ok ? await infoResponse.json() : null;
        if (info?.businessType && businessEmail !== (info.businessEmail || '')) {
          const emailResponse = await fetch('/api/sms/verification-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessType: info.businessType,
              ein: info.ein,
              contactFirstName: info.contactFirstName,
              contactLastName: info.contactLastName,
              businessEmail,
            }),
          });
          const emailData = await emailResponse.json().catch(() => ({}));
          if (!emailResponse.ok || !emailData.success) {
            emailError = emailData.error || 'Business email failed to save';
          }
        }
      } catch (e) {
        emailError = 'Business email failed to save';
      }

      if (response.ok && data.success && !emailError) {
        setMessage({ type: 'success', text: 'Business profile updated successfully!' });
      } else if (response.ok && data.success && emailError) {
        setMessage({ type: 'error', text: `Profile saved, but: ${emailError}` });
      } else {
        setMessage({ type: 'error', text: data.details ? `Failed to update: ${data.details}` : 'Failed to update business profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/customer/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotLeadAlerts: notifications.hotLeadAlerts, alertEmail })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Notification preferences saved!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpgradePlan = async (plan) => {
    setLoading(true);
    try {
      const response = await fetch('/api/customer/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, action: 'upgrade' })
      });

      const data = await response.json();
      
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setMessage({ type: 'success', text: data.message });
        loadSubscription();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to process upgrade' });
    } finally {
      setLoading(false);
    }
  };

  // Apply Discount Code Function
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter a discount code' });
      return;
    }
    
    setApplyingDiscount(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/customer/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'apply_discount',
          discountCode: discountCode.trim()
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setActiveDiscount(data.discount);
        setDiscountCode('');
        // Reload subscription to get updated discount info
        loadSubscription();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to apply discount code' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to apply discount code' });
    } finally {
      setApplyingDiscount(false);
    }
  };

  // Password Change Function
  const handlePasswordChange = async () => {
    setPasswordError('');
    
    // Validate passwords
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    setSaving(true);
    
    try {
      // Note: Clerk handles password changes through their API
      // You would typically use clerk.user.updatePassword() here
      // For now, we'll show a message that this needs to be done through Clerk
      setMessage({ type: 'info', text: 'Please use the Clerk dashboard to change your password' });
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  // Scheduling State
  const [scheduling, setScheduling] = useState({
    booking_url: '',
    booking_auto_send: true,
  });
  const [schedulingLoaded, setSchedulingLoaded] = useState(false);

  const loadScheduling = async () => {
    try {
      const res = await fetch('/api/customer/scheduling');
      if (res.ok) {
        const data = await res.json();
        setScheduling({ booking_url: data.booking_url || '', booking_auto_send: data.booking_auto_send !== false });
      }
    } catch {}
    setSchedulingLoaded(true);
  };

  const handleSaveScheduling = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/customer/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduling),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Scheduling settings saved!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save scheduling settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'business', label: 'Business Profile', icon: Building },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  const availablePlans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 29,
      features: [
        '300 AI responses/month',
        'Email, SMS & Web Chat AI',
        'Scheduling integration',
        'Lead tracking & export',
        '1 user seat',
      ],
      current: subscription.plan === 'starter'
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 69,
      features: [
        '1,500 AI responses/month',
        'Everything in Starter',
        'Facebook Messenger AI',
        'Instagram DM AI',
        'Full analytics dashboard',
        '2 user seats',
      ],
      current: subscription.plan === 'professional'
    },
    {
      id: 'business',
      name: 'Business',
      price: 199,
      features: [
        '5,000 AI responses/month',
        'Everything in Professional',
        'AI Voice calls',
        '5 user seats',
        'Priority support',
      ],
      current: subscription.plan === 'business'
    }
  ];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account and preferences</p>
        </div>
        <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
          <Crown className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm font-medium capitalize">{subscription.plan} Plan</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2.5 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

        {/* Message Display */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
            message.type === 'success' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : message.type === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : message.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Account Tab - Unchanged */}
        {activeTab === 'account' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Account Information</h2>
              <p className="text-gray-400">Update your personal information</p>
            </div>

            <div className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-violet-600/20 p-1">
                    <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <button className="absolute bottom-0 right-0 p-2 bg-violet-600 rounded-full hover:bg-violet-700">
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {accountInfo.firstName} {accountInfo.lastName}
                  </h3>
                  <p className="text-gray-400">{accountInfo.email}</p>
                  <p className="text-sm text-gray-500">Member since {accountInfo.createdAt}</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={accountInfo.firstName}
                    onChange={(e) => setAccountInfo({...accountInfo, firstName: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={accountInfo.lastName}
                    onChange={(e) => setAccountInfo({...accountInfo, lastName: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={accountInfo.email}
                      onChange={(e) => setAccountInfo({...accountInfo, email: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600"
                    />
                    {accountInfo.emailVerified && (
                      <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={accountInfo.phone}
                    onChange={(e) => setAccountInfo({...accountInfo, phone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveAccount}
                disabled={saving}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Business Profile Tab - Unchanged */}
        {activeTab === 'business' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Business Profile</h2>
              <p className="text-gray-400">Manage your company information</p>
            </div>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={businessProfile.companyName}
                    onChange={(e) => setBusinessProfile({...businessProfile, companyName: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Industry
                  </label>
                  <select
                    value={businessProfile.industry}
                    onChange={(e) => setBusinessProfile({...businessProfile, industry: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                  >
                    <option value="">Select Industry</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="retail">Retail</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="services">Services</option>
                    <option value="education">Education</option>
                    <option value="realestate">Real Estate</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Size
                  </label>
                  <select
                    value={businessProfile.companySize}
                    onChange={(e) => setBusinessProfile({...businessProfile, companySize: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                  >
                    <option value="">Select Size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={businessProfile.website}
                    onChange={(e) => setBusinessProfile({...businessProfile, website: e.target.value})}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={businessProfile.businessEmail}
                    onChange={(e) => setBusinessProfile({...businessProfile, businessEmail: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={businessProfile.businessPhone}
                    onChange={(e) => setBusinessProfile({...businessProfile, businessPhone: e.target.value})}
                    className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Address Fields */}
              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Business Address</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={businessProfile.addressLine1}
                      onChange={(e) => setBusinessProfile({...businessProfile, addressLine1: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={businessProfile.addressLine2}
                      onChange={(e) => setBusinessProfile({...businessProfile, addressLine2: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={businessProfile.city}
                      onChange={(e) => setBusinessProfile({...businessProfile, city: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={businessProfile.state}
                      onChange={(e) => setBusinessProfile({...businessProfile, state: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      ZIP/Postal Code
                    </label>
                    <input
                      type="text"
                      value={businessProfile.postalCode}
                      onChange={(e) => setBusinessProfile({...businessProfile, postalCode: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={businessProfile.country}
                      onChange={(e) => setBusinessProfile({...businessProfile, country: e.target.value})}
                      className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Description
                </label>
                <textarea
                  value={businessProfile.description}
                  onChange={(e) => setBusinessProfile({...businessProfile, description: e.target.value})}
                  rows={4}
                  className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600"
                  placeholder="Tell us about your business..."
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveBusinessProfile}
                disabled={saving}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save Business Profile'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Subscription Tab - UPDATED with Discount Code */}
        {activeTab === 'subscription' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Billing & Subscription</h2>
              <p className="text-gray-400">Manage your plan and usage</p>
            </div>

            {/* Current Plan - FIXED to show correct plan */}
            <div className="p-6 rounded-xl bg-[#161B22] border border-violet-500/30 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Crown className="w-6 h-6 text-white" />
                    <h3 className="text-2xl font-bold text-white capitalize">{subscription.plan} Plan</h3>
                  </div>
                  <p className="text-gray-400 mb-4">Your plan renews {subscription.billing.interval}ly</p>
                  <div className="text-3xl font-bold text-white">
                    ${subscription.billing.amount}<span className="text-lg font-normal text-gray-400">/{subscription.billing.interval}</span>
                  </div>

                  {/* Display Active Discount */}
                  {activeDiscount && (
                    <div className="mt-4 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Tag className="w-4 h-4 text-violet-400" />
                        <span className="text-violet-400 font-medium">Active Discount</span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {activeDiscount.percentOff ? `${activeDiscount.percentOff}% off` : `$${activeDiscount.amountOff} off`}
                        {activeDiscount.coupon && ` - ${activeDiscount.coupon}`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-3 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full">
                  <span className="text-violet-400 font-medium capitalize">
                    {subscription.status === 'trialing' ? 'Trial' : subscription.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Discount Code Section - NEW */}
            <div className="p-6 bg-[#0D1117] rounded-xl border border-gray-800 mb-6">
              <div className="flex items-start space-x-3 mb-4">
                <Gift className="w-5 h-5 text-purple-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-white font-medium mb-1">Have a Discount Code?</h4>
                  <p className="text-gray-400 text-sm">Enter your promotional code to apply a discount to your subscription</p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  placeholder="Enter discount code"
                  className="flex-1 px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600 uppercase"
                />
                <button
                  onClick={handleApplyDiscount}
                  disabled={applyingDiscount || !discountCode.trim()}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {applyingDiscount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{applyingDiscount ? 'Applying...' : 'Apply'}</span>
                </button>
              </div>
            </div>

            {/* Usage Stats — live from customer_usage table */}
            <div className="p-5 bg-[#0D1117] rounded-xl border border-gray-800 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-white">AI Responses This Month</h4>
                <span className={`text-sm font-medium ${usageData.overLimit ? 'text-red-400' : 'text-gray-400'}`}>
                  {usageData.count.toLocaleString()} / {usageData.limit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2">
                <div
                  className={`h-2.5 rounded-full transition-all ${usageData.overLimit ? 'bg-red-500' : usageData.count / usageData.limit > 0.8 ? 'bg-amber-500' : 'bg-violet-500'}`}
                  style={{ width: `${Math.min((usageData.count / usageData.limit) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {usageData.overLimit
                  ? 'Limit reached — upgrade to keep responding automatically'
                  : `${usageData.remaining.toLocaleString()} responses remaining this month`}
              </p>
            </div>

            {/* Available Plans */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Available Plans</h4>
              <div className="grid md:grid-cols-3 gap-4">
                {availablePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-lg border ${
                      plan.current
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : 'bg-[#161B22] border-gray-800'
                    }`}
                  >
                    <h5 className="text-lg font-semibold text-white mb-2">{plan.name}</h5>
                    <div className="text-2xl font-bold text-white mb-3">
                      ${plan.price}<span className="text-sm font-normal text-gray-400">/month</span>
                    </div>
                    <ul className="space-y-1 mb-4">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-center">
                          <Check className="w-3 h-3 mr-2 text-green-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.current ? (
                      <div className="px-3 py-2 bg-gray-800 rounded text-center text-gray-400 text-sm">
                        Current Plan
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgradePlan(plan.id)}
                        disabled={loading}
                        className="w-full px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded text-sm font-medium"
                      >
                        {loading ? 'Processing...' : 'Upgrade'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab - Unchanged */}
        {activeTab === 'notifications' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Notification Preferences</h2>
              <p className="text-gray-400">Choose how you want to be notified</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Email Notifications</h4>
                    <p className="text-sm text-gray-400">Receive updates via email</p>
                  </div>
                  <button
                    onClick={() => setNotifications({...notifications, emailNotifications: !notifications.emailNotifications})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      notifications.emailNotifications ? 'bg-violet-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifications.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">SMS Alerts</h4>
                    <p className="text-sm text-gray-400">Get text messages for urgent updates</p>
                  </div>
                  <button
                    onClick={() => setNotifications({...notifications, smsAlerts: !notifications.smsAlerts})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      notifications.smsAlerts ? 'bg-violet-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifications.smsAlerts ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Push Notifications</h4>
                    <p className="text-sm text-gray-400">Browser and mobile app notifications</p>
                  </div>
                  <button
                    onClick={() => setNotifications({...notifications, pushNotifications: !notifications.pushNotifications})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      notifications.pushNotifications ? 'bg-violet-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifications.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Weekly Reports</h4>
                    <p className="text-sm text-gray-400">Receive weekly performance summaries</p>
                  </div>
                  <button
                    onClick={() => setNotifications({...notifications, weeklyReports: !notifications.weeklyReports})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      notifications.weeklyReports ? 'bg-violet-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifications.weeklyReports ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                {/* Hot Lead Alerts — real, DB-backed */}
                <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium flex items-center gap-2">
                        🔥 Hot Lead Alerts
                        <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded-full font-normal">Active</span>
                      </h4>
                      <p className="text-sm text-gray-400 mt-0.5">Get an email when the AI detects a hot lead on any channel</p>
                    </div>
                    <button
                      onClick={() => setNotifications({...notifications, hotLeadAlerts: !notifications.hotLeadAlerts})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0 ${
                        notifications.hotLeadAlerts ? 'bg-violet-600' : 'bg-gray-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        notifications.hotLeadAlerts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  {notifications.hotLeadAlerts && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">Send alerts to this email</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={alertEmail}
                        onChange={e => setAlertEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                      />
                      <p className="text-xs text-gray-600 mt-1">Max 1 alert per 30 minutes to avoid spam. Covers Gmail, Outlook, SMS, Voice, and all other channels.</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">Marketing Emails</h4>
                    <p className="text-sm text-gray-400">Product updates and special offers</p>
                  </div>
                  <button
                    onClick={() => setNotifications({...notifications, marketingEmails: !notifications.marketingEmails})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      notifications.marketingEmails ? 'bg-violet-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifications.marketingEmails ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveNotifications}
                disabled={saving}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Integrations Tab - Unchanged */}
        {activeTab === 'integrations' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Integrations</h2>
              <p className="text-gray-400">Connect your favorite tools and services</p>
            </div>

            <div className="space-y-4">
              {integrations.map((integration) => (
                <div key={integration.id} className="p-4 bg-[#0D1117] rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-[#0D1117] rounded-lg">
                        <integration.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{integration.name}</h4>
                        {integration.connected ? (
                          <p className="text-sm text-green-400">Connected • Last sync: {integration.lastSync}</p>
                        ) : (
                          <p className="text-sm text-gray-400">Not connected</p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      className={`px-4 py-2 rounded-lg font-medium ${
                        integration.connected
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {integration.connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-blue-400 font-medium mb-1">Need more integrations?</h4>
                  <p className="text-sm text-gray-300">
                    Contact support to request additional integration options for your business needs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab - UPDATED with Password Modal */}
        {activeTab === 'security' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Security Settings</h2>
              <p className="text-gray-400">Keep your account secure</p>
            </div>

            <div className="space-y-6">
              {/* Two-Factor Authentication */}
              <div className="p-4 bg-[#0D1117] rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-white font-medium flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-green-400" />
                      <span>Two-Factor Authentication</span>
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">Add an extra layer of security to your account</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    accountInfo.twoFactorEnabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {accountInfo.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium">
                  {accountInfo.twoFactorEnabled ? 'Manage 2FA' : 'Enable 2FA'}
                </button>
              </div>

              {/* Password - UPDATED */}
              <div className="p-4 bg-[#0D1117] rounded-lg border border-gray-800">
                <h4 className="text-white font-medium mb-2">Password</h4>
                <p className="text-sm text-gray-400 mb-4">Last changed 30 days ago</p>
                <button 
                  onClick={() => setShowPasswordModal(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium"
                >
                  Change Password
                </button>
              </div>

              {/* Active Sessions */}
              <div className="p-4 bg-[#0D1117] rounded-lg border border-gray-800">
                <h4 className="text-white font-medium mb-4">Active Sessions</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded">
                    <div>
                      <p className="text-white text-sm">Current Session</p>
                      <p className="text-xs text-gray-400">Chrome on Windows • New York, US</p>
                    </div>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
                  </div>
                </div>
                <button className="mt-3 text-sm text-violet-400 hover:text-violet-300">
                  View all sessions →
                </button>
              </div>

              {/* Account Management */}
              <div className="pt-6 border-t border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4">Account Management</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-red-400 font-semibold">Delete Account</h4>
                        <p className="text-sm text-gray-400">Permanently delete your account and all data</p>
                      </div>
                      <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/30">
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Footer */}
        <div className="mt-8 p-4 bg-[#0D1117] rounded-xl border border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Need help? Contact support at support@bizzybotai.com</p>
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

      {/* Password Change Modal - NEW */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#161B22] rounded-xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Change Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="p-1 hover:bg-[#0D1117] rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                />
                <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                  }}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Changing...' : 'Change Password'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              Note: Password changes are managed through Clerk authentication
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
