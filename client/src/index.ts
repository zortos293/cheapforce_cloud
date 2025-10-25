import { ApiClient } from './api';
import { FileWatcher, WatcherConfig } from './watcher';
import { SyncManager } from './sync';
import { GuiManager } from './gui/gui-manager';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const GAMES_CONFIG_PATH = path.join(__dirname, '..', '..', 'shared', 'games-config.json');
const APPS_CONFIG_PATH = path.join(__dirname, '..', '..', 'shared', 'apps-config.json');
const CUSTOM_FILES_PATH = path.join(os.homedir(), 'CheapForceCloud', 'CustomFiles');

interface WatchPath {
  pattern: string;
  extensions: string[];
}

interface GameConfig {
  id: string;
  name: string;
  enabled: boolean;
  watchPaths: WatchPath[];
}

export class CheapForceClient {
  private api: ApiClient;
  private watcher: FileWatcher;
  private sync: SyncManager;
  private gui: GuiManager;
  private gamesConfig: { games: GameConfig[] };
  private appsConfig: { apps: GameConfig[] };
  private requestCheckInterval?: NodeJS.Timeout;
  private watchedGames: Map<string, { config: GameConfig; basePath: string }> = new Map();
  private userPlan: string = 'free';

  constructor() {
    this.api = new ApiClient(SERVER_URL);
    this.watcher = new FileWatcher(this.handleFilesChanged.bind(this));
    this.sync = new SyncManager(this.api);
    this.gui = new GuiManager();
    this.gamesConfig = this.loadGamesConfig();
    this.appsConfig = this.loadAppsConfig();
    this.ensureCustomFilesFolder();
  }

  /**
   * Load games configuration
   */
  private loadGamesConfig(): { games: GameConfig[] } {
    try {
      const configContent = fs.readFileSync(GAMES_CONFIG_PATH, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error('Failed to load games config:', error);
      return { games: [] };
    }
  }

  /**
   * Load apps configuration
   */
  private loadAppsConfig(): { apps: GameConfig[] } {
    try {
      const configContent = fs.readFileSync(APPS_CONFIG_PATH, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error('Failed to load apps config:', error);
      return { apps: [] };
    }
  }

  /**
   * Ensure custom files folder exists
   */
  private ensureCustomFilesFolder(): void {
    try {
      if (!fs.existsSync(CUSTOM_FILES_PATH)) {
        fs.mkdirSync(CUSTOM_FILES_PATH, { recursive: true });

        // Create a README file
        const readmePath = path.join(CUSTOM_FILES_PATH, 'README.txt');
        const readmeContent = `CheapForce Cloud - Custom Files Folder

This folder is for Premium users only.
Any files placed here will be automatically backed up to the cloud.

Note: This feature requires CheapStorage++ plan.
Use /setplan command in Discord to upgrade your account.

Supported by auto-sync when running the client.`;

        fs.writeFileSync(readmePath, readmeContent);
        console.log(`\n📁 Created custom files folder: ${CUSTOM_FILES_PATH}`);
      }
    } catch (error) {
      console.error('Failed to create custom files folder:', error);
    }
  }

  /**
   * Expand Windows environment variables in path
   */
  private expandPath(pathStr: string): string {
    // Replace Windows environment variables (%APPDATA%, %USERPROFILE%, etc.)
    let expanded = pathStr.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');

    return path.normalize(expanded);
  }

  /**
   * Resolve glob patterns to actual paths
   */
  private async resolveWatchPaths(game: GameConfig): Promise<Array<{ path: string; extensions: string[] }>> {
    const glob = require('fast-glob');
    const resolvedPaths: Array<{ path: string; extensions: string[] }> = [];

    for (const watchPath of game.watchPaths) {
      const expandedPattern = this.expandPath(watchPath.pattern);

      try {
        // Check if pattern contains glob characters
        if (expandedPattern.includes('*') || expandedPattern.includes('?')) {
          // Use glob to find matching directories
          const matches = await glob(expandedPattern, {
            onlyDirectories: true,
            absolute: true
          });

          for (const match of matches) {
            if (fs.existsSync(match)) {
              resolvedPaths.push({
                path: match,
                extensions: watchPath.extensions
              });
            }
          }
        } else {
          // Direct path (no glob)
          if (fs.existsSync(expandedPattern)) {
            resolvedPaths.push({
              path: expandedPattern,
              extensions: watchPath.extensions
            });
          }
        }
      } catch (error) {
        console.error(`Failed to resolve pattern ${watchPath.pattern}:`, error);
      }
    }

    return resolvedPaths;
  }

  /**
   * Handle file changes from watcher
   */
  private async handleFilesChanged(gameId: string, files: string[]): Promise<void> {
    const watchedGame = this.watchedGames.get(gameId);
    if (!watchedGame) return;

    await this.sync.uploadGameFiles(gameId, files, watchedGame.basePath);
  }

  /**
   * Start the client
   */
  async start(): Promise<void> {
    console.log('CheapForce Cloud - Starting...');

    // Try to load existing session
    if (this.api.loadSession()) {
      const verified = await this.api.verify();
      if (verified.valid) {
        console.log(`Welcome back, ${verified.user.username}!`);

        // Show welcome window
        await this.gui.showWelcomeWindow({
          username: verified.user.username,
          avatar: verified.user.avatar || '',
          plan: verified.user.plan || 'free'
        });

        // Start auto-sync immediately
        await this.startAutoSync();
        return;
      }
    }

    // Need to authenticate
    await this.authenticate();

    // Start auto-sync after authentication
    await this.startAutoSync();
  }

  /**
   * Authenticate with Discord using GUI
   */
  private async authenticate(): Promise<void> {
    try {
      // Show link code window and wait for code
      const code = await this.gui.showLinkCodeWindow();

      console.log('Linking account...');

      // Link account
      const user = await this.api.link(code);

      console.log(`Successfully linked to Discord as ${user.username}!`);

      // Close link window
      this.gui.closeLinkCodeWindow();

      // Show welcome window
      await this.gui.showWelcomeWindow({
        username: user.username,
        avatar: user.avatar || '',
        plan: user.plan || 'free'
      });

    } catch (error: any) {
      console.error('Failed to link:', error.message);
      // Show error and retry
      await this.authenticate();
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.requestCheckInterval) {
      clearInterval(this.requestCheckInterval);
    }
    this.gui.closeAll();
  }

  /**
   * Start auto-sync mode (always enabled, no menu)
   */
  private async startAutoSync(): Promise<void> {
    const enabledGames = this.gamesConfig.games.filter(g => g.enabled);
    const gamesWithPaths: Array<{ game: GameConfig; resolvedPaths: Array<{ path: string; extensions: string[] }> }> = [];

    // Resolve all watch paths for each game
    for (const game of enabledGames) {
      const resolvedPaths = await this.resolveWatchPaths(game);
      if (resolvedPaths.length > 0) {
        gamesWithPaths.push({ game, resolvedPaths });
      }
    }

    if (gamesWithPaths.length === 0) {
      console.log('No supported games found on your system.');
      console.log('Make sure games are installed and configured in games-config.json');
      return;
    }

    console.log('Detected games:');
    gamesWithPaths.forEach(({ game, resolvedPaths }) => {
      console.log(`  - ${game.name}`);
      resolvedPaths.forEach(rp => {
        const extStr = rp.extensions.length > 0 ? ` (${rp.extensions.join(', ')})` : '';
        console.log(`    └─ ${rp.path}${extStr}`);
      });
    });

    console.log('\nStarting auto-sync...');

    // Start watching each game with all its resolved paths
    for (const { game, resolvedPaths } of gamesWithPaths) {
      const allPaths = resolvedPaths.map(rp => rp.path);
      const allExtensions = [...new Set(resolvedPaths.flatMap(rp => rp.extensions))];

      const config: WatcherConfig = {
        gameId: game.id,
        gameName: game.name,
        paths: allPaths,
        extensions: allExtensions
      };

      this.watcher.watch(config);

      // Store first path as base path for compatibility
      this.watchedGames.set(game.id, {
        config: game,
        basePath: resolvedPaths[0].path
      });

      // Do initial sync
      const files = this.watcher.getWatchedFiles(game.id);
      if (files.length > 0) {
        await this.sync.initialSync(game.id, files, resolvedPaths[0].path);
      }
    }

    console.log('✓ Auto-sync is running!');
    console.log('Saves sync every 5 minutes when changes are detected.');
    console.log('Use Discord commands /sync or /pull for manual control.');

    // Start checking for Discord requests
    this.startRequestPolling();

    // Keep process alive
    await new Promise(() => {});
  }

  /**
   * Start polling for Discord sync/pull requests
   */
  private startRequestPolling(): void {
    const CHECK_INTERVAL = 10000; // Check every 10 seconds

    this.requestCheckInterval = setInterval(async () => {
      try {
        const requests = await this.api.checkPendingRequests();

        for (const request of requests) {
          await this.handleRemoteRequest(request);
        }
      } catch (error: any) {
        // Silently fail - don't spam console
      }
    }, CHECK_INTERVAL);

    console.log('📡 Listening for Discord commands...\n');
  }

  /**
   * Handle a remote sync/pull request from Discord
   */
  private async handleRemoteRequest(request: any): Promise<void> {
    const { request_type } = request;

    console.log(`\n🔔 Discord command received: /${request_type}`);

    try {
      if (request_type === 'sync') {
        // Force sync all watched games
        this.watcher.forceSyncAll();
        console.log('✅ Force sync completed');
        await this.api.notifyRequestComplete('sync', true);
      } else if (request_type === 'pull') {
        // Download and restore all watched games
        await this.handleForcePull();
        console.log('✅ Force pull completed');
        await this.api.notifyRequestComplete('pull', true);
      }
    } catch (error: any) {
      console.error(`❌ Failed to process ${request_type}:`, error.message);
      await this.api.notifyRequestComplete(request_type, false);
    }
  }

  /**
   * Handle force pull - download latest saves for all watched games
   */
  private async handleForcePull(): Promise<void> {
    console.log('Downloading latest saves...');

    for (const [gameId, { config, basePath }] of this.watchedGames) {
      try {
        await this.sync.restoreGameSaves(gameId, basePath);
        console.log(`  ✓ ${config.name} restored`);
      } catch (error: any) {
        console.error(`  ✗ ${config.name} failed:`, error.message);
      }
    }
  }

}

// Only start client if not running in Electron
// (Electron will start it from electron-main.ts)
if (!process.versions.electron) {
  const client = new CheapForceClient();
  client.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    client.cleanup();
    process.exit(0);
  });
}
