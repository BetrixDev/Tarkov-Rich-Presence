import { app, shell, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, Notification } from "electron";
import path, { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import appIcon from "../../resources/icon.png?asset";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { Config, configSchema, DEFAULT_CONFIG } from "../config";
import { ROOT_PATH, CONFIG_PATH } from "../constants";
import { fetchTarkovDevData } from "./gql";
import { watcherEvents } from "./watcher-events";

require("update-electron-app")();

import "./watcher";
import "./rpc";

function setLoginItemSettings(enabled: boolean) {
  const exeName = path.basename(process.execPath);

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: ["--processStart", `"${exeName}"`, "--process-start-args", "--hidden"],
    name: "Tarkov Rich Presence",
  });
}

export function tryMakeConfig() {
  if (!existsSync(ROOT_PATH)) {
    mkdirSync(ROOT_PATH);
  }

  if (!existsSync(CONFIG_PATH)) {
    overwriteDefaultConfig();
  }

  // Validate config against zod schema
  const config = JSON.parse(readFileSync(CONFIG_PATH).toString());

  const parsed = configSchema.safeParse(config);

  if (!parsed.success) {
    overwriteDefaultConfig();
  }
}

export function getConfig() {
  const config = JSON.parse(readFileSync(CONFIG_PATH).toString());

  const parsed = configSchema.safeParse(config);

  if (!parsed.success) {
    overwriteDefaultConfig();
    return DEFAULT_CONFIG;
  }

  return parsed.data;
}

export function updateConfig<TKey extends keyof Config>(key: TKey, value: Config[TKey]) {
  if (key === "isEnabled") {
    if (value) {
      watcherEvents.emit("spawnLogWatcher");
    } else {
      watcherEvents.emit("killLogWatcher");
    }
  } else if (key === "openOnStartup") {
    setLoginItemSettings(value as boolean);
  }

  const config = getConfig();

  if (key === "exePath" && config.isEnabled) {
    watcherEvents.emit("killLogWatcher");
    watcherEvents.emit("spawnLogWatcher");
  }

  try {
    writeFileSync(CONFIG_PATH, JSON.stringify({ ...config, [key]: value }, null, 2));
    // eslint-disable-next-line
  } catch {}

  return getConfig();
}

export function overwriteDefaultConfig() {
  writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

let isQuitting = false;
let mainWindow: BrowserWindow;
let tray: Tray;

function handleMinimize() {
  mainWindow.hide();

  if (Notification.isSupported()) {
    new Notification({
      title: "Tarkov Rich Presence Minimized",
      body: "Tarkov RP has been minimized to the system tray",
      silent: true,
    }).show();
  }
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    icon: nativeImage.createFromPath(appIcon),
    width: 400,
    height: 540,
    minWidth: 400,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    backgroundMaterial: "mica",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      devTools: is.dev,
    },
  });

  if (!is.dev) {
    mainWindow.removeMenu();
  }

  mainWindow.on("ready-to-show", () => {
    if (!getConfig().minimizedOnStartup && !process.argv.includes("hidden")) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.on("minimize", () => {
    handleMinimize();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && !getConfig().shouldCloseButtonQuit) {
      event.preventDefault();
      handleMinimize();
    } else {
      return true;
    }

    return false;
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Create config.json and the paths associated
  tryMakeConfig();

  setLoginItemSettings(getConfig().openOnStartup);

  try {
    await fetchTarkovDevData();
  } catch {
    throw new Error("Unable to fetch data");
  }

  if (getConfig().isEnabled) {
    watcherEvents.emit("spawnLogWatcher");
  }

  ipcMain.handle("fetch-config", () => getConfig());
  ipcMain.handle("update-config", (_, key, value) => updateConfig(key, value));
  ipcMain.handle("prompt-path-update", () =>
    dialog
      .showOpenDialog({
        properties: ["openFile"],
        filters: [{ extensions: ["exe"], name: "EscapeFromTarkov" }],
        defaultPath: DEFAULT_CONFIG.exePath,
        message: "Select EscapeFromTarkov.exe",
      })
      .then((data) => {
        let filePath = data.filePaths.at(0);

        if (!filePath) {
          filePath = DEFAULT_CONFIG.exePath;
        }

        updateConfig("exePath", filePath);

        return filePath;
      }),
  );
  ipcMain.handle("purge-temp-cache", async () => {
    await fetchTarkovDevData();
    return;
  });

  const menuConstructorOptions: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Master Switch",
      click: (c) => {
        const newValue = !getConfig().isEnabled;

        updateConfig("isEnabled", newValue);
        c.checked = newValue;
      },
      checked: getConfig().isEnabled,
      type: "checkbox",
    },
    {
      label: "Show App",
      click: () => {
        mainWindow.show();
      },
      type: "normal",
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
      type: "normal",
    },
  ];

  const contextMenu = Menu.buildFromTemplate(menuConstructorOptions).on("menu-will-show", () => {
    tray.setContextMenu(contextMenu);
  });

  tray = new Tray(nativeImage.createFromPath(appIcon));
  tray.setToolTip("Tarkov Rich Presence");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.show();
  });

  // Set app user model id for windows
  electronApp.setAppUserModelId("TarkovRichPresence");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
