import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  const settings = getSettings();
  return NextResponse.json({
    mimoApiKey: settings.mimoApiKey ? "sk-****" + settings.mimoApiKey.slice(-6) : "",
    configured: !!settings.mimoApiKey,
  });
}

export async function POST(request: NextRequest) {
  const { mimoApiKey } = await request.json();
  const settings = getSettings();
  settings.mimoApiKey = mimoApiKey;
  saveSettings(settings);
  return NextResponse.json({ ok: true });
}
