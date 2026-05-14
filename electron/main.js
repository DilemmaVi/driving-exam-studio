const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");

let mainWindow = null;
let serverProcess = null;
const PORT = 3456;

function getUserDataPath() {
  return app.getPath("userData");
}

function setupPaths() {
  const userData = getUserDataPath();
  const audioDir = path.join(userData, "audio");
  const outputDir = path.join(userData, "output");
  const dataDir = path.join(userData, "data");

  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Copy initial database if not exists
  const dbDest = path.join(dataDir, "exam.db");
  if (!fs.existsSync(dbDest)) {
    const dbSource = path.join(getResourcesPath(), "data", "exam.db");
    if (fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, dbDest);
    }
  }

  process.env.DB_PATH = dbDest;
  process.env.AUDIO_DIR = audioDir;
  process.env.OUTPUT_DIR = outputDir;
  process.env.PORT = String(PORT);
}

function getResourcesPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath);
  }
  return path.join(__dirname, "..");
}

function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone", "server.js");
  }
  // Dev mode: use next dev
  return null;
}

function startServer() {
  const serverPath = getServerPath();
  if (!serverPath) return; // dev mode uses separate next dev

  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "localhost",
    NODE_ENV: "production",
  };

  serverProcess = fork(serverPath, [], { env, silent: true });

  serverProcess.stdout?.on("data", (data) => {
    console.log("[server]", data.toString());
  });
  serverProcess.stderr?.on("data", (data) => {
    console.error("[server]", data.toString());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "驾考视频工作室",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.on("closed", () => { mainWindow = null; });
}

function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${PORT}`, (res) => {
        resolve(true);
      });
      req.on("error", () => {
        if (attempts >= retries) reject(new Error("Server failed to start"));
        else setTimeout(check, 500);
      });
      req.end();
    };
    check();
  });
}

app.whenReady().then(async () => {
  setupPaths();

  if (app.isPackaged) {
    startServer();
    await waitForServer();
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
