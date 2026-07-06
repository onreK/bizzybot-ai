import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { name, email, phone, business, message } = await request.json();

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Prepare notification email for you
    const notificationEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🚀 New Lead from IntelliHub AI</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1e40af; margin-top: 0;">Lead Details</h2>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>👤 Name:</strong> ${name}</p>
            <p style="margin: 8px 0;"><strong>📧 Email:</strong> <a href="mailto:${email}" style="color: #1e40af;">${email}</a></p>
            ${phone ? `<p style="margin: 8px 0;"><strong>📞 Phone:</strong> <a href="tel:${phone}" style="color: #1e40af;">${phone}</a></p>` : ''}
            ${business ? `<p style="margin: 8px 0;"><strong>🏢 Business Type:</strong> ${business}</p>` : ''}
          </div>
          
          ${message ? `
            <div>
              <h3 style="color: #1e40af;">💬 Message:</h3>
              <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #1e40af; border-radius: 4px;">
                <p style="margin: 0; line-height: 1.6;">${message}</p>
              </div>
            </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-radius: 8px;">
            <h3 style="color: #d97706; margin-top: 0;">⚡ Quick Actions:</h3>
            <p style="margin: 5px 0;"><a href="mailto:${email}" style="color: #1e40af; text-decoration: none;">📧 Reply to ${name}</a></p>
            ${phone ? `<p style="margin: 5px 0;"><a href="tel:${phone}" style="color: #1e40af; text-decoration: none;">📞 Call ${name}</a></p>` : ''}
            <p style="margin: 5px 0;"><strong>💡 Recommended follow-up:</strong> Within 2 hours for best conversion</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #64748b;">
          <p>Sent from your IntelliHub AI landing page contact form</p>
          <p style="font-size: 12px;">Received on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    // Prepare auto-reply email for the prospect
    const autoReplyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Thanks for Your Interest!</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1e40af; margin-top: 0;">Hi ${name},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Thank you for reaching out about our AI Business Automation Platform! We're excited to help transform your business with intelligent automation.
          </p>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">🚀 What's Next?</h3>
            <p style="margin: 8px 0;">✅ Our team will review your inquiry</p>
            <p style="margin: 8px 0;">✅ We'll contact you within 24 hours</p>
            <p style="margin: 8px 0;">✅ We'll discuss how AI can specifically help your ${business || 'business'}</p>
            <p style="margin: 8px 0;">✅ Set up a personalized demo if you're interested</p>
          </div>
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #059669; margin-top: 0;">💡 While You Wait...</h3>
            <p style="margin: 8px 0;">Check out our live demo: <a href="https://bizzybotai.com/demo" style="color: #1e40af;">See BizzyBot in action</a></p>
            <p style="margin: 8px 0;">See how AI automation can work for businesses like yours!</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280;">Questions? Reply to this email or call us directly.</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #64748b;">
          <p><strong>IntelliHub AI</strong> - Your Business, Powered by AI</p>
          <p style="font-size: 12px;">Transform customer interactions with Chat, SMS, Voice & Email automation</p>
        </div>
      </div>
    `;

    // Send emails using Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'kernopay@gmail.com';

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Send notification email to you
    const notificationResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IntelliHub AI <onboarding@resend.dev>',
        to: [notificationEmail],
        subject: `🚀 New Lead: ${name} (${business || 'Business Owner'})`,
        html: notificationEmailHtml,
      }),
    });

    // Send auto-reply to prospect
    const autoReplyResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IntelliHub AI <onboarding@resend.dev>',
        to: [email],
        subject: 'Thanks for your interest in AI Business Automation!',
        html: autoReplyHtml,
      }),
    });

    if (!notificationResponse.ok || !autoReplyResponse.ok) {
      const error1 = await notificationResponse.text();
      const error2 = await autoReplyResponse.text();
      throw new Error(`Email sending failed: ${error1} | ${error2}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Emails sent successfully!' 
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send email. Please try again.' },
      { status: 500 }
    );
  }
}
