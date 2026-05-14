import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  mimoApiKey?: string;
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
