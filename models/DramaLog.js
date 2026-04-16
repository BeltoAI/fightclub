import mongoose from "mongoose";

const DramaLogSchema = new mongoose.Schema(
  {
    attackerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attackerName: { type: String, required: true },
    defenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    defenderName: { type: String, required: true },
    transcript: { type: String, required: true, maxlength: 4000 },
    floor: { type: Number },
  },
  { timestamps: true }
);

// Index for quick lookups: "show me my drama"
DramaLogSchema.index({ defenderId: 1, createdAt: -1 });
DramaLogSchema.index({ attackerId: 1, createdAt: -1 });

export default mongoose.models.DramaLog ||
  mongoose.model("DramaLog", DramaLogSchema);
