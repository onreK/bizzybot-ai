'use client';

import { useState, useEffect } from 'react';

export default function AIConfigPage() {
  const [config, setConfig] = useState({
    personality: 'professional',
    knowledgeBase: '',
    model: 'gpt-4o-mini',
    creativity: 0.7,
    maxTokens: 500,
    systemPrompt: '',
    intakeFormUrl: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/ai-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        console.log('✅ Config loaded:', data);
      } else {
        console.log('⚠️ Using default config');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage('⚠️ Using default configuration');
    } finally {
      setInitialLoading(false);
    }
  };

  const saveConfig = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      console.log('💾 Saving config:', config);
      
      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage('✅ Configuration saved successfully!');
        console.log('✅ Config saved successfully');
      } else {
        setMessage('❌ Error saving configuration: ' + (data.error || 'Unknown error'));
        console.error('❌ Save failed:', data.error);
      }
    } catch (error) {
      setMessage('❌ Network error saving configuration');
      console.error('❌ Network error:', error);
    }
    
    setIsLoading(false);
    
    // Clear message after 5 seconds
    setTimeout(() => setMessage(''), 5000);
  };

  const testAIConnection = async () => {
    try {
      setMessage('🧪 Testing AI connection...');
      const response = await fetch('/api/chat?action=test-connection');
      const data = await response.json();
      
      if (data.connected) {
        setMessage('✅ AI connection successful!');
      } else {
        setMessage('❌ AI connection failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      setMessage('❌ AI connection test failed');
      console.error('AI test error:', error);
    }
    
    setTimeout(() => setMessage(''), 3000);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AI Configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🤖 AI Configuration</h1>
            <div className="flex gap-4">
              <a 
                href="/dashboard" 
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back to Dashboard
              </a>
              <button
                onClick={testAIConnection}
                className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
              >
                🧪 Test AI
              </button>
            </div>
          </div>
          
          {/* Status Message */}
          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-200' :
              message.includes('⚠️') ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
              message.includes('🧪') ? 'bg-blue-100 text-blue-800 border border-blue-200' :
              'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-8">
            {/* Personality Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                🎭 AI Personality
              </h2>
              <p className="text-gray-600 mb-4">Choose how your AI should interact with customers</p>
              <select
                value={config.personality}
                onChange={(e) => setConfig({...config, personality: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="professional">Professional & Direct</option>
                <option value="friendly">Friendly & Conversational</option>
                <option value="enthusiastic">Enthusiastic & Energetic</option>
                <option value="empathetic">Empathetic & Understanding</option>
                <option value="expert">Expert & Technical</option>
              </select>
            </div>

            {/* Knowledge Base Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                🧠 Knowledge Base
              </h2>
              <p className="text-gray-600 mb-4">
                Add specific information about your business, products, services, and FAQs. 
                This helps the AI provide more accurate and relevant responses.
              </p>
              <textarea
                value={config.knowledgeBase}
                onChange={(e) => setConfig({...config, knowledgeBase: e.target.value})}
                placeholder="Example: We are a family-run HVAC company serving Martinsville and the surrounding counties. We install and repair heating and cooling systems, offer 24-hour emergency callouts, and have been in business for 15 years. Free estimates on new installs..."
                className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                rows={6}
              />
              <p className="text-sm text-gray-500 mt-2">
                Characters: {config.knowledgeBase.length} • Recommended: 200-1000 characters
              </p>
            </div>

            {/* Intake Form / Documents */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                📋 Intake Form Link
              </h2>
              <p className="text-gray-600 mb-4">
                Paste the URL to your intake form or onboarding document (e.g. a Google Form, Typeform, or Calendly link).
                Your AI will share this link with hot leads when they show strong interest.
              </p>
              <input
                type="url"
                value={config.intakeFormUrl}
                onChange={(e) => setConfig({ ...config, intakeFormUrl: e.target.value })}
                placeholder="https://forms.google.com/... or https://calendly.com/..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {config.intakeFormUrl && (
                <p className="text-xs text-green-600 mt-2">
                  ✅ Form link saved — AI will share this with qualified leads.
                </p>
              )}
            </div>

            {/* Technical Settings */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                ⚙️ Technical Settings
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* AI Model */}
                <div>
                  <label className="block text-sm font-medium mb-2">AI Model</label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({...config, model: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-effective)</option>
                    <option value="gpt-4o">GPT-4o (Most Capable)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget-friendly)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {config.model === 'gpt-4o-mini' && 'Recommended for most use cases'}
                    {config.model === 'gpt-4o' && 'Best performance, higher cost'}
                    {config.model === 'gpt-3.5-turbo' && 'Lower cost, good performance'}
                  </p>
                </div>

                {/* Max Response Length */}
                <div>
                  <label className="block text-sm font-medium mb-2">Max Response Length</label>
                  <select
                    value={config.maxTokens}
                    onChange={(e) => setConfig({...config, maxTokens: parseInt(e.target.value)})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="150">Short (150 tokens)</option>
                    <option value="300">Medium (300 tokens)</option>
                    <option value="500">Long (500 tokens)</option>
                    <option value="1000">Extended (1000 tokens)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Shorter responses are faster and more cost-effective
                  </p>
                </div>
              </div>

              {/* Creativity Level */}
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">
                  Creativity Level: {config.creativity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.creativity}
                  onChange={(e) => setConfig({...config, creativity: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Conservative (0.0)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1.0)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Lower values = more consistent, predictable responses. Higher values = more creative, varied responses.
                </p>
              </div>
            </div>

            {/* Custom System Prompt */}
            <div className="pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                📝 Custom System Prompt <span className="text-sm text-gray-500 ml-2">(Advanced)</span>
              </h2>
              <p className="text-gray-600 mb-4">
                Advanced users can add custom instructions for how the AI should behave. 
                Leave blank to use default personality-based prompts.
              </p>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
                placeholder="Example: You are a helpful assistant for [Business Name]. Always be polite and professional. When customers ask about pricing, direct them to contact us for a custom quote..."
                className="w-full p-3 border border-gray-300 rounded-lg h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                rows={4}
              />
              <p className="text-sm text-gray-500 mt-2">
                Leave empty to use automatic prompts based on your personality selection above.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Changes will apply to all new conversations immediately after saving.
                </div>
                <button
                  onClick={saveConfig}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Configuration Tips</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• <strong>Professional & Direct:</strong> Best for business, legal, or medical services</li>
              <li>• <strong>Friendly & Conversational:</strong> Great for retail, hospitality, or customer service</li>
              <li>• <strong>Enthusiastic & Energetic:</strong> Perfect for fitness, events, or sales</li>
              <li>• <strong>Expert & Technical:</strong> Ideal for IT, consulting, or specialized services</li>
              <li>• <strong>Knowledge Base:</strong> Include hours, location, pricing info, and common FAQs</li>
              <li>• <strong>Test regularly:</strong> Use the "Test AI" button to verify your settings work correctly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
