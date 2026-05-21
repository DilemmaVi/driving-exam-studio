import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import packageJson from "../../../../package.json";

export async function GET() {
  let content = "";
  const candidates = [
    path.join(process.cwd(), "CHANGELOG.md"),
    path.join(process.cwd(), "resources", "CHANGELOG.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      content = fs.readFileSync(p, "utf-8");
      break;
    }
  }

  if (!content) {
    return NextResponse.json({ versions: [], currentVersion: packageJson.version });
  }

  const versions: { version: string; date: string; changes: string[] }[] = [];
  const sections = content.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const header = lines[0];
    const match = header.match(/v?([\d.]+)\s*\((\d{4}-\d{2}-\d{2})\)/);
    if (!match) continue;
    const changes = lines
      .slice(1)
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean);
    versions.push({ version: match[1], date: match[2], changes });
  }

  return NextResponse.json({ versions, currentVersion: packageJson.version });
}
