import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import DramaLog from "@/models/DramaLog";

// GET /api/drama/user?userId=xxx — fetch drama logs involving a specific user
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query param is required" },
        { status: 400 }
      );
    }

    const logs = await DramaLog.find({
      $or: [{ attackerId: userId }, { defenderId: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
