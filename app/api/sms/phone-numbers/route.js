import { NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export async function GET() {
  try {
    if (!twilioClient) {
      return NextResponse.json({
        success: false,
        error: 'Twilio not configured',
        numbers: [],
        message: 'Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to environment variables'
      });
    }

    // Get all phone numbers from Twilio
    const phoneNumbers = await twilioClient.incomingPhoneNumbers.list();
    
    const formattedNumbers = phoneNumbers.map(number => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      capabilities: {
        sms: number.capabilities.sms,
        voice: number.capabilities.voice
      },
      webhookUrl: number.smsUrl,
      dateCreated: number.dateCreated,
      status: 'active'
    }));

    console.log('📞 Retrieved phone numbers:', formattedNumbers.length);

    return NextResponse.json({
      success: true,
      numbers: formattedNumbers,
      count: formattedNumbers.length
    });

  } catch (error) {
    console.error('❌ Phone Numbers API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      numbers: []
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action, phoneNumber, webhookUrl } = await request.json();

    if (!twilioClient) {
      return NextResponse.json({
        success: false,
        error: 'Twilio not configured'
      }, { status: 400 });
    }

    if (action === 'purchase') {
      // Search for available toll-free phone numbers (no A2P 10DLC needed)
      const availableNumbers = await twilioClient.availablePhoneNumbers('US').tollFree.list({
        smsEnabled: true,
        limit: 10
      });

      if (availableNumbers.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No available phone numbers found'
        }, { status: 404 });
      }

      // Purchase the first available number
      const selectedNumber = availableNumbers[0];
      const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber: selectedNumber.phoneNumber,
        friendlyName: `SMS AI Assistant - ${new Date().toLocaleDateString()}`,
        smsUrl: webhookUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/api/sms/webhook`,
        smsMethod: 'POST'
      });

      console.log('✅ Phone number purchased:', purchasedNumber.phoneNumber);

      return NextResponse.json({
        success: true,
        phoneNumber: {
          sid: purchasedNumber.sid,
          phoneNumber: purchasedNumber.phoneNumber,
          friendlyName: purchasedNumber.friendlyName,
          capabilities: purchasedNumber.capabilities,
          webhookUrl: purchasedNumber.smsUrl
        }
      });
    }

    if (action === 'update_webhook') {
      // Update webhook URL for existing number
      const updatedNumber = await twilioClient.incomingPhoneNumbers(phoneNumber.sid).update({
        smsUrl: webhookUrl,
        smsMethod: 'POST'
      });

      return NextResponse.json({
        success: true,
        phoneNumber: updatedNumber
      });
    }

    if (action === 'delete') {
      // Release phone number
      await twilioClient.incomingPhoneNumbers(phoneNumber.sid).remove();

      return NextResponse.json({
        success: true,
        message: 'Phone number released successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Phone Number Action Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
