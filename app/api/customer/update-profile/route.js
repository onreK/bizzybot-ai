// app/api/customer/update-profile/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs';
import { query } from '@/lib/database';

export const dynamic = 'force-dynamic';

// Ensure the business_profiles table exists with the expected shape.
async function ensureBusinessProfilesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_profiles (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      industry VARCHAR(100),
      website VARCHAR(255),
      phone VARCHAR(50),
      address VARCHAR(255),
      city VARCHAR(100),
      state VARCHAR(50),
      zip_code VARCHAR(20),
      country VARCHAR(100),
      timezone VARCHAR(50),
      employee_count VARCHAR(20),
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(customer_id)
    )
  `);
}

// Find the customer row for this Clerk user, tolerant of the legacy
// user_id / clerk_user_id split. Heals both columns so every other
// endpoint (which keys on clerk_user_id) can find this row afterward.
async function findOrCreateCustomer(clerkId, email, fallbackBusinessName) {
  const found = await query(
    `SELECT * FROM customers WHERE clerk_user_id = $1 OR user_id = $1 ORDER BY id ASC LIMIT 1`,
    [clerkId]
  );

  if (found.rows.length > 0) {
    const customer = found.rows[0];
    // Heal: make sure both id columns point at this Clerk id.
    await query(
      `UPDATE customers
       SET clerk_user_id = $1,
           user_id = COALESCE(NULLIF(user_id, ''), $1),
           updated_at = NOW()
       WHERE id = $2`,
      [clerkId, customer.id]
    );
    return customer;
  }

  // No row yet — create one, setting BOTH id columns (user_id is NOT NULL).
  const created = await query(
    `INSERT INTO customers (clerk_user_id, user_id, email, business_name, plan, created_at, updated_at)
     VALUES ($1, $1, $2, $3, 'starter', NOW(), NOW())
     RETURNING *`,
    [clerkId, email || '', (fallbackBusinessName || 'My Business')]
  );
  return created.rows[0];
}

export async function POST(request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Please sign in' }, { status: 401 });
    }

    const clerkId = user.id;
    const email = user.emailAddresses?.[0]?.emailAddress || '';
    const body = await request.json();
    const {
      businessName, industry, website, phone,
      address, city, state, zipCode, country,
      timezone, employeeCount, description,
    } = body;

    console.log('🏢 Updating business profile for user:', clerkId);

    // 1. Find (and heal) or create the customer row.
    const customer = await findOrCreateCustomer(clerkId, email, businessName);

    // 2. Update business_name on the customer record (only when provided).
    if (businessName && businessName.trim()) {
      await query(
        `UPDATE customers SET business_name = $1, updated_at = NOW() WHERE id = $2`,
        [businessName.trim(), customer.id]
      );
    }

    // 3. Upsert business_profiles — manual update-or-insert so we never
    //    depend on an ON CONFLICT target that legacy tables may lack.
    await ensureBusinessProfilesTable();

    const existingProfile = await query(
      `SELECT id FROM business_profiles WHERE customer_id = $1 LIMIT 1`,
      [customer.id]
    );

    const profileValues = [
      customer.id,
      industry || null,
      website || null,
      phone || null,
      address || null,
      city || null,
      state || null,
      zipCode || null,
      country || 'United States',
      timezone || 'America/New_York',
      employeeCount || null,
      description || null,
    ];

    if (existingProfile.rows.length > 0) {
      await query(
        `UPDATE business_profiles SET
           industry = $2, website = $3, phone = $4, address = $5, city = $6,
           state = $7, zip_code = $8, country = $9, timezone = $10,
           employee_count = $11, description = $12, updated_at = NOW()
         WHERE customer_id = $1`,
        profileValues
      );
    } else {
      await query(
        `INSERT INTO business_profiles
           (customer_id, industry, website, phone, address, city, state,
            zip_code, country, timezone, employee_count, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        profileValues
      );
    }

    // 4. Read back the saved state and return it — proves the write landed.
    const readback = await query(
      `SELECT c.business_name,
              bp.industry, bp.website, bp.phone, bp.address, bp.city,
              bp.state, bp.zip_code, bp.country, bp.timezone,
              bp.employee_count, bp.description
       FROM customers c
       LEFT JOIN business_profiles bp ON bp.customer_id = c.id
       WHERE c.id = $1`,
      [customer.id]
    );
    const saved = readback.rows[0] || {};

    console.log('✅ Business profile saved for customer', customer.id);

    return NextResponse.json({
      success: true,
      message: 'Business profile updated successfully',
      profile: {
        businessName: saved.business_name || '',
        industry: saved.industry || '',
        website: saved.website || '',
        phone: saved.phone || '',
        address: saved.address || '',
        city: saved.city || '',
        state: saved.state || '',
        zipCode: saved.zip_code || '',
        country: saved.country || 'United States',
        timezone: saved.timezone || 'America/New_York',
        employeeCount: saved.employee_count || '',
        description: saved.description || '',
      },
    });
  } catch (error) {
    // No more silent success — surface the real reason.
    console.error('❌ Error updating business profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update business profile',
      details: error.message,
    }, { status: 500 });
  }
}

// GET — read the current business profile, tolerant of the legacy id split.
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      `SELECT c.business_name,
              bp.industry, bp.website, bp.phone, bp.address, bp.city,
              bp.state, bp.zip_code, bp.country, bp.timezone,
              bp.employee_count, bp.description
       FROM customers c
       LEFT JOIN business_profiles bp ON bp.customer_id = c.id
       WHERE c.clerk_user_id = $1 OR c.user_id = $1
       ORDER BY c.id ASC
       LIMIT 1`,
      [user.id]
    );

    const row = result.rows[0] || {};

    return NextResponse.json({
      success: true,
      profile: {
        businessName: row.business_name || '',
        industry: row.industry || '',
        website: row.website || '',
        phone: row.phone || '',
        address: row.address || '',
        city: row.city || '',
        state: row.state || '',
        zipCode: row.zip_code || '',
        country: row.country || 'United States',
        timezone: row.timezone || 'America/New_York',
        employeeCount: row.employee_count || '',
        description: row.description || '',
      },
    });
  } catch (error) {
    console.error('❌ Error getting business profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to get business profile' }, { status: 500 });
  }
}
