import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  const settings = getSettings();
  return NextResponse.json({
    mimoApiKey: settings.mimoApiKey ? "sk-****" + settings.mimoApiKey.slice(-6) : "",
    configured: !!settings.mimoApiKey,
    watermarkEnabled: settings.watermarkEnabled || false,
    watermarkText: settings.watermarkText || "",
    watermarkPosition: settings.watermarkPosition || "bottom-right",
    watermarkOpacity: settings.watermarkOpacity ?? 30,
    watermarkFontSize: settings.watermarkFontSize ?? 36,
    watermarkLogoUrl: settings.watermarkLogoUrl || "",
    watermarkScale: settings.watermarkScale ?? 100,
    watermarkColor: settings.watermarkColor || "#ffffff",
    watermarkFont: settings.watermarkFont || "default",
    watermarkStroke: settings.watermarkStroke !== false,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const settings = getSettings();
  if (body.mimoApiKey !== undefined) {
    settings.mimoApiKey = body.mimoApiKey;
  }
  if (body.watermarkEnabled !== undefined) settings.watermarkEnabled = body.watermarkEnabled;
  if (body.watermarkText !== undefined) settings.watermarkText = body.watermarkText;
  if (body.watermarkPosition !== undefined) settings.watermarkPosition = body.watermarkPosition;
  if (body.watermarkOpacity !== undefined) settings.watermarkOpacity = body.watermarkOpacity;
  if (body.watermarkFontSize !== undefined) settings.watermarkFontSize = body.watermarkFontSize;
  if (body.watermarkLogoUrl !== undefined) settings.watermarkLogoUrl = body.watermarkLogoUrl;
  if (body.watermarkScale !== undefined) settings.watermarkScale = body.watermarkScale;
  if (body.watermarkColor !== undefined) settings.watermarkColor = body.watermarkColor;
  if (body.watermarkFont !== undefined) settings.watermarkFont = body.watermarkFont;
  if (body.watermarkStroke !== undefined) settings.watermarkStroke = body.watermarkStroke;
  saveSettings(settings);
  return NextResponse.json({ ok: true });
}
