const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const { assertValidDomain } = require('./domains');
const { isCalibrationEnabled } = require('./flags');
const { parseRadarFrames } = require('./parser');

const SOURCE_URL = 'http://cambodiameteo.com/slideshow?menu=117&lang=en';
const SOURCE_ORIGIN = 'http://cambodiameteo.com';
const RADAR_IMAGE_PATH_PREFIX = '/data/animation/radar/';
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) CambodiaRadar/0.1 Safari/537.36';
const RUNTIME_CONFIG = Object.freeze({
  calibrationEnabled: isCalibrationEnabled(process.argv)
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#101214',
    title: 'Cambodia Radar',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

async function fetchRadarFrames(domain) {
  assertValidDomain(domain);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = new URL(SOURCE_URL);
    url.searchParams.set('domain', domain);

    const response = await fetch(url.href, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Cambodia Meteo returned HTTP ${response.status}`);
    }

    const html = await response.text();
    const frames = parseRadarFrames(html);

    return {
      domain,
      fetchedAt: new Date().toISOString(),
      frames
    };
  } finally {
    clearTimeout(timeout);
  }
}

function assertValidRadarImageUrl(imageUrl) {
  let url;

  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error('Invalid radar image URL.');
  }

  if (url.origin !== SOURCE_ORIGIN || !url.pathname.startsWith(RADAR_IMAGE_PATH_PREFIX)) {
    throw new Error('Invalid radar image URL.');
  }

  return url;
}

async function fetchRadarImageDataUrl(imageUrl) {
  const url = assertValidRadarImageUrl(imageUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.href, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/jpeg,image/*'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Cambodia Meteo returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error('Radar image response was not an image.');
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${imageBuffer.toString('base64')}`;
  } finally {
    clearTimeout(timeout);
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle('radar:fetchFrames', (_event, domain) => fetchRadarFrames(domain));
  ipcMain.handle('radar:fetchImageDataUrl', (_event, imageUrl) => fetchRadarImageDataUrl(imageUrl));
  ipcMain.handle('app:getRuntimeConfig', () => RUNTIME_CONFIG);
  ipcMain.handle('app:quit', () => app.quit());
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = {
  SOURCE_URL,
  fetchRadarFrames,
  fetchRadarImageDataUrl,
  RUNTIME_CONFIG
};
