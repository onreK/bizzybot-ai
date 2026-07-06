// app/api/customer/send-email/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs';
import { Resend } from 'resend';
import { 
  getCustomerByClerkId, 
  getEmailConversationsByCustomer,
  createEmailMessage 
} from '../../../../lib/database';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get customer from database
    const customer = await getCustomerByClerkId(user.id);
    
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const { conversationId, message } = body;
    
    if (!conversationId || !message) {
      return NextResponse.json({ 
        error: 'Conversation ID and message are required' 
      }, { status: 400 });
    }

    // Get all customer's email conversations to find the specific one
    const conversations = await getEmailConversationsByCustomer(customer.id);
    const conversation = conversations.find(conv => conv.id === parseInt(conversationId));
    
    if (!conversation) {
      return NextResponse.json({ 
        error: 'Email conversation not found' 
      }, { status: 404 });
    }

    // Convert message to HTML for email
    const htmlMessage = message
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${htmlMessage}
        <br>
        <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          Best regards,<br>
          ${customer.business_name}
        </p>
      </div>
    `;

    // Send email via Resend
    if (!resend) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }
    const emailResult = await resend.emails.send({
      from: conversation.business_email || `noreply@${customer.business_name.toLowerCase().replace(/\s+/g, '')}.com`,
      to: conversation.customer_email,
      subject: `Re: ${conversation.subject}`,
      text: message,
      html: emailHtml,
      headers: {
        'References': conversation.thread_id,
        'In-Reply-To': conversation.thread_id
      }
    });

    console.log('✅ Email sent via Resend:', emailResult);

    // Save the sent message to database
    const savedMessage = await createEmailMessage({
      conversation_id: conversation.id,
      sender: 'business',
      content: message,
      html_content: emailHtml,
      message_id: emailResult.id
    });

    console.log('✅ Email message saved to database');

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      emailId: emailResult.id,
      messageId: savedMessage.id
    });

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return NextResponse.json({ 
      error: 'Failed to send email',
      details: error.message 
    }, { status: 500 });
  }
}
