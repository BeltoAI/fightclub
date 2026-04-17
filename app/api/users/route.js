import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// GET  /api/users  — fetch all users (the grid state)
// Returns users WITHOUT passwordHash for security
export async function GET() {
  try {
    await dbConnect();
    const users = await User.find({}).select("-passwordHash").lean();
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
