// lib/database.js
// COMPLETE CENTRALIZED DATABASE - All functions in one place
import pkg from 'pg';
const { Pool } = pkg;

// Enhanced connection configuration for Railway internal networking
function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  
  // Check if using Railway internal URL
  if (connectionString && connectionString.includes('.railway.internal')) {
    console.log('🚂 Configuring for Railway internal networking...');
    
    // Parse the internal connection string
    const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (match) {
      const [, user, password, host, port, database] = match;
      
      return {
        user,
        password,
        host,
        port: parseInt(port, 10),
        database,
        // CRITICAL: No SSL for internal connections
        ssl: false,
        // Increase timeouts for internal networking
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        query_timeout: 30000,
        statement_timeout: 30000,
        // Connection pool settings
        max: 20,
        min: 2,
        // Keep alive settings
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      };
    }
  }
  
  // Fallback to standard configuration for external URLs
  return {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// Create pool with proper configuration
const pool = new Pool(getPoolConfig());

// Add connection error handler
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// NO BUILD-TIME CONNECTION TEST - This was causing your errors!

// Enhanced query function with retry logic for internal networking
export async function query(text, params) {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(text, params);
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error;
      
      // Enhanced error logging for better debugging
      if (error.code === 'ENOTFOUND') {
        console.error(`❌ Database host not found (attempt ${i + 1}/${maxRetries})`);
      } else if (error.code === 'ECONNREFUSED') {
        console.error(`❌ Database connection refused (attempt ${i + 1}/${maxRetries})`);
      } else if (error.code === '28P01') {
        console.error(`❌ Database authentication failed`);
      } else if (i === 0) {
        console.log(`⚠️ Query attempt ${i + 1} failed: ${error.message}`);
      }
      
      // Only retry on connection errors
      if (i < maxRetries - 1 && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Export the pool for direct access if needed
export function getDbClient() {
  return pool;
}

// ============ DATABASE INITIALIZATION ============
export async function initializeDatabase() {
  try {
    console.log('🔧 Starting safe database initialization...');

    // Step 1: Create customers table FIRST (other tables depend on it)
    console.log('📋 Creating customers table...');
    await query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        clerk_user_id VARCHAR(255),
        name VARCHAR(255),
        business_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        source VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        plan VARCHAR(50) DEFAULT 'basic',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 2: Add missing columns to customers table if they don't exist
    const customerColumns = [
      { name: 'clerk_user_id', type: 'VARCHAR(255)' },
      { name: 'business_name', type: 'VARCHAR(255)' },
      { name: 'plan', type: 'VARCHAR(50) DEFAULT \'basic\'' },
      { name: 'stripe_customer_id', type: 'VARCHAR(255)' },
      { name: 'stripe_subscription_id', type: 'VARCHAR(255)' }
    ];

    for (const column of customerColumns) {
      try {
        await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`✅ Added/verified column: ${column.name}`);
      } catch (columnError) {
        console.log(`⚠️ Column ${column.name} operation: ${columnError.message}`);
      }
    }

    // Step 3: Create conversations table
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        type VARCHAR(50) DEFAULT 'general',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 4: Create messages table
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id),
        sender_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 5: Create hot_leads table
    await query(`
      CREATE TABLE IF NOT EXISTS hot_leads (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        conversation_id INTEGER REFERENCES conversations(id),
        urgency_score INTEGER DEFAULT 0,
        keywords TEXT[],
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'new',
        ai_analysis TEXT
      )
    `);

    // Step 6: Create gmail_connections table
    await query(`
      CREATE TABLE IF NOT EXISTS gmail_connections (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        user_id VARCHAR(255),
        email VARCHAR(255),
        gmail_email VARCHAR(255) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TIMESTAMP,
        status VARCHAR(50) DEFAULT 'connected',
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 7: Create gmail_conversations table
    await query(`
      CREATE TABLE IF NOT EXISTS gmail_conversations (
        id SERIAL PRIMARY KEY,
        gmail_connection_id INTEGER REFERENCES gmail_connections(id),
        thread_id VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_name VARCHAR(255),
        subject TEXT,
        last_customer_message TEXT,
        last_customer_message_at TIMESTAMP,
        last_ai_response_at TIMESTAMP,
        total_messages INTEGER DEFAULT 0,
        ai_response_generated BOOLEAN DEFAULT false,
        ai_response TEXT,
        ai_responded_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(gmail_connection_id, thread_id)
      )
    `);

    // Step 8: Create gmail_messages table   
    await query(`
      CREATE TABLE IF NOT EXISTS gmail_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES gmail_conversations(id),
        gmail_message_id VARCHAR(255) UNIQUE,
        thread_id VARCHAR(255),
        message_id VARCHAR(255),
        sender_type VARCHAR(50),
        sender_email VARCHAR(255),
        sender_name VARCHAR(255),
        recipient_email VARCHAR(255),
        subject TEXT,
        body_text TEXT,
        body_html TEXT,
        content TEXT,
        content_type VARCHAR(50) DEFAULT 'text/plain',
        in_reply_to VARCHAR(255),
        message_id_header VARCHAR(255),
        is_ai_generated BOOLEAN DEFAULT false,
        ai_model VARCHAR(100),
        sent_at TIMESTAMP,
        received_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 9: Create email tables for non-Gmail email
    await query(`
      CREATE TABLE IF NOT EXISTS email_conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255),
        subject VARCHAR(500),
        status VARCHAR(50) DEFAULT 'active',
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES email_conversations(id),
        sender_type VARCHAR(50) NOT NULL,
        subject VARCHAR(500),
        content TEXT NOT NULL,
        content_type VARCHAR(50) DEFAULT 'text/plain',
        message_id VARCHAR(255),
        in_reply_to VARCHAR(255),
        attachments JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 10: Create ai_analytics_events table
    await query(`
      CREATE TABLE IF NOT EXISTS ai_analytics_events (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        event_type VARCHAR(100) NOT NULL,
        channel VARCHAR(50),
        metadata JSONB,
        user_message TEXT,
        ai_response TEXT,
        confidence_score NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_customers_clerk_user_id ON customers(clerk_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)',
      'CREATE INDEX IF NOT EXISTS idx_hot_leads_customer_id ON hot_leads(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON gmail_connections(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_gmail_conversations_connection_id ON gmail_conversations(gmail_connection_id)',
      'CREATE INDEX IF NOT EXISTS idx_gmail_messages_conversation_id ON gmail_messages(conversation_id)'
    ];

    for (const indexQuery of indexes) {
      try {
        await query(indexQuery);
      } catch (indexError) {
        console.log('⚠️ Index operation:', indexError.message);
      }
    }

    console.log('✅ Database initialization completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return { success: false, error: error.message };
  }
}

// ============ CUSTOMER FUNCTIONS ============
export async function getCustomerByClerkId(clerkUserId) {
  try {
    const result = await query(
      'SELECT * FROM customers WHERE clerk_user_id = $1',
      [clerkUserId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Fallback: try user_id for backward compatibility
    const userResult = await query(
      'SELECT * FROM customers WHERE user_id = $1',
      [clerkUserId]
    );
    
    return userResult.rows[0] || null;
  } catch (error) {
    console.error('❌ Error getting customer by Clerk ID:', error);
    return null;
  }
}

export async function createCustomer(customerData) {
  try {
    const { clerk_user_id, email, business_name, plan } = customerData;
    
    // Check if customer already exists
    const existing = await getCustomerByClerkId(clerk_user_id);
    if (existing) {
      console.log('⚠️ Customer already exists:', existing.id);
      return existing;
    }
    
    const result = await query(`
      INSERT INTO customers (clerk_user_id, user_id, email, business_name, plan, created_at, updated_at)
      VALUES ($1, $1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [clerk_user_id, email, business_name, plan || 'starter']);

    console.log('✅ Customer created:', result.rows[0].id);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error creating customer:', error);
    throw error;
  }
}

export async function updateCustomer(customerId, updates) {
  try {
    const { business_name, phone, plan, status } = updates;
    
    const result = await query(`
      UPDATE customers 
      SET business_name = COALESCE($2, business_name),
          phone = COALESCE($3, phone),
          plan = COALESCE($4, plan),
          status = COALESCE($5, status),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [customerId, business_name, phone, plan, status]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error updating customer:', error);
    throw error;
  }
}

export async function getCustomerByEmail(userId, email) {
  try {
    const result = await query(
      'SELECT * FROM customers WHERE user_id = $1 AND email = $2',
      [userId, email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting customer by email:', error);
    return null;
  }
}

export async function createOrUpdateCustomer(userId, customerData) {
  try {
    const { name, email, phone, source } = customerData;
    
    const existing = await getCustomerByEmail(userId, email);
    
    if (existing) {
      const result = await query(
        `UPDATE customers 
         SET name = $1, phone = $2, source = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING *`,
        [name || existing.name, phone || existing.phone, source || existing.source, existing.id]
      );
      return result.rows[0];
    } else {
      const result = await query(
        `INSERT INTO customers (user_id, name, email, phone, source) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [userId, name, email, phone, source]
      );
      return result.rows[0];
    }
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    return null;
  }
}

// ============ CONVERSATION FUNCTIONS ============
export async function createConversation(userId, customerId, type = 'general') {
  try {
    const result = await query(
      `INSERT INTO conversations (user_id, customer_id, type) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [userId, customerId, type]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating conversation:', error);
    return null;
  }
}

export async function getUserConversations(userId, limit = 50) {
  try {
    const result = await query(
      `SELECT c.*, cu.name as customer_name, cu.email as customer_email,
              COUNT(m.id) as message_count,
              MAX(m.created_at) as last_message_at
       FROM conversations c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id, cu.name, cu.email
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return [];
  }
}

export async function getConversationMessages(conversationId, limit = 100) {
  try {
    const result = await query(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2`,
      [conversationId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    return [];
  }
}

// ============ MESSAGE FUNCTIONS ============
export async function addMessage(conversationId, senderType, content, metadata = null) {
  try {
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_type, content, metadata) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [conversationId, senderType, content, metadata]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error adding message:', error);
    return null;
  }
}

// ============ GMAIL CONNECTION FUNCTIONS ============
export async function saveGmailConnection(connectionData) {
  try {
    const { user_id, email, access_token, refresh_token, token_expiry } = connectionData;
    
    const result = await query(`
      INSERT INTO gmail_connections (user_id, email, access_token, refresh_token, token_expiry)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, email) 
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expiry = EXCLUDED.token_expiry,
        status = 'connected',
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [user_id, email, access_token, refresh_token, token_expiry]);
    
    console.log('✅ Gmail connection saved to database');
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error saving Gmail connection:', error);
    throw error;
  }
}

export async function getGmailConnection(user_id, email = null) {
  try {
    let queryText, params;
    
    if (email) {
      queryText = 'SELECT * FROM gmail_connections WHERE user_id = $1 AND email = $2 AND status = $3';
      params = [user_id, email, 'connected'];
    } else {
      queryText = 'SELECT * FROM gmail_connections WHERE user_id = $1 AND status = $2 ORDER BY connected_at DESC LIMIT 1';
      params = [user_id, 'connected'];
    }
    
    const result = await query(queryText, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error getting Gmail connection:', error);
    throw error;
  }
}

export async function getAllGmailConnections(user_id) {
  try {
    const result = await query(
      'SELECT * FROM gmail_connections WHERE user_id = $1 AND status = $2 ORDER BY connected_at DESC',
      [user_id, 'connected']
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting Gmail connections:', error);
    throw error;
  }
}

export async function updateGmailTokens(connection_id, access_token, token_expiry) {
  try {
    const result = await query(`
      UPDATE gmail_connections 
      SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [access_token, token_expiry, connection_id]);
    
    console.log('✅ Gmail tokens updated in database');
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error updating Gmail tokens:', error);
    throw error;
  }
}

export async function disconnectGmail(user_id, email) {
  try {
    const result = await query(`
      UPDATE gmail_connections 
      SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND email = $2
      RETURNING *
    `, [user_id, email]);
    
    console.log('✅ Gmail connection disconnected');
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error disconnecting Gmail:', error);
    throw error;
  }
}

// ============ EMAIL CONVERSATION FUNCTIONS ============
export async function saveEmailConversation(conversationData) {
  try {
    const { 
      gmail_connection_id, 
      thread_id, 
      customer_email, 
      customer_name, 
      subject 
    } = conversationData;
    
    const result = await query(`
      INSERT INTO gmail_conversations (
        gmail_connection_id, thread_id, customer_email, customer_name, subject
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (gmail_connection_id, thread_id) 
      DO UPDATE SET 
        customer_name = COALESCE(EXCLUDED.customer_name, gmail_conversations.customer_name),
        subject = COALESCE(EXCLUDED.subject, gmail_conversations.subject),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [gmail_connection_id, thread_id, customer_email, customer_name, subject]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error saving email conversation:', error);
    throw error;
  }
}

export async function getEmailConversations(gmail_connection_id, limit = 50) {
  try {
    const result = await query(`
      SELECT * FROM gmail_conversations 
      WHERE gmail_connection_id = $1 
      ORDER BY updated_at DESC 
      LIMIT $2
    `, [gmail_connection_id, limit]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting email conversations:', error);
    return [];
  }
}

export async function updateConversationStatus(conversation_id, status) {
  try {
    const result = await query(`
      UPDATE gmail_conversations 
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [conversation_id, status]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error updating conversation status:', error);
    throw error;
  }
}

// ============ EMAIL MESSAGE FUNCTIONS ============
export async function saveEmailMessage(messageData) {
  try {
    const {
      conversation_id,
      gmail_message_id,
      thread_id,
      sender_type,
      sender_email,
      recipient_email,
      subject,
      content,
      content_type,
      in_reply_to,
      message_id_header,
      is_ai_generated,
      ai_model,
      sent_at
    } = messageData;
    
    const result = await query(`
      INSERT INTO gmail_messages (
        conversation_id, gmail_message_id, thread_id, sender_type,
        sender_email, recipient_email, subject, content, content_type,
        in_reply_to, message_id_header, is_ai_generated, ai_model, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (gmail_message_id) DO NOTHING
      RETURNING *
    `, [
      conversation_id, gmail_message_id, thread_id, sender_type,
      sender_email, recipient_email, subject, content, content_type,
      in_reply_to, message_id_header, is_ai_generated, ai_model, sent_at
    ]);
    
    if (result.rows.length > 0) {
      console.log('✅ Gmail message saved to database');
      return result.rows[0];
    } else {
      console.log('ℹ️ Gmail message already exists in database');
      return null;
    }
  } catch (error) {
    console.error('❌ Error saving Gmail message:', error);
    throw error;
  }
}

export async function getEmailMessages(conversation_id, limit = 50) {
  try {
    const result = await query(`
      SELECT * FROM gmail_messages 
      WHERE conversation_id = $1 
      ORDER BY sent_at ASC
      LIMIT $2
    `, [conversation_id, limit]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting email messages:', error);
    return [];
  }
}

// Alias for compatibility
export const getEmailConnections = getAllGmailConnections;

// ============ HOT LEADS FUNCTIONS ============
export async function createHotLead(leadData) {
  try {
    const {
      customer_id,
      user_id,
      conversation_id,
      urgency_score,
      keywords,
      ai_analysis
    } = leadData;
    
    const result = await query(`
      INSERT INTO hot_leads (
        user_id, customer_id, conversation_id, 
        urgency_score, keywords, ai_analysis, detected_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [
      user_id || customer_id, // Support both
      customer_id, 
      conversation_id,
      urgency_score || 0,
      keywords || [],
      ai_analysis || ''
    ]);
    
    console.log('🔥 Hot lead created:', result.rows[0].id);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error creating hot lead:', error);
    throw error;
  }
}

export async function getHotLeads(customerId, limit = 50) {
  try {
    const result = await query(`
      SELECT * FROM hot_leads 
      WHERE customer_id = $1 OR user_id = $1
      ORDER BY detected_at DESC 
      LIMIT $2
    `, [customerId, limit]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting hot leads:', error);
    return [];
  }
}

export async function updateHotLeadStatus(leadId, status, notes) {
  try {
    const result = await query(`
      UPDATE hot_leads 
      SET status = $2, 
          ai_analysis = COALESCE($3, ai_analysis),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [leadId, status, notes]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error updating hot lead:', error);
    throw error;
  }
}

// ============ STATS AND ANALYTICS ============
export async function getCustomerStats(customerId) {
  try {
    const stats = {};
    
    // Get hot leads count
    const leadsResult = await query(
      'SELECT COUNT(*) as count FROM hot_leads WHERE customer_id = $1 OR user_id = $1',
      [customerId]
    );
    stats.totalLeads = parseInt(leadsResult.rows[0].count);
    
    // Get recent leads (last 7 days)
    const recentResult = await query(`
      SELECT COUNT(*) as count 
      FROM hot_leads 
      WHERE (customer_id = $1 OR user_id = $1)
      AND detected_at > NOW() - INTERVAL '7 days'
    `, [customerId]);
    stats.recentLeads = parseInt(recentResult.rows[0].count);
    
    // Get AI interactions count
    const aiResult = await query(
      'SELECT COUNT(*) as count FROM ai_analytics_events WHERE customer_id = $1',
      [customerId]
    );
    stats.aiInteractions = parseInt(aiResult.rows[0].count);
    
    // Get conversations count
    const convResult = await query(
      'SELECT COUNT(*) as count FROM conversations WHERE user_id = $1 OR customer_id = $1',
      [customerId]
    );
    stats.total_conversations = parseInt(convResult.rows[0].count);
    
    // Get messages count
    const msgResult = await query(`
      SELECT COUNT(m.*) as count 
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = $1 OR c.customer_id = $1
    `, [customerId]);
    stats.total_messages = parseInt(msgResult.rows[0].count);
    
    stats.total_hot_leads = stats.totalLeads;
    stats.hot_leads_today = 0;
    stats.conversations_today = 0;
    stats.messages_today = 0;
    stats.leadsByChannel = [];
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting customer stats:', error);
    return {
      totalLeads: 0,
      recentLeads: 0,
      leadsByChannel: [],
      aiInteractions: 0,
      total_conversations: 0,
      total_messages: 0,
      total_hot_leads: 0,
      hot_leads_today: 0,
      conversations_today: 0,
      messages_today: 0
    };
  }
}

// ============ AI ANALYTICS ============
export async function logAIEvent(eventData) {
  try {
    const {
      customer_id,
      event_type,
      event_value,
      event_data,
      channel,
      metadata,
      user_message,
      ai_response,
      confidence_score
    } = eventData;
    
    // The live table has no event_value/event_data columns (event_data was
    // renamed to metadata long ago) — fold everything into metadata.
    const mergedMetadata = metadata ?? event_data ?? (event_value != null ? JSON.stringify({ value: event_value }) : null);
    const result = await query(`
      INSERT INTO ai_analytics_events (
        customer_id, event_type, channel, metadata,
        user_message, ai_response, confidence_score, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      customer_id, event_type, channel, mergedMetadata,
      user_message, ai_response, confidence_score
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error logging AI event:', error);
    throw error;
  }
}

// ============ UTILITY FUNCTIONS ============
export async function checkDatabaseConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    return { 
      connected: true, 
      timestamp: result.rows[0].current_time 
    };
  } catch (error) {
    console.error('❌ Database connection check failed:', error);
    return { 
      connected: false, 
      error: error.message 
    };
  }
}

export function getConnectionInfo() {
  return {
    totalCount: pool.totalCount || 0,
    idleCount: pool.idleCount || 0,
    waitingCount: pool.waitingCount || 0
  };
}

export default pool;
