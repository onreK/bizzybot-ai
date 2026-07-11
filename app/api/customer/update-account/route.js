// app/api/customer/update-account/route.js
import { NextResponse } from 'next/server';
import { currentUser, clerkClient } from '@clerk/nextjs';
import { query } from '@/lib/database';

// Force dynamic rendering since we use authentication
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Get the current user from Clerk
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized - Please sign in' 
      }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();
    const {
      firstName,
      lastName,
      username,
      phone,
    } = body;

    console.log('📝 Updating account for user:', user.id);

    // Make sure the phone column exists on legacy databases
    await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`).catch(() => {});

    // Update user information in Clerk
    try {
      const updateData = {};
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (username !== undefined) updateData.username = username;
      
      await clerkClient.users.updateUser(user.id, updateData);
      console.log('✅ Clerk user updated successfully');
    } catch (clerkError) {
      console.error('❌ Error updating Clerk user:', clerkError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to update account information',
        details: clerkError.message 
      }, { status: 500 });
    }

    // Update customer record in database.
    // SECURITY: customers.email is only ever synced from the VERIFIED Clerk
    // email — never from user input. (It previously wrote whatever the form
    // sent; customers.email feeds the admin-access check, so a user could
    // type any @bizzybotai.com address and gain admin.)
    try {
      const cleanPhone = phone !== undefined ? (String(phone).trim() || null) : undefined;
      await query(
        `UPDATE customers
         SET email = COALESCE($1, email),
             phone = CASE WHEN $2::boolean THEN $3 ELSE phone END,
             updated_at = NOW()
         WHERE clerk_user_id = $4`,
        [
          user.emailAddresses?.[0]?.emailAddress || null,
          cleanPhone !== undefined,
          cleanPhone !== undefined ? cleanPhone : null,
          user.id,
        ]
      );

      console.log('✅ Database customer record updated');
    } catch (dbError) {
      console.error('⚠️ Error updating database customer:', dbError);
      // Continue even if database update fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Account information updated successfully',
      user: {
        id: user.id,
        firstName,
        lastName,
        username,
        phone: phone !== undefined ? (String(phone).trim() || null) : undefined,
      }
    });

  } catch (error) {
    console.error('❌ Error updating account:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// GET method to retrieve current account information
export async function GET() {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Get customer from database
    const customerQuery = `
      SELECT * FROM customers 
      WHERE clerk_user_id = $1
      LIMIT 1
    `;
    
    const result = await query(customerQuery, [user.id]);
    const customer = result.rows[0];

    return NextResponse.json({
      success: true,
      account: {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        imageUrl: user.imageUrl || '',
        emailVerified: user.emailAddresses?.[0]?.verification?.status === 'verified',
        twoFactorEnabled: user.twoFactorEnabled || false,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        businessName: customer?.business_name || '',
        phone: customer?.phone || ''
      }
    });

  } catch (error) {
    console.error('❌ Error getting account:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get account information'
    }, { status: 500 });
  }
}
