import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const statusFile = process.env.UPDATE_STATUS_FILE;
  if (!statusFile || !fs.existsSync(statusFile)) {
    return NextResponse.json({ state: "unknown" });
  }

  if (action === "restart") {
    const restartFile = path.join(path.dirname(statusFile), "restart-requested");
    fs.writeFileSync(restartFile, Date.now().toString());
    return NextResponse.json({ ok: true });
  }

  try {
    const data = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ state: "unknown" });
  }
}
