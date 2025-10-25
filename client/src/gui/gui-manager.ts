import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';

export class GuiManager {
  private linkWindow: BrowserWindow | null = null;
  private welcomeWindow: BrowserWindow | null = null;
  private linkCodeResolver: ((code: string) => void) | null = null;

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Setup IPC handlers for communication with renderer processes
   */
  private setupIpcHandlers(): void {
    // Handle link account request
    ipcMain.handle('link-account', async (event, code: string) => {
      if (this.linkCodeResolver) {
        this.linkCodeResolver(code);
        return { success: true };
      }
      return { success: false, error: 'No resolver set' };
    });

    // Handle window close request
    ipcMain.on('close-window', () => {
      if (this.welcomeWindow) {
        this.welcomeWindow.close();
        this.welcomeWindow = null;
      }
    });
  }

  /**
   * Show link code input window and wait for code
   */
  async showLinkCodeWindow(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.linkCodeResolver = resolve;

      this.linkWindow = new BrowserWindow({
        width: 500,
        height: 650,
        resizable: false,
        frame: true,
        titleBarStyle: 'default',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });

      // Remove menu bar
      this.linkWindow.setMenuBarVisibility(false);

      // Load the link code HTML
      this.linkWindow.loadFile(path.join(__dirname, 'link-code.html'));

      // Handle window close
      this.linkWindow.on('closed', () => {
        this.linkWindow = null;
        if (this.linkCodeResolver) {
          reject(new Error('Window closed without submitting code'));
          this.linkCodeResolver = null;
        }
      });

      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        this.linkWindow.webContents.openDevTools();
      }
    });
  }

  /**
   * Close link code window
   */
  closeLinkCodeWindow(): void {
    if (this.linkWindow) {
      this.linkWindow.close();
      this.linkWindow = null;
    }
  }

  /**
   * Show welcome window with user info
   */
  async showWelcomeWindow(userData: {
    username: string;
    avatar: string;
    plan: string;
  }): Promise<void> {
    this.welcomeWindow = new BrowserWindow({
      width: 550,
      height: 600,
      resizable: false,
      frame: true,
      titleBarStyle: 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Remove menu bar
    this.welcomeWindow.setMenuBarVisibility(false);

    // Load the welcome HTML
    this.welcomeWindow.loadFile(path.join(__dirname, 'welcome.html'));

    // Wait for window to be ready then send user data
    this.welcomeWindow.webContents.on('did-finish-load', () => {
      this.welcomeWindow?.webContents.send('user-data', userData);
    });

    // Handle window close
    this.welcomeWindow.on('closed', () => {
      this.welcomeWindow = null;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.welcomeWindow.webContents.openDevTools();
    }
  }

  /**
   * Close welcome window
   */
  closeWelcomeWindow(): void {
    if (this.welcomeWindow) {
      this.welcomeWindow.close();
      this.welcomeWindow = null;
    }
  }

  /**
   * Close all windows
   */
  closeAll(): void {
    this.closeLinkCodeWindow();
    this.closeWelcomeWindow();
  }
}
