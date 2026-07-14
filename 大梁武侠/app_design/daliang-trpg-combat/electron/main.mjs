import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow;

function emitWindowState(window) {
  window.webContents.send("desktop:window-state", {
    maximized: window.isMaximized(),
    fullScreen: window.isFullScreen(),
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: "#130f0b",
    autoHideMenuBar: true,
    title: "大梁江湖TRPG",
    icon: path.join(__dirname, "../public/assets/icons/png512/005_world_世界.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDevelopment,
    },
  });

  mainWindow = window;
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    const current = window.webContents.getURL();
    if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    console.error("Renderer load failed", { code, description, validatedUrl });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process ended", details);
  });
  window.on("maximize", () => emitWindowState(window));
  window.on("unmaximize", () => emitWindowState(window));
  window.on("enter-full-screen", () => emitWindowState(window));
  window.on("leave-full-screen", () => emitWindowState(window));
  window.once("ready-to-show", () => window.show());

  if (isDevelopment) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId("cn.daliangjianghu.trpg");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());

ipcMain.handle("desktop:get-window-state", () => ({
  maximized: mainWindow?.isMaximized() ?? false,
  fullScreen: mainWindow?.isFullScreen() ?? false,
}));
ipcMain.on("desktop:minimize", () => mainWindow?.minimize());
ipcMain.on("desktop:toggle-maximize", () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on("desktop:toggle-full-screen", () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});
ipcMain.on("desktop:close", () => mainWindow?.close());

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
});
