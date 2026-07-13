import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ──────────────────────────────────────────────
// Lemon Squeezy Webhook Handler
// ──────────────────────────────────────────────
// Register this URL in your Lemon Squeezy dashboard:
//   https://your-domain.com/api/webhooks/lemonsqueezy
//
// Events to subscribe to:
//   - subscription_created
//   - subscription_updated  
//   - subscription_cancelled
//   - subscription_expired
// ──────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Map Lemon Squeezy variant IDs to your subscription tier names
const VARIANT_TIER_MAP: Record<string, string> = {
  [process.env.NEXT_PUBLIC_LS_VARIANT_MONTHLY || 'MONTHLY']: 'Monthly',
  [process.env.NEXT_PUBLIC_LS_VARIANT_QUARTERLY || 'QUARTERLY']: 'Quarterly',
  [process.env.NEXT_PUBLIC_LS_VARIANT_YEARLY || 'YEARLY']: 'Yearly',
};

/**
 * Verify the webhook signature from Lemon Squeezy using HMAC-SHA256.
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('❌ LEMONSQUEEZY_WEBHOOK_SECRET is not set');
    return false;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read and verify the webhook signature
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature') || '';

    if (!verifySignature(rawBody, signature)) {
      console.error('❌ Lemon Squeezy webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload.meta?.event_name;
    const customData = payload.meta?.custom_data;
    const orgId: string | undefined = customData?.org_id;

    console.log(`🍋 Lemon Squeezy event: ${eventName} for org: ${orgId || 'unknown'}`);

    if (!orgId) {
      console.error('❌ Missing org_id in custom_data');
      return NextResponse.json({ error: 'Missing org_id' }, { status: 400 });
    }

    // 2. Initialize Supabase with service role (bypasses RLS)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('❌ Missing Supabase credentials for webhook processing');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 3. Handle subscription events
    const subscriptionData = payload.data?.attributes;
    const variantId = String(subscriptionData?.variant_id || '');
    const tier = VARIANT_TIER_MAP[variantId] || 'Free';

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated': {
        // Calculate trial end (if applicable)
        const trialEndsAt = subscriptionData?.trial_ends_at || null;
        const renewsAt = subscriptionData?.renews_at || null;

        const { error } = await supabase
          .from('organizations')
          .update({
            subscription_tier: tier,
            trial_ends_at: trialEndsAt || renewsAt,
          })
          .eq('id', orgId);

        if (error) {
          console.error(`❌ Failed to update org ${orgId}:`, error);
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
        }

        console.log(`✅ Org ${orgId} upgraded to tier: ${tier}`);
        break;
      }

      case 'subscription_cancelled':
      case 'subscription_expired': {
        const { error } = await supabase
          .from('organizations')
          .update({
            subscription_tier: 'Free',
            trial_ends_at: null,
          })
          .eq('id', orgId);

        if (error) {
          console.error(`❌ Failed to downgrade org ${orgId}:`, error);
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
        }

        console.log(`⚠️ Org ${orgId} downgraded to Free (subscription ${eventName})`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled Lemon Squeezy event: ${eventName}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('❌ Lemon Squeezy webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
