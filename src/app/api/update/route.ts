import { NextResponse } from "next/server";
import fs from "fs";

export async function GET() {
  const statusFile = process.env.UPDATE_STATUS_FILE;
  if (!statusFile || !fs.existsSync(statusFile)) {
    return NextResponse.json({ state: "unknown" });
  }
  try {
    const data = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ state: "unknown" });
  }
}
