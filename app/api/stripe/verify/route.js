import { NextResponse } from "next/server";
import getStripe from "@/lib/stripe";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/stripe/verify — verify a checkout session and activate subscription
// This is called when the user returns from Stripe Checkout with a session_id.
// It works as a fallback so we don't need to wait for the webhook.
export async function POST(req) {
  try {
    await dbConnect();
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: "sessionId and userId are required" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    const subscription = session.subscription;
    const plan = session.metadata?.plan || "monthly";

    // Update the user's subscription status in MongoDB
    const user = await User.findByIdAndUpdate(
      userId,
      {
        stripeCustomerId: session.customer,
        subscriptionId: typeof subscription === "string" ? subscription : subscription?.id,
        subscriptionStatus: "active",
        subscriptionPlan: plan,
        subscriptionExpiresAt: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : new Date(Date.now() + (plan === "annual" ? 13 * 30 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)),
      },
      { new: true }
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, subscriptionStatus: "active" });
  } catch (err) {
    console.error("Stripe verify error:", err?.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
