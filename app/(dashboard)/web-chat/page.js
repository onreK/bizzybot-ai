'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageCircle, Code, Copy, Check,
  ExternalLink, Globe, Zap
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
    <div className="p-6 max-w-4xl">
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

      {/* Embed Code */}
      <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold">Your Embed Code</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Copy this snippet and paste it into your website just before the closing{' '}
          <code className="text-violet-400 bg-violet-500/10 px-1 rounded">&lt;/body&gt;</code> tag.
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
      <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="w-4 h-4 text-blue-400" />
          <h2 className="text-white font-semibold">How to Install</h2>
        </div>
        <div className="space-y-5">
          {STEPS.map(({ title, desc }, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 bg-violet-500/20 border border-violet-500/30 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-violet-400 text-xs font-bold">{i + 1}</span>
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
      <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 mb-5">
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

      {/* Test your bot */}
      <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold">Test Your Chatbot</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          See exactly how your AI responds to customers — it uses your own AI settings and business information, so what you see here is what your customers will experience.
        </p>
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Open Chat Demo
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
