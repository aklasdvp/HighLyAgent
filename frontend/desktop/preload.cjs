/**
 * Minimal, read-only bridge — exposes nothing sensitive to the renderer.
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('hlaDesktop', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
