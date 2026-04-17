import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// PATCH /api/users/move — update a user's x/y position
export async function PATCH(req) {
  try {
    await dbConnect();
    const { userId, x, y } = await req.json();

    if (!userId || x === undefined || y === undefined) {
      return NextResponse.json(
        { error: "userId, x, and y are required" },
        { status: 400 }
      );
    }

    // Clamp to grid bounds (10x10)
    const clampedX = Math.max(0, Math.min(9, x));
    const clampedY = Math.max(0, Math.min(9, y));

    const user = await User.findByIdAndUpdate(
      userId,
      { x: clampedX, y: clampedY },
      { new: true }
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
