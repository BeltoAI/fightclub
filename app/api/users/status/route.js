import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// PATCH /api/users/status — toggle online/offline + update away prompt
export async function PATCH(req) {
  try {
    await dbConnect();
    const { userId, isOnline, awayPrompt } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const update = {};
    if (isOnline !== undefined) update.isOnline = isOnline;
    if (awayPrompt !== undefined) update.awayPrompt = awayPrompt;

    const user = await User.findByIdAndUpdate(userId, update, {
      new: true,
    }).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
