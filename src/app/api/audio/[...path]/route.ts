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
  const audioDir = getAudioDir();
  const filePath = path.join(audioDir, fileName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(audioDir))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

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
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => {
            try { controller.enqueue(chunk); } catch { stream.destroy(); }
          });
          stream.on("end", () => {
            try { controller.close(); } catch {}
          });
          stream.on("error", (err) => {
            try { controller.error(err); } catch {}
          });
        },
        cancel() { stream.destroy(); },
      });
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(chunkSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        try { controller.enqueue(chunk); } catch { stream.destroy(); }
      });
      stream.on("end", () => {
        try { controller.close(); } catch {}
      });
      stream.on("error", (err) => {
        try { controller.error(err); } catch {}
      });
    },
    cancel() { stream.destroy(); },
  });
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
