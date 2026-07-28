'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function EmailAISettings() {
  const { user } = useUser();
  const [settings, setSettings] = useState({
    ai_personality: '',
    tone: 'professional',
    expertise: '',
    specialties: '',
    response_style: '',
    hot_lead_keywords: ['urgent', 'asap', 'immediately', 'budget', 'ready', 'buying now'],
    auto_response_enabled: true,
    alert_hot_leads: true,
    include_availability: true,
    ask_qualifying_questions: true,
    require_approval: false,
    // 🎯 NEW: AI Behavior Settings
    ai_system_prompt: '',
    custom_instructions: '',
    always_ask_phone: false,
    schedule_within_24h: false,
    highlight_advantages: false,
    include_call_to_action: true,
    offer_callback_urgent: true,
    // ⚙️ NEW: AI Model Settings  
    ai_model: 'gpt-4o-mini',
    ai_temperature: 0.7,
    ai_max_tokens: 350,
    response_length: 'medium',
    enable_hot_lead_analysis: true,
    enable_ai_responses: true
  });
  const [customKeyword, setCustomKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    if (user) {
      loadCustomerData();
      loadAISettings();
    }
  }, [user]);

  const loadCustomerData = async () => {
    try {
      const response = await fetch('/api/customer/profile');
      const data = await response.json();
      if (data.success) {
        setCustomer(data.customer);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  };

  const loadAISettings = async () => {
    try {
      const response = await fetch('/api/customer/ai-settings');
      const data = await response.json();
      if (data.success && data.settings) {
        setSettings({
          ...settings,
          ...data.settings,
          hot_lead_keywords: data.settings.hot_lead_keywords || settings.hot_lead_keywords,
          // Map any existing database values
          ai_system_prompt: data.settings.ai_system_prompt || data.settings.custom_instructions || '',
          ai_model: data.settings.ai_model || 'gpt-4o-mini',
          ai_temperature: data.settings.ai_temperature || 0.7,
          ai_max_tokens: data.settings.ai_max_tokens || 350
        });
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    }
  };

  const saveAISettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/customer/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await response.json();
      if (data.success) {
        alert('AI settings saved successfully!');
      } else {
        alert('Error saving settings: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const addCustomKeyword = () => {
    if (customKeyword.trim() && !settings.hot_lead_keywords.includes(customKeyword.trim().toLowerCase())) {
      setSettings({
        ...settings,
        hot_lead_keywords: [...settings.hot_lead_keywords, customKeyword.trim().toLowerCase()]
      });
      setCustomKeyword('');
    }
  };

  const removeKeyword = (keyword) => {
    setSettings({
      ...settings,
      hot_lead_keywords: settings.hot_lead_keywords.filter(k => k !== keyword)
    });
  };

  const testAIResponse = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/customer/test-ai-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Hi, I'm urgently looking for a 3-bedroom house under $500K. Can you help me find something ASAP? I'm ready to buy immediately.",
          settings: settings
        })
      });

      const data = await response.json();
      if (data.success) {
        setTestResult(data);
      } else {
        alert('Error testing AI: ' + data.error);
      }
    } catch (error) {
      console.error('Error testing AI:', error);
      alert('Error testing AI response');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🤖 AI Settings</h1>
              <p className="text-sm text-gray-600">Configure your Email AI personality and behavior</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={testAIResponse}
                disabled={testing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {testing ? '🧪 Testing...' : '🧪 Test AI Response'}
              </button>
              <Link 
                href="/email"
                className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-gray-700 transition-colors"
              >
                ← Back to Email
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* AI Personality Settings */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Basic Personality */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">👤 AI Personality</h2>
              
              {/* Business Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={customer?.business_name || ''}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-500"
                  disabled
                  placeholder="Set in profile settings"
                />
                <p className="text-xs text-gray-500 mt-1">Update in your profile settings</p>
              </div>

              {/* Tone */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Communication Tone
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {['formal', 'professional', 'casual'].map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setSettings({...settings, tone})}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        settings.tone === tone
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="capitalize font-medium">{tone}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Expertise */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Expertise
                </label>
                <input
                  type="text"
                  value={settings.expertise}
                  onChange={(e) => setSettings({...settings, expertise: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., HVAC, Salon, Plumbing, Real Estate"
                />
              </div>

              {/* Specialties */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialties
                </label>
                <textarea
                  value={settings.specialties}
                  onChange={(e) => setSettings({...settings, specialties: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Luxury homes, First-time buyers, Investment properties"
                />
              </div>

              {/* Response Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Style
                </label>
                <textarea
                  value={settings.response_style}
                  onChange={(e) => setSettings({...settings, response_style: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Helpful and detailed responses, Brief and to-the-point, Enthusiastic and encouraging"
                />
              </div>

              {/* Custom AI Personality */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Instructions
                </label>
                <textarea
                  value={settings.ai_personality}
                  onChange={(e) => setSettings({...settings, ai_personality: e.target.value})}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional personality traits or instructions for the AI..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide specific instructions about how the AI should behave, what to emphasize, etc.
                </p>
              </div>
            </div>

            {/* 🎯 NEW: AI Behavior Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">🎯 AI Behavior Settings</h2>
              
              {/* Custom AI Instructions */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom AI Instructions
                </label>
                <textarea
                  value={settings.ai_system_prompt}
                  onChange={(e) => setSettings({...settings, ai_system_prompt: e.target.value})}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Example instructions:
- Always ask for phone numbers when customers show interest
- Be enthusiastic about our services and pricing  
- Try to schedule appointments within 24 hours
- If someone mentions competitors, highlight our unique advantages
- Always end responses with a call-to-action
- For urgent inquiries, offer immediate callback options"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Specific instructions for how the AI should behave and respond to customers
                </p>
              </div>

              {/* Response Goals */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Response Goals
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.always_ask_phone}
                      onChange={(e) => setSettings({...settings, always_ask_phone: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Always ask for phone numbers</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.schedule_within_24h}
                      onChange={(e) => setSettings({...settings, schedule_within_24h: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Try to schedule appointments within 24 hours</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.highlight_advantages}
                      onChange={(e) => setSettings({...settings, highlight_advantages: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Highlight advantages over competitors</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.include_call_to_action}
                      onChange={(e) => setSettings({...settings, include_call_to_action: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Always end with call-to-action</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.offer_callback_urgent}
                      onChange={(e) => setSettings({...settings, offer_callback_urgent: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Offer callback for urgent inquiries</label>
                  </div>
                </div>
              </div>
            </div>

            {/* ⚙️ NEW: AI Model Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">⚙️ AI Model Settings</h2>
              
              {/* AI Model Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Model
                </label>
                <select
                  value={settings.ai_model}
                  onChange={(e) => setSettings({...settings, ai_model: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-effective)</option>
                  <option value="gpt-4o">GPT-4o (Most Advanced)</option>
                  <option value="gpt-4">GPT-4 (Balanced)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Higher models cost more but provide better responses
                </p>
              </div>

              {/* Creativity Level */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Creativity Level: {settings.ai_temperature}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.ai_temperature}
                  onChange={(e) => setSettings({...settings, ai_temperature: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Consistent (0.1)</span>
                  <span>Balanced (0.7)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>

              {/* Response Length */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Length
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'short', label: 'Short', tokens: '150' },
                    { value: 'medium', label: 'Medium', tokens: '350' },
                    { value: 'long', label: 'Long', tokens: '500' }
                  ].map((length) => (
                    <button
                      key={length.value}
                      onClick={() => {
                        setSettings({
                          ...settings, 
                          response_length: length.value,
                          ai_max_tokens: parseInt(length.tokens)
                        });
                      }}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        settings.response_length === length.value
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="font-medium">{length.label}</div>
                      <div className="text-xs text-gray-500">{length.tokens} tokens</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Features */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  AI Features
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enable_hot_lead_analysis}
                      onChange={(e) => setSettings({...settings, enable_hot_lead_analysis: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Enable Hot Lead Analysis</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enable_ai_responses}
                      onChange={(e) => setSettings({...settings, enable_ai_responses: e.target.checked})}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm text-gray-700">Enable AI Responses</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Hot Lead Detection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">🔥 Hot Lead Detection</h2>
              
              {/* Keywords */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hot Lead Keywords
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {settings.hot_lead_keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomKeyword()}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add new keyword..."
                  />
                  <button
                    onClick={addCustomKeyword}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Keywords that indicate high buying intent and urgency
                </p>
              </div>
            </div>

            {/* Behavior Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">⚙️ AI Behavior</h2>
              
              <div className="space-y-4">
                {/* Auto Response */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Auto-Response</div>
                    <div className="text-sm text-gray-500">Automatically respond to emails</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_response_enabled}
                      onChange={(e) => setSettings({...settings, auto_response_enabled: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Hot Lead Alerts */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Hot Lead Alerts</div>
                    <div className="text-sm text-gray-500">Send notifications for high-intent emails</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alert_hot_leads}
                      onChange={(e) => setSettings({...settings, alert_hot_leads: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Include Availability */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Include Availability</div>
                    <div className="text-sm text-gray-500">Mention availability for meetings/viewings</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.include_availability}
                      onChange={(e) => setSettings({...settings, include_availability: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Ask Qualifying Questions */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Ask Qualifying Questions</div>
                    <div className="text-sm text-gray-500">Ask follow-up questions to qualify leads</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.ask_qualifying_questions}
                      onChange={(e) => setSettings({...settings, ask_qualifying_questions: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Require Approval */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Require Approval</div>
                    <div className="text-sm text-gray-500">Hold responses for manual approval</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.require_approval}
                      onChange={(e) => setSettings({...settings, require_approval: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Save Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <button
                onClick={saveAISettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save AI Settings'}
              </button>
            </div>

            {/* 🧪 NEW: AI Testing Panel */}
            {testResult && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🧪 Test Results</h3>
                
                {/* Hot Lead Analysis */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Hot Lead Score</span>
                    <span className={`text-sm font-bold ${testResult.hotLead?.score > 60 ? 'text-red-600' : 'text-gray-600'}`}>
                      {testResult.hotLead?.score || 0}/100
                    </span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${testResult.hotLead?.isHotLead ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {testResult.hotLead?.isHotLead ? '🔥 HOT LEAD' : '❄️ Regular Lead'}
                  </div>
                </div>

                {/* AI Response */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI Response</label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                    {testResult.response}
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="font-medium text-gray-700">Model</div>
                    <div className="text-gray-600">{testResult.metadata?.model || settings.ai_model}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="font-medium text-gray-700">Tokens</div>
                    <div className="text-gray-600">{testResult.metadata?.tokensUsed || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="font-medium text-gray-700">Knowledge Base</div>
                    <div className="text-gray-600">{testResult.metadata?.knowledgeBaseUsed ? '✅ Used' : '❌ Not Used'}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="font-medium text-gray-700">Channel</div>
                    <div className="text-gray-600">Email Test</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={testAIResponse}
                  disabled={testing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {testing ? '🧪 Testing...' : '🧪 Test AI Response'}
                </button>
                <Link
                  href="/email/manage-templates"
                  className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium text-center transition-colors"
                >
                  📝 Manage Templates
                </Link>
                <Link
                  href="/email"
                  className="block w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium text-center transition-colors"
                >
                  📧 Email Manager
                </Link>
              </div>
            </div>

            {/* Current Settings Summary */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">⚙️ Current Settings</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>AI Model:</span>
                  <span className="font-medium">{settings.ai_model}</span>
                </div>
                <div className="flex justify-between">
                  <span>Creativity:</span>
                  <span className="font-medium">{settings.ai_temperature}</span>
                </div>
                <div className="flex justify-between">
                  <span>Response Length:</span>
                  <span className="font-medium capitalize">{settings.response_length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Response:</span>
                  <span className={`font-medium ${settings.auto_response_enabled ? 'text-green-600' : 'text-red-600'}`}>
                    {settings.auto_response_enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hot Lead Analysis:</span>
                  <span className={`font-medium ${settings.enable_hot_lead_analysis ? 'text-green-600' : 'text-red-600'}`}>
                    {settings.enable_hot_lead_analysis ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Tips</h3>
              <div className="space-y-3 text-sm text-blue-800">
                <p>• Higher creativity = more personality, lower = more consistent</p>
                <p>• GPT-4o models provide better responses but cost more</p>
                <p>• Test your AI regularly to ensure quality responses</p>
                <p>• Custom instructions help the AI follow your business style</p>
                <p>• Hot lead keywords help identify urgent customers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
