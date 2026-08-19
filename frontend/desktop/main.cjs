/**
 * HighLyAgent Admin — Electron wrapper (optional desktop app)
 *
 *   npm i -D electron
 *   npm run electron
 *
 * Loads the built dashboard (dist/) in a native window. No remote content,
 * no node integration in the renderer — security first.
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0e12',
    title: 'HighLyAgent — Admin Control Center',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(DIST, 'index.html'));

  // external links open in the real browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
