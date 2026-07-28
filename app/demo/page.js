'use client';

import { useState, useEffect, useRef } from 'react';
import { DEMO_WIDGET_ID } from '@/components/marketing/DemoWidget';
import Link from 'next/link';
import { Zap, MessageCircle } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

export default function DemoPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationKey] = useState(`conv_${Date.now()}`);
  const [hotLeadAlert, setHotLeadAlert] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        const name = data.customer?.business_name || user?.firstName || 'Your Business';
        setBusinessName(name);
        setMessages([{
          id: 'welcome',
          content: `Hi! I'm the AI assistant for ${name}. How can I help you today?`,
          isAI: true,
          timestamp: new Date().toISOString()
        }]);
      })
      .catch(() => {
        const name = user?.firstName || 'Your Business';
        setBusinessName(name);
        setMessages([{
          id: 'welcome',
          content: `Hi! I'm the AI assistant for ${name}. How can I help you today?`,
          isAI: true,
          timestamp: new Date().toISOString()
        }]);
      });
  }, [user]);

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage.trim();
    if (!messageToSend || isLoading) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: messageToSend,
      isAI: false,
      timestamp: new Date().toISOString()
    }]);
    setInputMessage('');
    setIsLoading(true);
    setHotLeadAlert(null);

    try {
      // /api/chat requires a Clerk session and 401s for visitors — this page
      // is public and linked from the landing page's "See it in action" CTA,
      // so every prospect who typed here got nothing back. The widget chat
      // route is the public one, already used by the site-wide chat bubble,
      // and talks to the same demo-account brain.
      const response = await fetch(`/api/widget/${DEMO_WIDGET_ID}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: messageToSend }],
          sessionId: conversationKey
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.response || 'AI response error');

      setMessages(prev => [...prev, {
        id: `ai_${Date.now()}`,
        content: data.response,
        isAI: true,
        timestamp: new Date().toISOString()
      }]);

      if (data.isHotLead) {
        setHotLeadAlert({ message: "Hot lead detected! This customer seems ready to take action.", timestamp: new Date().toISOString() });
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        content: "I'm sorry, I'm having some technical difficulties. Please try again in a moment.",
        isAI: true,
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "What services do you offer?",
    "How do I get started?",
    "I need help right away",
    "Can you tell me about your pricing?"
  ];

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0F1117] px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">BizzyBot AI — Web Chat Demo</span>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-[#161B22] border border-gray-800 text-gray-300 rounded-lg hover:text-white hover:border-gray-600 transition-colors text-sm"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Test Your AI Customer Engagement</h1>
          <p className="text-gray-500 mt-1 text-sm">This is how your AI chatbot will appear on your customers' websites.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="w-5 h-5 text-violet-400" />
                <h2 className="text-base font-semibold text-white">Your AI Assistant</h2>
              </div>

              <p className="text-gray-400 text-sm mb-5">
                The AI is trained on your business information and can:
              </p>

              <ul className="space-y-2.5 mb-5">
                {[
                  'Answer questions about your business',
                  'Qualify potential customers and capture leads',
                  'Schedule appointments and consultations',
                  'Provide 24/7 customer support',
                  'Integrate with your existing CRM and tools',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm">
                  <span className="text-orange-400 mt-0.5">🔥</span>
                  <span className="text-gray-300">Detect hot leads automatically</span>
                </li>
              </ul>

              <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <p className="text-violet-400 text-xs font-medium">Powered by OpenAI GPT-4</p>
                <p className="text-gray-500 text-xs mt-0.5">(model is configurable)</p>
              </div>
            </div>

            {/* Suggested Questions */}
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-orange-400">🔥</span>
                <h3 className="text-sm font-semibold text-white">Test Hot Lead Detection</h3>
              </div>
              <p className="text-gray-500 text-xs mb-4">Try these messages:</p>
              <div className="space-y-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(question)}
                    disabled={isLoading}
                    className="w-full text-left p-3 bg-[#0D1117] border border-gray-800 rounded-lg text-sm text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl h-[600px] flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="bg-violet-600 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{businessName || 'Your Business'}</h3>
                      <p className="text-violet-200 text-xs">AI Assistant</p>
                    </div>
                  </div>
                  <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">Live Demo</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isAI ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                      message.isAI
                        ? message.isError
                          ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                          : 'bg-[#0D1117] border border-gray-800 text-gray-200'
                        : 'bg-violet-600 text-white'
                    }`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-1 ${message.isAI ? 'text-gray-600' : 'text-violet-200'}`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                {hotLeadAlert && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span>🔥</span>
                      <span className="text-orange-400 font-medium text-sm">Hot Lead Detected!</span>
                    </div>
                    <p className="text-orange-300 text-xs mt-1">{hotLeadAlert.message}</p>
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-800 p-4">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-1 bg-[#0D1117] border border-gray-800 rounded-lg px-4 py-2 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputMessage.trim()}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </form>
                <p className="text-center text-gray-600 text-xs mt-2">Powered by BizzyBot AI</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
