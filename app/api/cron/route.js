import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/cron — move offline avatars randomly (called by Vercel Cron)
export async function GET(req) {
  try {
    // Simple auth: check for cron secret or Vercel's cron header
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-vercel-cron");

    // Allow Vercel cron or a secret key
    if (!cronHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In dev, allow unauthenticated
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await dbConnect();

    // Find all offline users
    const offlineUsers = await User.find({ isOnline: false });

    if (offlineUsers.length === 0) {
      return NextResponse.json({ moved: 0 });
    }

    let moved = 0;

    for (const user of offlineUsers) {
      // 60% chance to move each tick (so they don't all move every time)
      if (Math.random() > 0.6) continue;

      // Random direction: up, down, left, right, or diagonal
      const dx = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      const dy = Math.floor(Math.random() * 3) - 1;

      if (dx === 0 && dy === 0) continue;

      const newX = Math.max(0, Math.min(9, user.x + dx));
      const newY = Math.max(0, Math.min(9, user.y + dy));

      if (newX !== user.x || newY !== user.y) {
        user.x = newX;
        user.y = newY;
        await user.save();
        moved++;
      }
    }

    return NextResponse.json({ moved, total: offlineUsers.length });
  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
