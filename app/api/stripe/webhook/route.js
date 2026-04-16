import { NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// Disable Next.js body parsing — Stripe needs the raw body for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await dbConnect();

  try {
    switch (event.type) {
      // ── Checkout completed — activate subscription ──────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan || "monthly";

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );

          await User.findByIdAndUpdate(userId, {
            stripeCustomerId: session.customer,
            subscriptionId: subscription.id,
            subscriptionStatus: "active",
            subscriptionPlan: plan,
            subscriptionExpiresAt: new Date(
              subscription.current_period_end * 1000
            ),
          });
        }
        break;
      }

      // ── Subscription updated (renewal, plan change) ─────────
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const user = await User.findOne({
          stripeCustomerId: subscription.customer,
        });

        if (user) {
          user.subscriptionStatus = subscription.status === "active" ? "active" : subscription.status;
          user.subscriptionExpiresAt = new Date(
            subscription.current_period_end * 1000
          );
          await user.save();
        }
        break;
      }

      // ── Subscription canceled or expired ────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const user = await User.findOne({
          stripeCustomerId: subscription.customer,
        });

        if (user) {
          user.subscriptionStatus = "canceled";
          user.subscriptionId = null;
          user.subscriptionPlan = "none";
          await user.save();
        }
        break;
      }

      // ── Payment failed ──────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const user = await User.findOne({
          stripeCustomerId: invoice.customer,
        });

        if (user) {
          user.subscriptionStatus = "past_due";
          await user.save();
        }
        break;
      }

      default:
        // Unhandled event type — that's fine
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
