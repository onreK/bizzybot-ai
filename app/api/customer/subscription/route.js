import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs';

// Lazy load database and Stripe to prevent build errors
let getDbClient;
let Stripe;
let stripe;

// Initialize connections only when needed
async function initializeConnections() {
  if (!getDbClient) {
    const db = await import('@/lib/database');
    getDbClient = db.getDbClient;
  }
  
  if (!stripe) {
    Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  
  return { getDbClient, stripe };
}

// Current Stripe price IDs — keep in sync with lib/stripe.js (hardcoded here
// to avoid importing lib/stripe.js, which instantiates Stripe at module load).
const STRIPE_PRICE_IDS = {
  starter: 'price_1TcLVq01O3SsJO6lr6j8MbWK',
  professional: 'price_1TcLVr01O3SsJO6lyOqWsyhT',
  business: 'price_1TcLVs01O3SsJO6lUmCp5Ojl',
};

// Plans: all channels on every tier; tiers differ by monthly AI response pool,
// voice minutes, and seats. (The per-channel numbers below mirror the response
// pool for backward compatibility; the settings UI reads prices/usage elsewhere.)
const PLAN_DETAILS = {
  starter: {
    name: 'Starter',
    price: 29,
    features: { conversations: 300, emailResponses: 300, smsMessages: 300, voiceMinutes: 15, seats: 1 },
  },
  professional: {
    name: 'Professional',
    price: 69,
    features: { conversations: 1500, emailResponses: 1500, smsMessages: 1500, voiceMinutes: 100, seats: 2 },
  },
  business: {
    name: 'Business',
    price: 199,
    features: { conversations: 5000, emailResponses: 5000, smsMessages: 5000, voiceMinutes: 400, seats: 5 },
  },
};

export async function GET() {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize connections
    const { getDbClient, stripe } = await initializeConnections();
    
    // Try to get database connection
    let client;
    try {
      client = await getDbClient().connect();
    } catch (dbError) {
      console.log('Database not available, returning default subscription');
      // Return default subscription if database is not available
      return NextResponse.json({ 
        subscription: {
          plan: 'starter',
          status: 'trialing',
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          planDetails: PLAN_DETAILS.starter,
          usage: {
            conversations: 0,
            emailResponses: 0,
            smsMessages: 0,
            maxConversations: 500,
            maxEmailResponses: 1000,
            maxSmsMessages: 200
          }
        },
        plans: PLAN_DETAILS
      });
    }
    
    try {
      // Get customer from database
      const customerQuery = 'SELECT * FROM customers WHERE clerk_user_id = $1';
      const customerResult = await client.query(customerQuery, [user.id]);
      
      if (customerResult.rows.length === 0) {
        // Return trial status if no customer yet
        return NextResponse.json({ 
          subscription: {
            plan: 'starter',
            status: 'trialing',
            trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            planDetails: PLAN_DETAILS.starter,
            usage: {
              conversations: 0,
              emailResponses: 0,
              smsMessages: 0,
              maxConversations: 500,
              maxEmailResponses: 1000,
              maxSmsMessages: 200
            }
          },
          plans: PLAN_DETAILS
        });
      }
      
      const customer = customerResult.rows[0];
      
      // If customer has Stripe subscription, get real data from Stripe
      if (customer.stripe_subscription_id && stripe) {
        try {
          // Get subscription from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(
            customer.stripe_subscription_id
          );
          
          // Get usage from database - with safe fallback
          let usage = { conversations: 0, email_responses: 0, sms_messages: 0 };
          try {
            const usageQuery = `
              SELECT 
                COUNT(DISTINCT CASE WHEN type = 'conversation' AND created_at >= date_trunc('month', CURRENT_DATE) THEN id END) as conversations,
                COUNT(DISTINCT CASE WHEN type = 'email' AND created_at >= date_trunc('month', CURRENT_DATE) THEN id END) as email_responses,
                COUNT(DISTINCT CASE WHEN type = 'sms' AND created_at >= date_trunc('month', CURRENT_DATE) THEN id END) as sms_messages
              FROM customer_usage 
              WHERE customer_id = $1
            `;
            const usageResult = await client.query(usageQuery, [customer.id]);
            if (usageResult.rows[0]) {
              usage = usageResult.rows[0];
            }
          } catch (usageError) {
            console.log('Usage table not available yet');
          }
          
          // Determine plan from price ID
          let planName = 'starter';
          const priceId = stripeSubscription.items.data[0]?.price.id;
          
          if (priceId === STRIPE_PRICE_IDS.professional) {
            planName = 'professional';
          } else if (priceId === STRIPE_PRICE_IDS.business) {
            planName = 'business';
          }
          
          // Check if subscription has a discount
          let discountInfo = null;
          if (stripeSubscription.discount) {
            discountInfo = {
              coupon: stripeSubscription.discount.coupon.name || stripeSubscription.discount.coupon.id,
              percentOff: stripeSubscription.discount.coupon.percent_off,
              amountOff: stripeSubscription.discount.coupon.amount_off,
              valid: stripeSubscription.discount.end ? new Date(stripeSubscription.discount.end * 1000) > new Date() : true
            };
          }
          
          return NextResponse.json({ 
            success: true,
            subscription: {
              id: stripeSubscription.id,
              plan: planName,
              status: stripeSubscription.status,
              current_period_start: new Date(stripeSubscription.current_period_start * 1000),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000),
              cancel_at_period_end: stripeSubscription.cancel_at_period_end,
              trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
              planDetails: PLAN_DETAILS[planName],
              discount: discountInfo,
              usage: {
                conversations: parseInt(usage.conversations) || 0,
                emailResponses: parseInt(usage.email_responses) || 0,
                smsMessages: parseInt(usage.sms_messages) || 0,
                maxConversations: PLAN_DETAILS[planName].features.conversations,
                maxEmailResponses: PLAN_DETAILS[planName].features.emailResponses,
                maxSmsMessages: PLAN_DETAILS[planName].features.smsMessages
              }
            },
            plans: PLAN_DETAILS
          });
          
        } catch (stripeError) {
          console.error('Stripe error:', stripeError);
          // Fall back to database data if Stripe fails
        }
      }
      
      // Return default subscription data (guard against legacy plan values)
      const safePlan = PLAN_DETAILS[customer.plan] ? customer.plan : 'starter';
      const planDetails = PLAN_DETAILS[safePlan];
      return NextResponse.json({
        success: true,
        subscription: {
          plan: safePlan,
          status: 'trialing',
          planDetails,
          usage: {
            conversations: 0,
            emailResponses: 0,
            smsMessages: 0,
            maxConversations: planDetails.features.conversations,
            maxEmailResponses: planDetails.features.emailResponses,
            maxSmsMessages: planDetails.features.smsMessages
          }
        },
        plans: PLAN_DETAILS
      });
      
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Error getting subscription:', error);
    // Return default data on any error
    return NextResponse.json({ 
      subscription: {
        plan: 'starter',
        status: 'trialing',
        trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        planDetails: PLAN_DETAILS.starter,
        usage: {
          conversations: 0,
          emailResponses: 0,
          smsMessages: 0,
          maxConversations: 500,
          maxEmailResponses: 1000,
          maxSmsMessages: 200
        }
      },
      plans: PLAN_DETAILS
    });
  }
}

// Handle subscription changes (upgrade, downgrade, apply discount)
export async function POST(request) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, plan, discountCode } = await request.json();
    
    console.log('🔵 Subscription POST action:', action, 'Plan:', plan, 'Discount Code:', discountCode);
    
    // Initialize connections
    const { getDbClient, stripe } = await initializeConnections();
    
    // Get database client
    let client;
    try {
      client = await getDbClient().connect();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ 
        error: 'Database temporarily unavailable. Please try again.' 
      }, { status: 503 });
    }
    
    try {
      // Ensure pending_promo_code column exists
      try {
        await client.query(`
          ALTER TABLE customers 
          ADD COLUMN IF NOT EXISTS pending_promo_code VARCHAR(255)
        `);
        console.log('✅ Ensured pending_promo_code column exists');
      } catch (alterError) {
        console.log('⚠️ Could not add pending_promo_code column (might already exist):', alterError.message);
      }
      
      // Get customer
      const customerQuery = 'SELECT * FROM customers WHERE clerk_user_id = $1';
      const customerResult = await client.query(customerQuery, [user.id]);
      
      if (customerResult.rows.length === 0) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      
      const customer = customerResult.rows[0];
      
      // Handle discount code application
      if (action === 'apply_discount') {
        if (!discountCode) {
          return NextResponse.json({ error: 'Discount code required' }, { status: 400 });
        }
        
        console.log('🔍 Searching for promotion code:', discountCode);
        
        try {
          // Try exact match first
          let promotionCodes = await stripe.promotionCodes.list({
            code: discountCode,
            active: true,
            limit: 1
          });
          
          console.log('📋 Exact match result:', promotionCodes.data.length, 'codes found');
          
          // If no exact match, try case-insensitive search
          if (promotionCodes.data.length === 0) {
            console.log('🔄 Trying case-insensitive search...');
            
            const allPromoCodes = await stripe.promotionCodes.list({
              active: true,
              limit: 100
            });
            
            console.log('📊 Total active promo codes in Stripe:', allPromoCodes.data.length);
            
            const matchedCode = allPromoCodes.data.find(
              pc => pc.code.toUpperCase() === discountCode.toUpperCase()
            );
            
            if (matchedCode) {
              promotionCodes = { data: [matchedCode] };
              console.log('✅ Found code with case-insensitive match:', matchedCode.code);
            } else {
              console.log('❌ No matching code found');
              
              return NextResponse.json({ 
                error: 'Invalid or expired discount code',
                details: `Code "${discountCode}" not found.`
              }, { status: 400 });
            }
          }
          
          const promoCode = promotionCodes.data[0];
          console.log('✅ Valid promo code found:', promoCode.id);
          
          // If customer has active subscription, apply discount immediately
          if (customer.stripe_subscription_id) {
            console.log('📝 Applying discount to existing subscription');
            
            const subscription = await stripe.subscriptions.update(
              customer.stripe_subscription_id,
              {
                promotion_code: promoCode.id
              }
            );
            
            console.log('✅ Discount applied successfully');
            
            return NextResponse.json({ 
              success: true,
              message: `Discount "${promoCode.coupon.name || promoCode.code}" applied successfully!`,
              discount: {
                code: promoCode.code,
                percentOff: promoCode.coupon.percent_off,
                amountOff: promoCode.coupon.amount_off
              }
            });
          } else {
            // No active subscription - store for future checkout
            console.log('💾 Storing promo code for future subscription');
            
            await client.query(
              'UPDATE customers SET pending_promo_code = $1 WHERE id = $2',
              [promoCode.id, customer.id]
            );
            
            console.log('✅ Promo code stored successfully');
            
            return NextResponse.json({ 
              success: true,
              message: 'Discount code validated! It will be applied when you subscribe.',
              discount: {
                code: promoCode.code,
                percentOff: promoCode.coupon.percent_off,
                amountOff: promoCode.coupon.amount_off
              }
            });
          }
        } catch (stripeError) {
          console.error('❌ Stripe discount error:', stripeError);
          return NextResponse.json({ 
            error: 'Invalid or expired discount code',
            details: stripeError.message
          }, { status: 400 });
        }
      }
      
      // Handle plan changes
      if (action === 'upgrade' || action === 'downgrade') {
        console.log('🔄 Processing plan change:', action, 'to plan:', plan);
        
        const priceId = STRIPE_PRICE_IDS[plan];
        
        if (!priceId) {
          console.error('❌ Invalid plan:', plan);
          return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }
        
        console.log('✅ Plan price ID:', priceId);
        
        // Create or get Stripe customer - FIX FOR TEST/LIVE MODE SWITCHING
        let stripeCustomerId = customer.stripe_customer_id;
        
        // Check if the customer ID exists in Stripe (validates it's in the right mode)
        if (stripeCustomerId) {
          try {
            console.log('🔍 Verifying existing Stripe customer:', stripeCustomerId);
            await stripe.customers.retrieve(stripeCustomerId);
            console.log('✅ Stripe customer verified');
          } catch (retrieveError) {
            // Customer doesn't exist in this mode (test vs live)
            console.log('⚠️ Stripe customer not found (likely switching from test to live mode)');
            console.log('🔄 Will create new customer for LIVE mode');
            stripeCustomerId = null; // Force creation of new customer
          }
        }
        
        if (!stripeCustomerId) {
          console.log('📝 Creating new Stripe customer');
          
          try {
            const stripeCustomer = await stripe.customers.create({
              email: customer.email,
              metadata: {
                clerkUserId: user.id,
                customerId: customer.id.toString()
              }
            });
            
            stripeCustomerId = stripeCustomer.id;
            console.log('✅ Stripe customer created:', stripeCustomerId);
            
            // Update database with new Stripe customer ID
            await client.query(
              'UPDATE customers SET stripe_customer_id = $1 WHERE id = $2',
              [stripeCustomerId, customer.id]
            );
            console.log('✅ Database updated with new Stripe customer ID');
          } catch (createError) {
            console.error('❌ Error creating Stripe customer:', createError);
            return NextResponse.json({ 
              error: 'Failed to create customer in Stripe',
              details: createError.message
            }, { status: 500 });
          }
        }
        
        console.log('✅ Using Stripe customer ID:', stripeCustomerId);
        
        // Check if customer has active subscription
        if (customer.stripe_subscription_id) {
          // Try to update existing subscription
          console.log('🔄 Attempting to update existing subscription:', customer.stripe_subscription_id);
          
          try {
            const subscription = await stripe.subscriptions.retrieve(customer.stripe_subscription_id);
            
            await stripe.subscriptions.update(customer.stripe_subscription_id, {
              items: [{
                id: subscription.items.data[0].id,
                price: priceId
              }],
              proration_behavior: 'always_invoice'
            });
            
            await client.query(
              'UPDATE customers SET plan = $1, updated_at = NOW() WHERE id = $2',
              [plan, customer.id]
            );
            
            console.log('✅ Subscription updated successfully');
            
            return NextResponse.json({ 
              success: true,
              message: `Successfully ${action}d to ${plan} plan!`
            });
            
          } catch (stripeError) {
            // Subscription doesn't exist in this mode - create new checkout instead
            console.log('⚠️ Could not update subscription (likely test mode subscription). Creating new checkout...');
            // Clear the invalid subscription ID
            await client.query(
              'UPDATE customers SET stripe_subscription_id = NULL WHERE id = $1',
              [customer.id]
            );
            // Continue to create new checkout session below
          }
        }
        
        // Create checkout session for new subscription
        console.log('🛒 Creating checkout session for new subscription');
        
        try {
          // Build checkout session config
          const sessionConfig = {
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [{
              price: priceId,
              quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings?success=true&plan=${plan}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings?canceled=true`,
            metadata: {
              clerkUserId: user.id,
              customerId: customer.id.toString(),
              plan: plan
            },
            subscription_data: {
              trial_period_days: 14,
              metadata: {
                clerkUserId: user.id,
                customerId: customer.id.toString()
              }
            }
          };
          
          // Only add discount if pending promo code exists
          if (customer.pending_promo_code) {
            console.log('🎁 Adding pending promo code to checkout:', customer.pending_promo_code);
            sessionConfig.discounts = [{
              promotion_code: customer.pending_promo_code
            }];
          }
          
          const checkoutSession = await stripe.checkout.sessions.create(sessionConfig);
          
          console.log('✅ Checkout session created:', checkoutSession.id);
          console.log('🔗 Redirect URL:', checkoutSession.url);
          
          return NextResponse.json({ 
            success: true,
            redirectUrl: checkoutSession.url 
          });
        } catch (checkoutError) {
          console.error('❌ Error creating checkout session:', checkoutError);
          console.error('Error details:', checkoutError.message);
          console.error('Error type:', checkoutError.type);
          
          return NextResponse.json({ 
            error: 'Failed to create checkout session',
            details: checkoutError.message
          }, { status: 500 });
        }
      }
      
      // Handle subscription cancellation
      if (action === 'cancel') {
        if (!customer.stripe_subscription_id) {
          return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
        }
        
        await stripe.subscriptions.update(customer.stripe_subscription_id, {
          cancel_at_period_end: true
        });
        
        return NextResponse.json({ 
          success: true,
          message: 'Subscription will be canceled at the end of the billing period'
        });
      }
      
      return NextResponse.json({ 
        error: 'Invalid action' 
      }, { status: 400 });
      
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('❌ Fatal error in subscription route:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: 'Failed to update subscription', 
      details: error.message 
    }, { status: 500 });
  }
}
