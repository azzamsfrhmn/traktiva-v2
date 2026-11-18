// Electron shell: dev loads `next dev`; packaged app runs the Next standalone server locally.
const { app, BrowserWindow, ipcMain, shell, utilityProcess } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const ICON = path.join(__dirname, "..", "resources", "icon.png");
let server;


function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    }).on("error", reject);
  });
}

async function waitFor(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error(`Server tidak merespons: ${url}`);
}

async function startServer() {
  if (!app.isPackaged) return "http://localhost:3000";
  const port = await freePort();
  const dir = path.join(process.resourcesPath, "app-server");
  server = utilityProcess.fork(path.join(dir, "server.js"), [], {
    cwd: dir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1", // local only, never exposed to LAN
      TRAKTIVA_DATA_DIR: app.getPath("userData"),
    },
  });
  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  const url = await startServer();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720, // small enough for half-screen snapping; layout switches to compact mode below md
    minHeight: 520,
    show: false,
    frame: false, // no OS title bar: the app's own navbar is the title bar (drag region + window buttons)
    autoHideMenuBar: true,
    icon: ICON, // taskbar/window icon (exe icon comes from electron-builder)
    backgroundColor: "#0e110f", // avoid white flash before the page paints
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  });
  // External links open in the user's browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  win.once("ready-to-show", () => win.show());
  setupZoom(win);
  setupWindowControls(win);
  await waitFor(url);
  await win.loadURL(url);
}

// Zoom: Ctrl +/=/-/0 and Ctrl+scroll, clamped 50–200%, remembered across restarts.
// (Electron's default menu needs Shift for "+" on most keyboards and ignores Ctrl+scroll, so handle it ourselves.)
const ZOOM_FILE = () => path.join(app.getPath("userData"), "zoom.json");
const clampZoom = (z) => Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));

function setupZoom(win) {
  const wc = win.webContents;
  let factor = 1;
  try {
    factor = clampZoom(JSON.parse(fs.readFileSync(ZOOM_FILE(), "utf8")).factor || 1);
  } catch {}
  const set = (z) => {
    factor = clampZoom(z);
    wc.setZoomFactor(factor);
    try { fs.writeFileSync(ZOOM_FILE(), JSON.stringify({ factor })); } catch {}
  };
  wc.on("did-finish-load", () => wc.setZoomFactor(factor)); // reapply after navigations/reloads
  wc.on("zoom-changed", (_e, dir) => set(factor + (dir === "in" ? 0.1 : -0.1))); // Ctrl+scroll / pinch
  wc.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt) return;
    const k = input.key;
    if (k === "=" || k === "+") set(factor + 0.1);
    else if (k === "-" || k === "_") set(factor - 0.1);
    else if (k === "0") set(1);
    else return;
    event.preventDefault();
  });
}

// Custom title bar: the renderer asks main to minimize/maximize/close, and main reports window state back
// so the maximize button can switch to "restore". F11 toggles real fullscreen.
function setupWindowControls(win) {
  const wc = win.webContents;
  const state = () => ({ maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused() });
  const push = () => !wc.isDestroyed() && wc.send("window:state", state());
  for (const ev of ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "focus", "blur"]) win.on(ev, push);

  // Only our own page may drive the window.
  const own = (fn) => (event, ...args) => (event.sender === wc ? fn(...args) : undefined);
  ipcMain.handle("window:state", own(() => state()));
  ipcMain.handle("window:minimize", own(() => win.minimize()));
  ipcMain.handle("window:toggle-maximize", own(() => (win.isMaximized() ? win.unmaximize() : win.maximize())));
  ipcMain.handle("window:toggle-fullscreen", own(() => win.setFullScreen(!win.isFullScreen())));
  ipcMain.handle("window:close", own(() => win.close()));

  wc.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

app.whenReady().then(createWindow).catch((e) => {
  console.error(e);
  app.quit();
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => server?.kill());
