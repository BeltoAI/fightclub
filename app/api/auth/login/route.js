import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await dbConnect();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json(
        { error: "No account with that username. Sign up first." },
        { status: 404 }
      );
    }

    // Handle legacy users without passwords (migrated from old system)
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "This is a legacy account. Please sign up again with a password." },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }

    // Mark online
    user.isOnline = true;
    await user.save();

    const userObj = user.toObject();
    delete userObj.passwordHash;

    const res = NextResponse.json(userObj, { status: 200 });
    res.cookies.set("fightclub_uid", user._id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
