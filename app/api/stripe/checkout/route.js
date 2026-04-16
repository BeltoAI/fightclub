import { NextResponse } from "next/server";
import getStripe, { PRICE_IDS } from "@/lib/stripe";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
