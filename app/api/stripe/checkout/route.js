import { NextResponse } from "next/server";
import getStripe, { PRICE_IDS } from "@/lib/stripe";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// Force Node.js runtime (not Edge) — required for Stripe SDK connectivity on Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/stripe/checkout — create a Stripe Checkout session
export async function POST(req) {
  try {
    await dbConnect();
    const { userId, plan } = await req.json();

    if (!userId || !["monthly", "annual"].includes(plan)) {
      return NextResponse.json(
        { error: "userId and plan ('monthly' | 'annual') are required" },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();

    // Reuse existing Stripe customer or create a new one
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          userId: user._id.toString(),
          username: user.username,
        },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Derive the app URL from the request origin — more reliable than env vars on Vercel
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || process.env.NEXT_PUBLIC_APP_URL || "https://idle-fight-club.vercel.app";
    const appUrl = origin.replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      metadata: {
        userId: user._id.toString(),
        plan,
      },
      success_url: `${appUrl}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}?subscription=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err?.type, err?.code, err?.message);
    const msg = err?.raw?.message || err?.message || "Unknown Stripe error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
