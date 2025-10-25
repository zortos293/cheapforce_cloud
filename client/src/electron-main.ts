import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { CheapForceClient } from './index';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let tray: Tray | null = null;
let client: CheapForceClient | null = null;

// Windows-only: Set app user model ID for proper taskbar integration
app.setAppUserModelId('com.cheapforce.cloud');

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Create system tray icon
  createTray();

  // Start the client
  client = new CheapForceClient();
  await client.start();
});

// Keep running in system tray even when all windows are closed (Windows behavior)
app.on('window-all-closed', () => {
  // Don't quit - keep running in system tray
});

// Clean up on app quit
app.on('before-quit', (event) => {
  if (client) {
    client.cleanup();
  }
});

/**
 * Create Windows system tray icon
 */
function createTray() {
  // Create a simple icon (you can replace with assets/icon.ico)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAA0klEQVRYhe2WQQ6AIAxE+d+j6dG8mQfRhQvjQimFIt0YZ9VJpy0tIQAAYClJY0k7a5KUJb1qc5Z0S9qTPiVpZ/36VwAk7ZKupHPtl6RL0iHplfRIOqy/H0DS4Lve/0fAFhJYS2AtgbUEVgJbSGALCWwhgZUEVhJYSWAlsQ0S+fLB+lET0Hh/Bejif40FquHe2ti3gu7+IwFd/I8Buvp/9w/Rf2qAq/5TA1z1nxrgoZ/VAIf+bAP4/nR9d2rO92c8ggEAgJH5AIzlJ8dQZquzAAAAAElFTkSuQmCC'
  );

  tray = new Tray(icon);

  // Windows system tray context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'CheapForce Cloud',
      enabled: false,
      icon: icon.resize({ width: 16, height: 16 })
    },
    { type: 'separator' },
    {
      label: '✓ Status: Running',
      enabled: false
    },
    {
      label: '✓ Auto-Sync: Enabled',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Discord',
      click: () => {
        require('electron').shell.openExternal('https://discord.com');
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('CheapForce Cloud - Background Sync');
  tray.setContextMenu(contextMenu);

  // Windows-specific: Double-click to show Discord info
  tray.on('double-click', () => {
    require('electron').shell.openExternal('https://discord.com');
  });
}
