import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

const CHANNELS = ['email', 'text', 'chatbot', 'facebook', 'instagram', 'voice'];

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      businessName,
      industry,
      businessDescription,
      tone = 'Professional',
      responseLength = 'Medium',
      knowledgeBase = '',
      phone = '',
      website = '',
      heardAboutUs = '',
      utmSource = '',
      utmMedium = '',
      utmCampaign = '',
      referrerUrl = '',
    } = await request.json();

    if (!businessName?.trim()) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    }

    // Build enriched knowledge base — append phone/website so the AI can share them naturally
    const contactLines = [];
    if (phone?.trim()) contactLines.push(`Business phone: ${phone.trim()}`);
    if (website?.trim()) contactLines.push(`Website: ${website.trim()}`);
    const enrichedKnowledgeBase = contactLines.length > 0
      ? [knowledgeBase, ...contactLines].filter(Boolean).join('\n')
      : knowledgeBase;

    // 1. Update the customer record and mark onboarding complete
    await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE`).catch(() => {});
    // Attribution: how they said they heard about us (onboarding question) + what
    // AttributionTracker captured on their first visit (UTM params / ?ref= / referrer).
    await query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS signup_source TEXT,
        ADD COLUMN IF NOT EXISTS utm_source TEXT,
        ADD COLUMN IF NOT EXISTS utm_medium TEXT,
        ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
        ADD COLUMN IF NOT EXISTS referrer_url TEXT
    `).catch(() => {});
    const customerResult = await query(
      `UPDATE customers SET
         business_name = $1, onboarding_completed = TRUE, updated_at = NOW(),
         signup_source = NULLIF($3, ''), utm_source = NULLIF($4, ''),
         utm_medium = NULLIF($5, ''), utm_campaign = NULLIF($6, ''), referrer_url = NULLIF($7, '')
       WHERE clerk_user_id = $2 RETURNING id`,
      [businessName.trim(), userId, heardAboutUs, utmSource, utmMedium, utmCampaign, referrerUrl]
    );
    const customerId = customerResult.rows[0]?.id;

    // 2. Seed ai_configs (legacy — kept for compatibility)
    const existing = await query(`SELECT id FROM ai_configs WHERE user_id = $1`, [userId]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE ai_configs
         SET business_name  = COALESCE(NULLIF(business_name, ''), NULLIF(business_name, 'My Business'), $1),
             business_info  = CASE WHEN business_info  IS NULL OR business_info  = '' THEN $2 ELSE business_info  END,
             knowledge_base = CASE WHEN knowledge_base IS NULL OR knowledge_base = '' THEN $3 ELSE knowledge_base END,
             updated_at = NOW()
         WHERE user_id = $4`,
        [businessName.trim(), businessDescription || '', enrichedKnowledgeBase, userId]
      );
    } else {
      await query(
        `INSERT INTO ai_configs
           (user_id, business_name, personality, business_info, model, creativity, response_length, knowledge_base)
         VALUES ($1, $2, $3, $4, 'gpt-4o-mini', 0.7, 500, $5)`,
        [userId, businessName.trim(), tone.toLowerCase(), businessDescription || '', enrichedKnowledgeBase]
      );
    }

    // 2b. Save to business_profiles so it appears in the customer's Settings → Business Profile tab
    if (customerId) {
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
      `).catch(() => {});

      await query(`
        INSERT INTO business_profiles (customer_id, industry, phone, website, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (customer_id) DO UPDATE SET
          industry    = CASE WHEN business_profiles.industry    IS NULL OR business_profiles.industry    = '' THEN EXCLUDED.industry    ELSE business_profiles.industry    END,
          phone       = CASE WHEN business_profiles.phone       IS NULL OR business_profiles.phone       = '' THEN EXCLUDED.phone       ELSE business_profiles.phone       END,
          website     = CASE WHEN business_profiles.website     IS NULL OR business_profiles.website     = '' THEN EXCLUDED.website     ELSE business_profiles.website     END,
          description = CASE WHEN business_profiles.description IS NULL OR business_profiles.description = '' THEN EXCLUDED.description ELSE business_profiles.description END,
          updated_at  = NOW()
      `, [customerId, industry || '', phone?.trim() || '', website?.trim() || '', businessDescription || '']).catch(() => {});
    }

    // 3. Seed ai_channel_settings for ALL channels so the AI is configured from day one.
    //    Only fills in blanks — never overwrites settings the customer already configured.
    if (customerId) {
      for (const channel of CHANNELS) {
        await query(
          `INSERT INTO ai_channel_settings
             (customer_id, channel, business_name, industry, business_description,
              response_tone, response_length, knowledge_base,
              created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (customer_id, channel) DO UPDATE SET
             business_name        = CASE WHEN ai_channel_settings.business_name        = '' OR ai_channel_settings.business_name        IS NULL THEN EXCLUDED.business_name        ELSE ai_channel_settings.business_name        END,
             industry             = CASE WHEN ai_channel_settings.industry             = '' OR ai_channel_settings.industry             IS NULL THEN EXCLUDED.industry             ELSE ai_channel_settings.industry             END,
             business_description = CASE WHEN ai_channel_settings.business_description = '' OR ai_channel_settings.business_description IS NULL THEN EXCLUDED.business_description ELSE ai_channel_settings.business_description END,
             response_tone        = CASE WHEN ai_channel_settings.response_tone        = '' OR ai_channel_settings.response_tone        IS NULL THEN EXCLUDED.response_tone        ELSE ai_channel_settings.response_tone        END,
             response_length      = CASE WHEN ai_channel_settings.response_length      = '' OR ai_channel_settings.response_length      IS NULL THEN EXCLUDED.response_length      ELSE ai_channel_settings.response_length      END,
             knowledge_base       = CASE WHEN ai_channel_settings.knowledge_base       = '' OR ai_channel_settings.knowledge_base       IS NULL THEN EXCLUDED.knowledge_base       ELSE ai_channel_settings.knowledge_base       END,
             updated_at           = NOW()`,
          [
            customerId,
            channel,
            businessName.trim(),
            industry || '',
            businessDescription || '',
            tone,
            responseLength,
            enrichedKnowledgeBase,
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Onboarding complete error:', error);
    return NextResponse.json({ error: 'Failed to save onboarding data', details: error.message }, { status: 500 });
  }
}
