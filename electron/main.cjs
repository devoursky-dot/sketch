// electron/main.cjs
// Electron Main Process for RotoSketch Studio Desktop App

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Crucial flags for Wacom / Windows Ink / Tablet Stylus and High-DPI hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-features', 'UsePointerEventDoubleTapDelay,UsePointerEventTimestamp');
app.commandLine.appendSwitch('enable-pointer-events');
app.commandLine.appendSwitch('disable-features', 'TouchTextSelection');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: 'RotoSketch Studio - 스케치북 기반 동영상 로토스코핑 & 애니메이션',
    backgroundColor: '#080b12',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allows loading local video files smoothly
    },
    show: false
  });

  // Load the built Vite production output
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Remove default menu for a clean, immersive studio interface
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
