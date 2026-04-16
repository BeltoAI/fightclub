import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// GET  /api/users  — fetch all users (the grid state)
export async function GET() {
  try {
    await dbConnect();
    const users = await User.find({}).lean();
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/users — register / login a user
export async function POST(req) {
  try {
    await dbConnect();
    const { username, floor, emoji } = await req.json();

    if (!username || !floor) {
      return NextResponse.json(
        { error: "username and floor are required" },
        { status: 400 }
      );
    }

    // Try to find existing user first (login)
    let user = await User.findOne({ username });

    if (user) {
      // Returning user — mark online, update floor if changed
      user.isOnline = true;
      user.floor = floor;
      if (emoji) user.emoji = emoji;
      await user.save();
    } else {
      // New user — random spawn position within a 20x20 grid
      const x = Math.floor(Math.random() * 20);
      const y = Math.floor(Math.random() * 20);
      user = await User.create({
        username,
        floor,
        x,
        y,
        emoji: emoji || "😤",
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key — race condition on create
      const user = await User.findOne({ username: err.keyValue?.username });
      if (user) {
        user.isOnline = true;
        await user.save();
        return NextResponse.json(user, { status: 200 });
      }
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
