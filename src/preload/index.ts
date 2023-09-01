import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { API } from "./api";

// Custom APIs for renderer
const api: API = {
  fetchConfig: async () => await ipcRenderer.invoke("fetch-config"),
  updateConfig: async (key, value) => await ipcRenderer.invoke("update-config", key, value),
  promptPathUpdate: async () => await ipcRenderer.invoke("prompt-path-update"),
  purgeTempCache: async () => await ipcRenderer.invoke("purge-temp-cache"),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
