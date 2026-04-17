import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/me — restore session from cookie
export async function GET() {
  try {
    const cookieStore = cookies();
    const uid = cookieStore.get("fightclub_uid")?.value;

    if (!uid) {
      return NextResponse.json({ user: null });
    }

    await dbConnect();
    const user = await User.findById(uid).select("-passwordHash").lean();

    if (!user) {
      const res = NextResponse.json({ user: null });
      res.cookies.set("fightclub_uid", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return res;
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("Auth/me error:", err);
    return NextResponse.json({ user: null });
  }
}
