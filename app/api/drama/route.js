import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import DramaLog from "@/models/DramaLog";
import User from "@/models/User";

// GET /api/drama — fetch latest drama logs (global feed)
export async function GET() {
  try {
    await dbConnect();
    const logs = await DramaLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/drama — save a new drama log after an AI encounter
export async function POST(req) {
  try {
    await dbConnect();
    const { attackerId, attackerName, defenderId, defenderName, transcript, floor } =
      await req.json();

    if (!attackerId || !defenderId || !transcript) {
      return NextResponse.json(
        { error: "attackerId, defenderId, and transcript are required" },
        { status: 400 }
      );
    }

    const log = await DramaLog.create({
      attackerId,
      attackerName,
      defenderId,
      defenderName,
      transcript,
      floor,
    });

    // Increment attacker wins + defender losses
    await Promise.all([
      User.findByIdAndUpdate(attackerId, { $inc: { wins: 1 } }),
      User.findByIdAndUpdate(defenderId, { $inc: { losses: 1 } }),
    ]);

    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
