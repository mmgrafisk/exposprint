import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "SETUP_CLOSED" }, { status: 410 });
}
