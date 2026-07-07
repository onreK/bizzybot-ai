'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, Code, Copy, Check,
  Globe, Zap, Send,
} from 'lucide-react';

const PLATFORMS = [
  { name: 'WordPress',   how: 'Appearance → Theme Editor → footer.php, paste before </body>' },
  { name: 'Wix',         how: 'Settings → Custom Code → Add Code → Body (end of tag)' },
  { name: 'Squarespace', how: 'Settings → Advanced → Code Injection → Footer' },
  { name: 'Webflow',     how: 'Project Settings → Custom Code → Footer Code' },
  { name: 'Shopify',     how: 'Online Store → Themes → Edit Code → theme.liquid before </body>' },
  { name: 'Plain HTML',  how: 'Paste just before </body> in your index.html file' },
];

const STEPS = [
  { title: 'Copy the embed code above',    desc: 'Click the "Copy" button to copy your unique widget snippet.' },
  { title: 'Open your website editor',     desc: 'Go to your website platform (WordPress, Wix, Squarespace, Webflow, or your HTML files).' },
  { title: 'Paste before </body>',         desc: "Find the closing </body> tag in your site's HTML and paste the code just before it. Most website builders have a 'Custom Code' or 'Footer Code' section in site settings." },
  { title: 'Save and publish',             desc: 'Save your changes and publish your site. The chat bubble will appear in the bottom-right corner.' },
  { title: 'Test it',                      desc: 'Visit your website and click the chat bubble to confirm it is working.' },
];

const SUGGESTED = [
  'What services do you offer?',
  'Can you tell me about your pricing?',
  'I need help right away',
];

// Live test chat — same AI + settings your customers get through the widget.
function TestChat({ businessName }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationKey] = useState(`webchat_test_${Date.now()}`);
  const [hotLead, setHotLead] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      content: `Hi! I'm the AI assistant for ${businessName || 'your business'}. How can I help you today?`,
      isAI: true,
    }]);
  }, [businessName]);

  const sendMessage = async (text = null) => {
    const messageToSend = (text || inputMessage).trim();
    if (!messageToSend || isLoading) return;

    setMessages(prev => [...prev, { id: `u_${Date.now()}`, content: messageToSend, isAI: false }]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: messageToSend }], conversationKey }),
      });
      if (!response.ok) throw new Error('chat failed');
      const data = await response.json();
      if (data.error) throw new Error('ai error');
      setMessages(prev => [...prev, { id: `ai_${Date.now()}`, content: data.response, isAI: true }]);
      if (data.isHotLead) setHotLead(true);
    } catch {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        content: "I'm having some technical difficulties. Please try again in a moment.",
        isAI: true,
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl flex flex-col overflow-hidden h-full min-h-[560px]">
      {/* Widget-style header — mirrors what visitors see on your site */}
      <div className="bg-violet-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">{businessName || 'Your Business'}</p>
            <p className="text-violet-200 text-xs leading-tight">AI Assistant</p>
          </div>
        </div>
        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">Live Test</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.isAI ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
              m.isAI
                ? m.isError
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : 'bg-[#0D1117] border border-gray-800 text-gray-200'
                : 'bg-violet-600 text-white'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {hotLead && (
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs">
            <span className="text-orange-400 font-medium">🔥 Hot lead detected!</span>
            <span className="text-orange-300 ml-1">On your site, this would trigger your lead alerts.</span>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#0D1117] border border-gray-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      <div className="px-4 pb-2 flex flex-wrap gap-2 flex-shrink-0">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={isLoading}
            className="px-2.5 py-1 bg-[#0D1117] border border-gray-800 rounded-full text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message to test your AI..."
            disabled={isLoading}
            className="flex-1 bg-[#0D1117] border border-gray-800 rounded-lg px-3.5 py-2 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WebChatPage() {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        if (data.customer?.business_name) setBusinessName(data.customer.business_name);
      })
      .catch(() => {});
  }, []);

  const widgetId = user?.id || 'YOUR_WIDGET_ID';
  const embedCode = `<script src="https://bizzybotai.com/api/widget/${widgetId}/widget.js"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Web Chat</h1>
          <p className="text-sm text-gray-500">
            Add your AI chatbot to any website with one line of code
            {businessName && <span className="text-gray-600"> — {businessName}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* Left column — setup */}
        <div className="space-y-5">
          {/* Embed Code */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-4 h-4 text-emerald-400" />
              <h2 className="text-white font-semibold">Your Embed Code</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Copy this snippet and paste it into your website just before the closing{' '}
              <code className="text-emerald-400 bg-emerald-500/10 px-1 rounded">&lt;/body&gt;</code> tag.
            </p>
            <div className="bg-[#0D1117] border border-gray-800 rounded-lg p-4 flex items-center gap-4">
              <code className="text-green-400 text-sm break-all flex-1 font-mono">{embedCode}</code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-3">
              This code is unique to your account. The chatbot will respond using your AI settings and business information.
            </p>
          </div>

          {/* Installation Steps */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h2 className="text-white font-semibold">How to Install</h2>
            </div>
            <div className="space-y-5">
              {STEPS.map(({ title, desc }, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-emerald-400 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{title}</p>
                    <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Platform-specific guides */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Platform Quick Guides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLATFORMS.map(({ name, how }) => (
                <div key={name} className="bg-[#0D1117] border border-gray-800 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{name}</p>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{how}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — live test chat */}
        <div className="xl:sticky xl:top-8 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-semibold">Test Your Chatbot</h2>
            <span className="text-gray-600 text-xs ml-auto">Uses your real AI settings — what you see is what customers get</span>
          </div>
          <TestChat businessName={businessName} />
        </div>
      </div>
    </div>
  );
}
