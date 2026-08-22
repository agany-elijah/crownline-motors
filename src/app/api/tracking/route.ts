import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Tracking API placeholder" });
}
