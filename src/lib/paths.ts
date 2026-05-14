import path from "path";
import fs from "fs";

export function getAudioDir(): string {
  const dir = process.env.AUDIO_DIR || path.join(process.cwd(), "public", "audio");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getOutputDir(): string {
  const dir = process.env.OUTPUT_DIR || path.join(process.cwd(), "output");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
