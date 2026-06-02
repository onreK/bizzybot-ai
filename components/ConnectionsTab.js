// ConnectionsTab.js - Dark theme component for the Connections tab
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Mail, 
  Globe, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Zap,
  ExternalLink,
  Activity,
  Link as LinkIcon,
  Shield,
  Phone,
  Building
} from 'lucide-react';

export default function ConnectionsTab() {
  const { user } = useUser();

  // Connection states
  const [gmailConnection, setGmailConnection] = useState({ connected: false, email: '' });
  const [outlookConnection, setOutlookConnection] = useState({ connected: false, email: '' });
  const [domainConnection, setDomainConnection] = useState({ configured: false });
  const [activeConnection, setActiveConnection] = useState('none');

  // Loading states
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [loadingOutlook, setLoadingOutlook] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  
  // Domain settings
  const [domainSettings, setDomainSettings] = useState({
    businessName: '',
    customDomain: '',
    emailAddress: ''
  });

  // Messages
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const [gmailRes, outlookRes] = await Promise.all([
        fetch('/api/gmail/status'),
        fetch('/api/auth/outlook/status'),
      ]);
      if (gmailRes.ok) {
        const data = await gmailRes.json();
        if (data.connected && data.connection) {
          setGmailConnection({ connected: true, email: data.connection.email });
          setActiveConnection('gmail');
        }
      }
      if (outlookRes.ok) {
        const data = await outlookRes.json();
        if (data.connected) {
          setOutlookConnection({ connected: true, email: data.email });
          setActiveConnection('outlook');
        }
      }
    } catch (error) {
      console.error('Error loading connection status:', error);
    }
  };

  const connectGmail = async () => {
    setLoadingGmail(true);
    try {
      window.location.href = `/api/auth/google?userId=${user?.id || ''}`;
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      setMessage({ type: 'error', text: 'Error connecting to Gmail. Please try again.' });
      setLoadingGmail(false);
    }
  };

  const connectOutlook = () => {
    setLoadingOutlook(true);
    window.location.href = '/api/auth/outlook';
  };

  const disconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect your Gmail account?')) {
      return;
    }
    
    try {
      setLoadingGmail(true);
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' });
      if (response.ok) {
        setGmailConnection({ connected: false, email: '' });
        setActiveConnection('none');
        setMessage({ type: 'success', text: 'Gmail disconnected successfully!' });
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      setMessage({ type: 'error', text: 'Error disconnecting Gmail. Please try again.' });
    } finally {
      setLoadingGmail(false);
    }
  };

  const testGmailConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch('/api/gmail/test');
      const data = await response.json();
      setMessage({ 
        type: data.success ? 'success' : 'error', 
        text: data.message || 'Connection test completed' 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const saveDomainSettings = async () => {
    setSavingDomain(true);
    try {
      const response = await fetch('/api/customer/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainSettings)
      });
      
      if (response.ok) {
        setDomainConnection({ configured: true });
        setMessage({ type: 'success', text: 'Domain settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save domain settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving domain settings' });
    } finally {
      setSavingDomain(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message.text && (
        <div className={`p-4 rounded-xl border backdrop-blur-lg ${
          message.type === 'success' 
            ? 'bg-green-500/20 border-green-500/30 text-green-300' 
            : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            <button 
              onClick={() => setMessage({ type: '', text: '' })}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Connection Status Overview */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Connection Status</h3>
        </div>
        <p className="text-gray-300 mb-6">Overview of your email connections and AI status</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Gmail Status */}
          <div className="text-center">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
              gmailConnection.connected ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-500/20 border border-gray-500/30'
            }`}>
              <Mail className={`w-6 h-6 ${gmailConnection.connected ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <p className="font-medium text-white">Gmail</p>
            <p className={`text-sm ${gmailConnection.connected ? 'text-green-400' : 'text-gray-400'}`}>
              {gmailConnection.connected ? 'Connected' : 'Not Connected'}
            </p>
          </div>

          {/* Outlook Status */}
          <div className="text-center">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
              outlookConnection.connected ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-500/20 border border-gray-500/30'
            }`}>
              <Mail className={`w-6 h-6 ${outlookConnection.connected ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <p className="font-medium text-white">Outlook</p>
            <p className={`text-sm ${outlookConnection.connected ? 'text-green-400' : 'text-gray-400'}`}>
              {outlookConnection.connected ? 'Connected' : 'Not Connected'}
            </p>
          </div>

          {/* AI Status */}
          <div className="text-center">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
              activeConnection !== 'none' ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-gray-500/20 border border-gray-500/30'
            }`}>
              <Zap className={`w-6 h-6 ${activeConnection !== 'none' ? 'text-blue-400' : 'text-gray-400'}`} />
            </div>
            <p className="font-medium text-white">AI Status</p>
            <p className={`text-sm ${activeConnection !== 'none' ? 'text-blue-400' : 'text-gray-400'}`}>
              {activeConnection !== 'none' ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      </div>

      {/* Gmail Connection */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Gmail Connection</h3>
        </div>
        <p className="text-gray-300 mb-6">Connect your Gmail account for AI-powered email automation</p>
        
        {gmailConnection.connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-500/20 border border-green-500/30 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium text-green-300">Connected to Gmail</p>
                  <p className="text-sm text-green-400">{gmailConnection.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeConnection === 'gmail' && (
                  <span className="px-3 py-1 bg-green-400/20 text-green-300 text-xs rounded-full font-medium border border-green-400/30">
                    Active
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={testGmailConnection}
                disabled={testingConnection}
                variant="outline"
                className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {testingConnection ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                Test Connection
              </Button>
              
              <Button
                onClick={disconnectGmail}
                disabled={loadingGmail}
                variant="outline"
                className="flex items-center gap-2 text-red-300 border-red-500/30 hover:bg-red-500/20"
              >
                {loadingGmail ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Mail className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Connect Your Gmail Account</h4>
            <p className="text-gray-300 mb-6 max-w-md mx-auto">
              Connect your Gmail account to enable AI-powered email responses. Your emails will be monitored and responded to automatically.
            </p>
            <Button
              onClick={connectGmail}
              disabled={loadingGmail}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loadingGmail ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              Connect Gmail Account
            </Button>
          </div>
        )}
      </div>

      {/* Outlook Connection */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Outlook / Microsoft 365</h3>
        </div>
        <p className="text-gray-300 mb-6">Connect your Outlook or Microsoft 365 account for AI-powered email automation</p>

        {outlookConnection.connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-500/20 border border-green-500/30 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium text-green-300">Connected to Outlook</p>
                  <p className="text-sm text-green-400">{outlookConnection.email}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={connectOutlook}
                disabled={loadingOutlook}
                variant="outline"
                className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {loadingOutlook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Mail className="w-8 h-8 text-blue-400" />
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Connect Your Outlook Account</h4>
            <p className="text-gray-300 mb-6 max-w-md mx-auto">
              Connect Outlook or Microsoft 365 to enable AI-powered email responses on your Microsoft inbox.
            </p>
            <Button
              onClick={connectOutlook}
              disabled={loadingOutlook}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loadingOutlook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              Connect Outlook Account
            </Button>
          </div>
        )}
      </div>

      {/* Domain Email Setup */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Domain Email Setup</h3>
        </div>
        <p className="text-gray-300 mb-6">
          Use your existing business domain for professional email automation
        </p>
        
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Globe className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-2">Set Up Domain Email</h4>
          <p className="text-gray-300 mb-6 max-w-md mx-auto">
            Use your existing business domain for professional email automation
          </p>
          
          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Business Name</label>
              <Input
                value={domainSettings.businessName}
                onChange={(e) => setDomainSettings(prev => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your Business Name"
                className="bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Your Domain</label>
              <Input
                value={domainSettings.customDomain}
                onChange={(e) => setDomainSettings(prev => ({ ...prev, customDomain: e.target.value }))}
                placeholder="yourbusiness.com"
                className="bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-400"
              />
            </div>
            
            <Button
              onClick={saveDomainSettings}
              disabled={savingDomain}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {savingDomain ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              Save Domain Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Connection Help */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Need Help?</h3>
        </div>
        <p className="text-gray-300 mb-6">Choose the best connection method for your business</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              Gmail Connection
            </h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Quick setup with OAuth
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Uses your existing Gmail account
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Secure and encrypted connection
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Instant AI email responses
              </li>
            </ul>
          </div>
          
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              Domain Email
            </h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Professional branded emails
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Requires DNS configuration
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Uses your business domain
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                Maximum professionalism
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
