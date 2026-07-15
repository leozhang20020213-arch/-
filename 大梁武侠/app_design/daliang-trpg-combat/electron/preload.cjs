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
  storage: Object.freeze({
    read: (key) => ipcRenderer.sendSync("storage:read-sync", key),
    write: (key, value) => ipcRenderer.invoke("storage:write", key, value),
    clear: (key) => ipcRenderer.invoke("storage:clear", key),
  }),
  lanHost: Object.freeze({
    start: (port) => ipcRenderer.invoke("lan-host:start", port),
    stop: () => ipcRenderer.invoke("lan-host:stop"),
  }),
});

contextBridge.exposeInMainWorld("daliangDesktop", desktop);
