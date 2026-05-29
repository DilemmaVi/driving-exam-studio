import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import http from "http";
const MIME_TYPES: Record<string, string> = {
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
  ".mp4": "video/mp4", ".webm": "video/webm",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".json": "application/json", ".js": "application/javascript",
  ".css": "text/css", ".html": "text/html", ".txt": "text/plain",
};
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
import { execSync } from "child_process";

const args = process.argv.slice(2);
const propsFile = args[0];
const outputPath = args[1];

if (!propsFile || !outputPath) {
  console.error("Usage: render-video.ts <props.json> <output.mp4>");
  process.exit(1);
}

const PROJECT_ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const PUBLIC_AUDIO_DIR = process.env.AUDIO_DIR || path.join(PUBLIC_DIR, "audio");

function createAudioServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url || "/";
      let filePath: string;

      if (urlPath.startsWith("/audio")) {
        const audioPath = urlPath.replace(/^\/audio/, "") || "";
        filePath = path.join(PUBLIC_AUDIO_DIR, audioPath === "/" ? "" : audioPath);
      } else if (urlPath.startsWith("/api/uploads/")) {
        const filename = urlPath.replace(/^\/api\/uploads\//, "");
        filePath = path.join(PUBLIC_DIR, "uploads", filename);
      } else {
        filePath = path.join(PUBLIC_DIR, urlPath);
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.setHeader("Content-Type", getMimeType(filePath));
        res.setHeader("Access-Control-Allow-Origin", "*");
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} in use, trying ${port + 1}`);
        server.listen(port + 1, "127.0.0.1", () => resolve(server));
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const audioServer = await createAudioServer(3033);
  const actualPort = (audioServer.address() as { port: number }).port;
  const AUDIO_SERVER_URL = `http://127.0.0.1:${actualPort}`;

  const inputRaw = JSON.parse(fs.readFileSync(propsFile, "utf-8"));

  try {
    if (inputRaw.batch) {
      await runBatch(inputRaw, AUDIO_SERVER_URL);
    } else {
      await runSingle(inputRaw, AUDIO_SERVER_URL);
    }
  } finally {
    audioServer.close();
  }
}

async function runBatch(input: { items: Array<{ props: Record<string, unknown>; outputPath: string }> }, AUDIO_SERVER_URL: string) {
  const totalItems = input.items.length;

  console.log(JSON.stringify({ type: "status", phase: "bundling", message: "正在打包 Remotion 项目..." }));

  const entryPoint = path.join(__dirname, "..", "src", "remotion", "index.ts");
  const bundleLocation = await bundle({
    entryPoint,
    enableCaching: true,
    onProgress: (progress: number) => {
      console.log(JSON.stringify({ type: "progress", phase: "bundling", progress: Math.min(100, Math.round(progress)) }));
    },
  });

  for (let i = 0; i < totalItems; i++) {
      const item = input.items[i];
      console.log(JSON.stringify({ type: "status", phase: "rendering", message: `渲染第 ${i + 1}/${totalItems} 题...`, currentItem: i + 1, totalItems }));

      function resolveUrl(url?: string): string | undefined {
        if (!url) return undefined;
        if (url.startsWith("http")) return url;
        return `${AUDIO_SERVER_URL}${url}`;
      }

      const propsWithAudioUrl = {
        ...item.props,
        audioServerUrl: AUDIO_SERVER_URL,
        watermarkLogoUrl: resolveUrl(item.props.watermarkLogoUrl as string | undefined),
        introLogo: resolveUrl(item.props.introLogo as string | undefined),
        entries: (item.props.entries as Array<{ question: { id: number; coverImage?: string } }>).map((entry) => ({
          ...entry,
          audioServerUrl: AUDIO_SERVER_URL,
          question: {
            ...entry.question,
            coverImage: resolveUrl(entry.question.coverImage),
          },
        })),
      };

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "DynamicExam",
        inputProps: propsWithAudioUrl,
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: item.outputPath,
        inputProps: propsWithAudioUrl,
        timeoutInMilliseconds: 120000,
        onProgress: ({ progress, renderedFrames }: {
          progress: number;
          renderedFrames: number;
          renderedDoneIn: number | null;
          encodedDoneIn: number | null;
        }) => {
          console.log(JSON.stringify({
            type: "progress",
            phase: "rendering",
            progress: Math.round(progress * 100),
            renderedFrames,
            totalFrames: composition.durationInFrames,
            currentItem: i + 1,
            totalItems,
          }));
        },
      });

      // HD post-processing per item
      const stat = fs.statSync(item.outputPath);
      const hdEnabled = item.props.hdExport !== false;
      if (hdEnabled) {
        console.log(JSON.stringify({ type: "status", phase: "hd", message: `高清化处理第 ${i + 1}/${totalItems} 题...`, currentItem: i + 1, totalItems }));
        const tempPath = item.outputPath.replace(/\.mp4$/, "_raw.mp4");
        fs.renameSync(item.outputPath, tempPath);
        try {
          const bitrate = Math.max(8000, Math.round(stat.size / 1024 * 8 / (composition.durationInFrames / composition.fps) * 1.2 / 1000));
          const passLogFile = item.outputPath.replace(/\.mp4$/, "_passlog");
          execSync(`ffmpeg -y -i "${tempPath}" -c:v libx264 -b:v ${bitrate}k -pass 1 -an -f null /dev/null -passlogfileprefix "${passLogFile}"`, { stdio: "ignore" });
          execSync(`ffmpeg -y -i "${tempPath}" -c:v libx264 -b:v ${bitrate}k -pass 2 -c:a aac -b:a 192k -vf "unsharp=5:5:0.5:5:5:0.5" "${item.outputPath}" -passlogfileprefix "${passLogFile}"`, { stdio: "ignore" });
          fs.unlinkSync(tempPath);
          try { fs.unlinkSync(`${passLogFile}-0.log`); } catch {}
          try { fs.unlinkSync(`${passLogFile}-0.log.mbtree`); } catch {}
        } catch {
          if (!fs.existsSync(item.outputPath) && fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, item.outputPath);
          }
        }
      }
    }
  console.log(JSON.stringify({ type: "batch_done", totalItems }));
}

async function runSingle(inputProps: Record<string, unknown>, AUDIO_SERVER_URL: string) {
  console.log(JSON.stringify({ type: "status", phase: "bundling", message: "正在打包 Remotion 项目..." }));

  const entryPoint = path.join(__dirname, "..", "src", "remotion", "index.ts");

  const bundleLocation = await bundle({
    entryPoint,
    enableCaching: true,
    onProgress: (progress: number) => {
      console.log(JSON.stringify({ type: "progress", phase: "bundling", progress: Math.min(100, Math.round(progress)) }));
    },
  });

  console.log(JSON.stringify({ type: "status", phase: "composition", message: "正在解析视频参数..." }));

  // Resolve relative URLs to the local file server
  function resolveUrl(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `${AUDIO_SERVER_URL}${url}`;
  }

  // Inject audio server URL into each entry's audio base
  const propsWithAudioUrl = {
    ...inputProps,
    audioServerUrl: AUDIO_SERVER_URL,
    watermarkLogoUrl: resolveUrl(inputProps.watermarkLogoUrl as string | undefined),
    introLogo: resolveUrl(inputProps.introLogo as string | undefined),
    entries: (inputProps.entries as Array<{ question: { id: number; coverImage?: string } }>).map((entry) => ({
      ...entry,
      audioServerUrl: AUDIO_SERVER_URL,
      question: {
        ...entry.question,
        coverImage: resolveUrl(entry.question.coverImage),
      },
    })),
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "DynamicExam",
    inputProps: propsWithAudioUrl,
  });

  console.log(JSON.stringify({
    type: "info",
    totalFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    durationSec: Math.round(composition.durationInFrames / composition.fps),
  }));

  console.log(JSON.stringify({ type: "status", phase: "rendering", message: "正在渲染视频..." }));

  await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: propsWithAudioUrl,
      timeoutInMilliseconds: 120000,
      onProgress: ({ progress, renderedFrames, renderedDoneIn, encodedDoneIn }: {
        progress: number;
        renderedFrames: number;
        renderedDoneIn: number | null;
        encodedDoneIn: number | null;
      }) => {
        console.log(JSON.stringify({
          type: "progress",
          phase: "rendering",
          progress: Math.round(progress * 100),
          renderedFrames,
          totalFrames: composition.durationInFrames,
          renderedDoneIn,
          encodedDoneIn,
        }));
      },
    });

  const stat = fs.statSync(outputPath);

  // HD post-processing: 2-pass encoding + sharpening
  const hdEnabled = inputProps.hdExport !== false;
  if (hdEnabled) {
    console.log(JSON.stringify({ type: "status", phase: "hd", message: "高清化处理中..." }));
    const tempPath = outputPath.replace(/\.mp4$/, "_raw.mp4");
    fs.renameSync(outputPath, tempPath);
    try {
      const bitrate = Math.max(8000, Math.round(stat.size / 1024 * 8 / (composition.durationInFrames / composition.fps) * 1.2 / 1000));
      const passLogFile = outputPath.replace(/\.mp4$/, "_passlog");
      execSync(
        `ffmpeg -y -i "${tempPath}" -c:v libx264 -b:v ${bitrate}k -pass 1 -an -f null /dev/null -passlogfileprefix "${passLogFile}"`,
        { stdio: "ignore" }
      );
      execSync(
        `ffmpeg -y -i "${tempPath}" -c:v libx264 -b:v ${bitrate}k -pass 2 -c:a aac -b:a 192k -vf "unsharp=5:5:0.5:5:5:0.5" "${outputPath}" -passlogfileprefix "${passLogFile}"`,
        { stdio: "ignore" }
      );
      fs.unlinkSync(tempPath);
      try { fs.unlinkSync(`${passLogFile}-0.log`); } catch {}
      try { fs.unlinkSync(`${passLogFile}-0.log.mbtree`); } catch {}
    } catch (e) {
      if (!fs.existsSync(outputPath) && fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, outputPath);
      }
      console.log(JSON.stringify({ type: "status", phase: "hd", message: "高清化失败，使用原始输出" }));
    }
  }

  const finalStat = fs.statSync(outputPath);
  console.log(JSON.stringify({
    type: "done",
    outputPath,
    fileSizeMB: (finalStat.size / 1024 / 1024).toFixed(1),
  }));
}

main().catch((e) => {
  console.log(JSON.stringify({ type: "error", message: String(e) }));
  process.exit(1);
});
