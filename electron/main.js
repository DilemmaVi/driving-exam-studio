const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow = null;
let serverProcess = null;
const PORT = 3456;

// Log to file in userData for debugging
let logFile = null;
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  if (logFile) fs.appendFileSync(logFile, line);
}

function getUserDataPath() {
  return app.getPath("userData");
}

function setupPaths() {
  const userData = getUserDataPath();
  logFile = path.join(userData, "app.log");
  // Clear old log
  fs.writeFileSync(logFile, "");
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
  log(`nodePath: ${nodePath}, exists: ${fs.existsSync(nodePath)}`);
  log(`serverPath: ${serverPath}, exists: ${fs.existsSync(serverPath)}`);

  // List resources dir to debug
  try {
    const resDir = getResourcesPath();
    const items = fs.readdirSync(resDir);
    log(`resources dir contents: ${items.join(", ")}`);
    if (fs.existsSync(path.join(resDir, "standalone"))) {
      const standaloneItems = fs.readdirSync(path.join(resDir, "standalone"));
      log(`standalone dir contents: ${standaloneItems.slice(0, 20).join(", ")}`);
    }
  } catch (e) {
    log(`Error listing resources: ${e.message}`);
  }

  const nodeDepsPath = path.join(path.dirname(serverPath), "node_modules");
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "localhost",
    NODE_ENV: "production",
    NODE_PATH: nodeDepsPath,
    NODE_EXEC: nodePath,
    UPDATE_STATUS_FILE: path.join(getUserDataPath(), "update-status.json"),
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

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  const statusFile = path.join(getUserDataPath(), "update-status.json");
  process.env.UPDATE_STATUS_FILE = statusFile;

  function writeStatus(status) {
    try { fs.writeFileSync(statusFile, JSON.stringify(status)); } catch {}
  }

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
}
