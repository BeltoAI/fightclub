import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { cookies } from "next/headers";

// POST /api/auth/logout — mark user offline + clear cookie
export async function POST() {
  try {
    const cookieStore = cookies();
    const uid = cookieStore.get("fightclub_uid")?.value;

    if (uid) {
      await dbConnect();
      await User.findByIdAndUpdate(uid, { isOnline: false });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.delete("fightclub_uid");
    return res;
  } catch (err) {
    const res = NextResponse.json({ success: true });
    res.cookies.delete("fightclub_uid");
    return res;
  }
}
