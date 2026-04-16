import Stripe from "stripe";

// Lazy-init: don't throw at import time (breaks Next.js build/collect phase).
// The key will always be present at runtime on Vercel once env vars are set.
let _stripe = null;

function getStripe() {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local or Vercel env vars."
    );
  }

  _stripe = new Stripe(key);
  return _stripe;
}

export default getStripe;

// ── Price config ─────────────────────────────────────────────────
// You'll create these Products + Prices in the Stripe Dashboard
// (or via the Stripe CLI) and paste the price IDs here.
//
//  Monthly: $1/month
//  Annual:  $10/13 months (effectively ~$0.77/mo — a deal)
//
// Replace with your actual Stripe Price IDs after creating them:
export const PRICE_IDS = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID || "price_monthly_REPLACE_ME",
  annual: process.env.STRIPE_ANNUAL_PRICE_ID || "price_annual_REPLACE_ME",
};
