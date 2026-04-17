import mongoose from "mongoose";

const AvatarSchema = new mongoose.Schema(
  {
    bodyColor: { type: String, default: "#4FC3F7" },
    hairStyle: { type: Number, default: 0, min: 0, max: 7 },
    hairColor: { type: String, default: "#222222" },
    eyeStyle: { type: Number, default: 0, min: 0, max: 5 },
    mouthStyle: { type: Number, default: 0, min: 0, max: 5 },
    outfitColor: { type: String, default: "#E91E63" },
    accessory: { type: Number, default: 0, min: 0, max: 6 },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 24,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    floor: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    isOnline: { type: Boolean, default: true },
    awayPrompt: {
      type: String,
      default: "I'm just a chill resident. Don't start nothing.",
      maxlength: 500,
    },
    avatar: {
      type: AvatarSchema,
      default: () => ({}),
    },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },

    // ── Stripe subscription fields ──
    stripeCustomerId: { type: String, default: null },
    subscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["none", "active", "past_due", "canceled", "trialing"],
      default: "none",
    },
    subscriptionPlan: {
      type: String,
      enum: ["none", "monthly", "annual"],
      default: "none",
    },
    subscriptionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevent model recompilation in dev hot-reload
export default mongoose.models.User || mongoose.model("User", UserSchema);
