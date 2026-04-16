"use client";

import { useState } from "react";

export default function Paywall({ userId, onSubscribed }) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("annual"); // default to best deal
  const [error, setError] = useState("");

  async function handleCheckout() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: selectedPlan }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create checkout session");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-pink-500 text-lg mb-2 text-center">
        IDLE FIGHT CLUB
      </h1>
      <p className="text-cyan-400 text-xs mb-6 text-center">
        SUBSCRIPTION REQUIRED
      </p>

      <div className="bg-gray-900 border border-pink-800/50 rounded-lg p-6 w-full max-w-md space-y-5">
        <p className="text-gray-400 text-[10px] text-center leading-relaxed">
          Running AI locally in your browser costs us nothing in server fees —
          but the servers, database, and development still need fuel.
          Pick your plan and enter the complex.
        </p>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Monthly */}
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedPlan === "monthly"
                ? "border-cyan-400 bg-cyan-950/30"
                : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
            }`}
          >
            <div className="text-xs text-white mb-1">MONTHLY</div>
            <div className="text-cyan-400 text-lg">$1</div>
            <div className="text-[8px] text-gray-400">/month</div>
          </button>

          {/* Annual (13 months for $10) */}
          <button
            onClick={() => setSelectedPlan("annual")}
            className={`p-4 rounded-lg border-2 text-left transition-all relative overflow-hidden ${
              selectedPlan === "annual"
                ? "border-pink-400 bg-pink-950/30"
                : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
            }`}
          >
            <div className="absolute top-0 right-0 bg-pink-600 text-[7px] px-2 py-0.5 rounded-bl">
              BEST DEAL
            </div>
            <div className="text-xs text-white mb-1">ANNUAL</div>
            <div className="text-pink-400 text-lg">$10</div>
            <div className="text-[8px] text-gray-400">
              /13 months
            </div>
            <div className="text-[7px] text-green-400 mt-1">
              ~$0.77/mo — save 23%
            </div>
          </button>
        </div>

        {error && <p className="text-red-400 text-[9px] text-center">{error}</p>}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className={`w-full py-3 rounded text-xs font-bold transition-colors ${
            loading
              ? "bg-gray-700 text-gray-400 cursor-wait"
              : "bg-pink-600 hover:bg-pink-500 text-white"
          }`}
        >
          {loading ? "REDIRECTING TO CHECKOUT..." : "SUBSCRIBE & ENTER"}
        </button>

        <div className="text-center space-y-1">
          <p className="text-[8px] text-gray-500">
            Powered by Stripe. Cancel anytime.
          </p>
          <p className="text-[8px] text-gray-600">
            Your subscription unlocks the full game experience.
          </p>
        </div>
      </div>
    </div>
  );
}
