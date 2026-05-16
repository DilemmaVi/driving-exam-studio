import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getAudioDir } from "@/lib/paths";

// 44-byte silent WAV (0 samples, 16-bit mono 44100Hz)
const SILENT_WAV = Buffer.from(
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgACABAAZGF0YQAAAAA=",
  "base64"
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const fileName = segments.join("/");
  const filePath = path.join(getAudioDir(), fileName);

  if (!fs.existsSync(filePath)) {
    return new NextResponse(SILENT_WAV, {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-cache" },
    });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".jpg": "image/jpeg",
  };
  const contentType = mimeMap[ext] || "application/octet-stream";

  const range = request.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(chunk.length),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
