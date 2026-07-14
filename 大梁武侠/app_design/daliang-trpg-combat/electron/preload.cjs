const { contextBridge, ipcRenderer } = require("electron");

const desktop = Object.freeze({
  isDesktop: true,
  minimize: () => ipcRenderer.send("desktop:minimize"),
  toggleMaximize: () => ipcRenderer.send("desktop:toggle-maximize"),
  toggleFullScreen: () => ipcRenderer.send("desktop:toggle-full-screen"),
  close: () => ipcRenderer.send("desktop:close"),
  getWindowState: () => ipcRenderer.invoke("desktop:get-window-state"),
  onWindowState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("desktop:window-state", handler);
    return () => ipcRenderer.removeListener("desktop:window-state", handler);
  },
});

contextBridge.exposeInMainWorld("daliangDesktop", desktop);
