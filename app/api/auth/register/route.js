import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await dbConnect();
    const { username, password, floor, avatar } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }
    if (username.length < 2 || username.length > 24) {
      return NextResponse.json(
        { error: "Username must be 2-24 characters" },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    // Check if username is taken
    const existing = await User.findOne({ username });
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken. Try signing in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const x = Math.floor(Math.random() * 10);
    const y = Math.floor(Math.random() * 10);

    const user = await User.create({
      username,
      passwordHash,
      floor: floor || Math.ceil(Math.random() * 7),
      x,
      y,
      avatar: avatar || {},
    });

    // Return user without passwordHash
    const userObj = user.toObject();
    delete userObj.passwordHash;

    const res = NextResponse.json(userObj, { status: 201 });
    res.cookies.set("fightclub_uid", user._id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
