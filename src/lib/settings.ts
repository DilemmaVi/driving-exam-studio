import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  mimoApiKey?: string;
  mimoBaseUrl?: string;
  mimoTtsModel?: string;
  watermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkPosition?: string;
  watermarkOpacity?: number;
  watermarkFontSize?: number;
  watermarkLogoUrl?: string;
  watermarkScale?: number;
  watermarkColor?: string;
  watermarkFont?: string;
  watermarkStroke?: boolean;
  watermarkLogoGrayscale?: boolean;
}

export function getSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

export function saveSettings(settings: Settings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export function getMimoApiKey(): string {
  const key = getSettings().mimoApiKey || process.env.MIMO_API_KEY || "";
  if (!key) throw new Error("请先在设置中配置 MIMO API Key");
  return key;
}

export function getMimoBaseUrl(): string {
  return getSettings().mimoBaseUrl || "https://api.xiaomimimo.com/v1";
}

export function getMimoTtsModel(): string {
  return getSettings().mimoTtsModel || "mimo-v2.5-tts";
}
