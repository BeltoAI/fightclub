import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/cleanup — remove legacy users without passwords
// and re-clamp all user positions to the 10x10 grid
export async function GET(req) {
  try {
    await dbConnect();

    // Delete legacy users that have no passwordHash
    const deleted = await User.deleteMany({
      $or: [
        { passwordHash: { $exists: false } },
        { passwordHash: null },
        { passwordHash: "" },
      ],
    });

    // Re-clamp all remaining users to 10x10 grid
    const users = await User.find({});
    let clamped = 0;
    for (const u of users) {
      const newX = Math.max(0, Math.min(9, u.x));
      const newY = Math.max(0, Math.min(9, u.y));
      if (newX !== u.x || newY !== u.y) {
        u.x = newX;
        u.y = newY;
        await u.save();
        clamped++;
      }
    }

    return NextResponse.json({
      success: true,
      legacyUsersDeleted: deleted.deletedCount,
      positionsClamped: clamped,
      remainingUsers: await User.countDocuments(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
