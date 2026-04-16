import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

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
    const user = await User.findById(uid).lean();

    if (!user) {
      // Cookie points to deleted user — clear it
      const res = NextResponse.json({ user: null });
      res.cookies.delete("fightclub_uid");
      return res;
    }

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ user: null });
  }
}
