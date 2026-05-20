const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow = null;
let serverProcess = null;
const PORT = 3456;

// --- Logging system: daily rotation, 7-day retention ---
let logDir = null;
let logFile = null;
let currentLogDate = null;

function getLogDate() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

function setupLogging() {
  const userData = getUserDataPath();
  logDir = path.join(userData, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  rotateLog();
  cleanOldLogs();
}

function rotateLog() {
  const today = getLogDate();
  if (currentLogDate === today) return;
  currentLogDate = today;
  logFile = path.join(logDir, `app-${today}.log`);
}

function cleanOldLogs() {
  try {
    const files = fs.readdirSync(logDir).filter(f => f.startsWith("app-") && f.endsWith(".log"));
    const cutoff = new Date(Date.now() - 7 * 86400000);
    for (const f of files) {
      const dateStr = f.replace("app-", "").replace(".log", "");
      const fileDate = new Date(dateStr);
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(logDir, f));
      }
    }
  } catch {}
}

function log(msg) {
  rotateLog();
  const timestamp = new Date(Date.now() + 8 * 3600000).toISOString().replace("T", " ").slice(0, 19);
  const line = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  if (logFile) {
    try { fs.appendFileSync(logFile, line); } catch {}
  }
}

function getUserDataPath() {
  return app.getPath("userData");
}

function setupPaths() {
  const userData = getUserDataPath();
  setupLogging();
  log(`userData: ${userData}`);
  log(`resourcesPath: ${app.isPackaged ? process.resourcesPath : "dev"}`);

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
    log(`Copying DB from ${dbSource} to ${dbDest}, exists: ${fs.existsSync(dbSource)}`);
    if (fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, dbDest);
    }
  }

  process.env.DB_PATH = dbDest;
  process.env.AUDIO_DIR = audioDir;
  process.env.OUTPUT_DIR = outputDir;
  process.env.PORT = String(PORT);
  log(`DB_PATH: ${dbDest}`);
  log(`AUDIO_DIR: ${audioDir}`);
  log(`OUTPUT_DIR: ${outputDir}`);
}

function getResourcesPath() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, "..");
}

function getNodePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "node", "node.exe");
  }
  return "node";
}

function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone", "server.js");
  }
  return null;
}

function startServer() {
  const serverPath = getServerPath();
  if (!serverPath) return;

  const nodePath = getNodePath();
  const standaloneDir = path.dirname(serverPath);
  log(`nodePath: ${nodePath}, exists: ${fs.existsSync(nodePath)}`);
  log(`serverPath: ${serverPath}, exists: ${fs.existsSync(serverPath)}`);

  // Create node_modules junction pointing to node_deps so standard module resolution works
  const nodeModulesLink = path.join(standaloneDir, "node_modules");
  const nodeDepsDir = path.join(standaloneDir, "node_deps");
  if (fs.existsSync(nodeDepsDir) && !fs.existsSync(nodeModulesLink)) {
    try {
      fs.symlinkSync(nodeDepsDir, nodeModulesLink, "junction");
      log(`Created junction: node_modules -> node_deps`);
    } catch (e) {
      log(`Failed to create junction: ${e.message}`);
    }
  }

  const nodeDepsPath = nodeDepsDir;
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "localhost",
    NODE_ENV: "production",
    NODE_PATH: nodeDepsPath,
    NODE_EXEC: nodePath,
    UPDATE_STATUS_FILE: path.join(getUserDataPath(), "update-status.json"),
    LOG_DIR: logDir,
  };

  serverProcess = spawn(nodePath, [serverPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: path.dirname(serverPath),
  });

  serverProcess.stdout.on("data", (data) => {
    log(`[server:out] ${data.toString().trim()}`);
  });
  serverProcess.stderr.on("data", (data) => {
    log(`[server:err] ${data.toString().trim()}`);
  });
  serverProcess.on("error", (err) => {
    log(`[server:error] ${err.message}`);
  });
  serverProcess.on("exit", (code) => {
    log(`[server:exit] code=${code}`);
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

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${PORT}`, () => {
        log(`Server ready after ${attempts} attempts`);
        resolve(true);
      });
      req.on("error", () => {
        if (attempts >= retries) {
          log(`Server failed to start after ${retries} attempts`);
          reject(new Error("Server failed to start"));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

app.whenReady().then(async () => {
  try {
    setupPaths();

    if (app.isPackaged) {
      startServer();
      await waitForServer();
    }

    createWindow();
    setupAutoUpdater();
  } catch (err) {
    log(`FATAL: ${err.message}\n${err.stack}`);
    dialog.showErrorBox(
      "启动失败",
      `${err.message}\n\n日志文件: ${logFile}\n\n请将日志文件发送给开发者排查问题。`
    );
    app.quit();
  }
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

function checkMinVersion(writeStatus) {
  const https = require("https");
  const options = {
    hostname: "api.github.com",
    path: "/repos/DilemmaVi/driving-exam-studio/releases/latest",
    headers: { "User-Agent": "driving-exam-studio" },
  };
  https.get(options, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      try {
        const release = JSON.parse(data);
        const match = (release.body || "").match(/min_version:\s*([\d.]+)/);
        if (match) {
          log(`[updater] min_version from release: ${match[1]}`);
          writeStatus({ state: "checking", minVersion: match[1] });
        }
      } catch (e) {
        log(`[updater] Failed to parse release info: ${e.message}`);
      }
    });
  }).on("error", (e) => {
    log(`[updater] Failed to check min_version: ${e.message}`);
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  const statusFile = path.join(getUserDataPath(), "update-status.json");
  process.env.UPDATE_STATUS_FILE = statusFile;

  const currentVersion = app.getVersion();

  function writeStatus(status) {
    try { fs.writeFileSync(statusFile, JSON.stringify({ ...status, currentVersion })); } catch {}
  }

  // Check min_version from latest GitHub release
  checkMinVersion(writeStatus);

  writeStatus({ state: "checking" });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: log, warn: log, error: log, debug: log };

  autoUpdater.on("checking-for-update", () => {
    log("[updater] 检查更新...");
    writeStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    log(`[updater] 发现新版本: ${info.version}`);
    writeStatus({ state: "downloading", version: info.version, percent: 0 });
  });

  autoUpdater.on("update-not-available", () => {
    log("[updater] 当前已是最新版本");
    writeStatus({ state: "up-to-date" });
  });

  autoUpdater.on("download-progress", (progress) => {
    log(`[updater] 下载进度: ${Math.round(progress.percent)}% (${(progress.transferred / 1048576).toFixed(1)}/${(progress.total / 1048576).toFixed(1)} MB)`);
    writeStatus({
      state: "downloading",
      percent: Math.round(progress.percent),
      transferred: (progress.transferred / 1048576).toFixed(1),
      total: (progress.total / 1048576).toFixed(1),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log(`[updater] 下载完成: ${info.version}`);
    writeStatus({ state: "ready", version: info.version });
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "info",
      title: "更新就绪",
      message: `新版本 ${info.version} 已下载完成，是否立即重启更新？`,
      buttons: ["立即更新", "稍后"],
      defaultId: 0,
    });
    if (choice === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on("error", (err) => {
    log(`[updater] 更新出错: ${err.message}`);
    writeStatus({ state: "error", message: err.message });
  });

  autoUpdater.checkForUpdates().catch((err) => {
    log(`[updater] 检查更新失败: ${err.message}`);
    writeStatus({ state: "error", message: err.message });
  });

  // Watch for restart request from web UI
  const restartFile = path.join(getUserDataPath(), "restart-requested");
  setInterval(() => {
    if (fs.existsSync(restartFile)) {
      try { fs.unlinkSync(restartFile); } catch {}
      log("[updater] Restart requested from web UI, quitting and installing...");
      autoUpdater.quitAndInstall(false, true);
    }
  }, 2000);
}
