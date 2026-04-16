import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

export default stripe;

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
