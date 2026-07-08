import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { subdomain } = params;
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain') || 'unknown';
  
  console.log(`Widget JS requested for ${subdomain} from domain: ${domain}`);
  
  // Generate dynamic widget code that checks auth every time
  const widgetCode = `
(function() {
  console.log('AI Widget initializing for ${subdomain}...');
  
  const WIDGET_API_BASE = '${process.env.NEXT_PUBLIC_APP_URL || 'https://bizzybotai.com'}';
  const SESSION_ID = 'w' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  let chatWidget = null;
  let chatOpen = false;
  let messages = [];
  let isTyping = false;
  
  // Widget Authentication Check
  async function authenticateWidget() {
    try {
      const response = await fetch(WIDGET_API_BASE + '/api/widget/${subdomain}/auth');
      const auth = await response.json();
      
      if (!auth.active) {
        console.warn('AI Widget: Subscription inactive');
        return null;
      }
      
      return auth.config;
    } catch (error) {
      console.error('Widget authentication failed:', error);
      return null;
    }
  }
  
  // Initialize Widget
  async function initWidget() {
    const config = await authenticateWidget();
    
    if (!config) {
      console.log('AI Widget disabled - subscription required');
      return;
    }
    
    console.log('AI Widget authenticated successfully');
    createChatWidget(config);
  }
  
  function createChatWidget(config) {
    // Remove existing widget if any
    const existingWidget = document.getElementById('ai-chat-widget');
    if (existingWidget) {
      existingWidget.remove();
    }
    
    // Create chat button
    const chatButton = document.createElement('div');
    chatButton.id = 'ai-chat-widget';
    chatButton.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background-color: \${config.primaryColor};
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      transition: transform 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    \`;
    
    chatButton.innerHTML = '🤖';
    chatButton.title = 'Chat with ' + config.businessName;
    
    chatButton.addEventListener('mouseenter', () => {
      chatButton.style.transform = 'scale(1.1)';
    });
    
    chatButton.addEventListener('mouseleave', () => {
      chatButton.style.transform = 'scale(1)';
    });
    
    chatButton.onclick = () => toggleChat(config);
    
    document.body.appendChild(chatButton);
    
    // Initialize with welcome message
    messages = [{
      from: 'bot',
      text: config.welcomeMessage,
      timestamp: new Date().toISOString()
    }];
  }
  
  function toggleChat(config) {
    if (chatOpen) {
      closeChat();
    } else {
      openChat(config);
    }
  }
  
  async function openChat(config) {
    // Re-authenticate before opening chat
    const authConfig = await authenticateWidget();
    if (!authConfig) {
      alert('This AI assistant is temporarily unavailable.');
      return;
    }
    
    chatOpen = true;
    const chatButton = document.getElementById('ai-chat-widget');
    chatButton.innerHTML = '✕';
    
    // Create chat window
    const chatWindow = document.createElement('div');
    chatWindow.id = 'ai-chat-window';
    chatWindow.style.cssText = \`
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      z-index: 9998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    \`;
    
    // Chat header
    const header = document.createElement('div');
    header.style.cssText = \`
      background: \${config.primaryColor};
      color: white;
      padding: 16px;
      font-weight: 600;
      font-size: 14px;
    \`;
    header.innerHTML = \`
      <div style="display: flex; align-items: center;">
        <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">🤖</div>
        <div>
          <div>\${config.businessName}</div>
          <div style="font-size: 12px; opacity: 0.9;">AI Assistant</div>
        </div>
      </div>
    \`;
    
    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'chat-messages';
    messagesContainer.style.cssText = \`
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f9f9f9;
    \`;
    
    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = \`
      padding: 16px;
      border-top: 1px solid #eee;
      background: white;
    \`;
    
    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = \`
      display: flex;
      gap: 8px;
    \`;
    
    const messageInput = document.createElement('input');
    messageInput.type = 'text';
    messageInput.placeholder = 'Type your message...';
    messageInput.style.cssText = \`
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 20px;
      padding: 8px 16px;
      outline: none;
      font-size: 14px;
    \`;
    
    const sendButton = document.createElement('button');
    sendButton.innerHTML = '→';
    sendButton.style.cssText = \`
      background: \${config.primaryColor};
      color: white;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: pointer;
      font-size: 16px;
    \`;
    
    // Event listeners
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage(config, messageInput.value);
        messageInput.value = '';
      }
    });
    
    sendButton.addEventListener('click', () => {
      sendMessage(config, messageInput.value);
      messageInput.value = '';
    });
    
    // Assemble chat window
    inputWrapper.appendChild(messageInput);
    inputWrapper.appendChild(sendButton);
    inputContainer.appendChild(inputWrapper);
    
    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputContainer);
    
    document.body.appendChild(chatWindow);
    
    // Render existing messages
    renderMessages();
    messageInput.focus();
  }
  
  function closeChat() {
    chatOpen = false;
    const chatButton = document.getElementById('ai-chat-widget');
    const chatWindow = document.getElementById('ai-chat-window');
    
    if (chatButton) chatButton.innerHTML = '🤖';
    if (chatWindow) chatWindow.remove();
  }
  
  function renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    container.innerHTML = '';
    
    messages.forEach(msg => {
      const messageEl = document.createElement('div');
      messageEl.style.cssText = \`
        margin-bottom: 12px;
        display: flex;
        \${msg.from === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
      \`;
      
      const bubble = document.createElement('div');
      bubble.style.cssText = \`
        max-width: 80%;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
        \${msg.from === 'user' 
          ? \`background: \${document.querySelector('#ai-chat-widget').style.backgroundColor}; color: white; border-bottom-right-radius: 4px;\`
          : 'background: white; color: #333; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);'
        }
      \`;
      bubble.textContent = msg.text;
      
      messageEl.appendChild(bubble);
      container.appendChild(messageEl);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }
  
  async function sendMessage(config, text) {
    if (!text.trim() || isTyping) return;
    
    // Add user message
    messages.push({
      from: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString()
    });
    
    renderMessages();
    isTyping = true;
    
    try {
      // Send to the public widget chat API (visitors have no login session)
      const response = await fetch(WIDGET_API_BASE + '/api/widget/${subdomain}/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          sessionId: SESSION_ID
        }),
      });

      if (response.ok) {
        const data = await response.json();
        messages.push({
          from: 'bot',
          text: data.response,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Chat API failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
      messages.push({
        from: 'bot',
        text: \`Sorry, I'm having trouble right now. Please contact \${config.businessName} directly for immediate assistance.\`,
        timestamp: new Date().toISOString()
      });
    } finally {
      isTyping = false;
      renderMessages();
    }
  }
  
  // Periodic re-authentication (every 5 minutes)
  setInterval(async () => {
    const config = await authenticateWidget();
    if (!config) {
      // Remove widget if subscription becomes inactive
      const existingWidget = document.getElementById('ai-chat-widget');
      const existingWindow = document.getElementById('ai-chat-window');
      
      if (existingWidget) existingWidget.remove();
      if (existingWindow) existingWindow.remove();
      
      console.log('Widget removed due to inactive subscription');
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
`;

  return new NextResponse(widgetCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
