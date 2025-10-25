import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';

export interface WatcherConfig {
  gameId: string;
  gameName: string;
  paths: string[];
  extensions?: string[]; // Filter by file extensions (e.g., ['.dat', '.json'])
}

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private pendingChanges: Map<string, Set<string>> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private extensions: Map<string, string[]> = new Map(); // Store extensions per game
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private onFilesChanged: (gameId: string, files: string[]) => void
  ) {}

  /**
   * Check if file matches allowed extensions
   */
  private matchesExtensions(filePath: string, extensions?: string[]): boolean {
    if (!extensions || extensions.length === 0) {
      return true; // No filter, allow all
    }

    // Empty string in extensions means allow files with no extension
    const fileExt = path.extname(filePath);
    return extensions.some(ext => {
      if (ext === '') {
        return fileExt === ''; // Match files with no extension
      }
      return fileExt === ext;
    });
  }

  /**
   * Start watching a game's save directories
   */
  watch(config: WatcherConfig): void {
    const validPaths = config.paths.filter(p => {
      if (!fs.existsSync(p)) {
        console.log(`Path does not exist, skipping: ${p}`);
        return false;
      }
      return true;
    });

    if (validPaths.length === 0) {
      console.log(`No valid paths to watch for ${config.gameName}`);
      return;
    }

    // Store extensions for this game
    if (config.extensions) {
      this.extensions.set(config.gameId, config.extensions);
    }

    console.log(`Watching ${config.gameName}:`);
    validPaths.forEach(p => console.log(`  - ${p}`));

    const watcher = chokidar.watch(validPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
      // Ignore temporary files and filter by extensions
      ignored: (filePath: string) => {
        // Ignore hidden files and temp files
        if (/(^|[\/\\])\.|\.tmp$|\.temp$/.test(filePath)) {
          return true;
        }
        // Check extension filter
        const gameExtensions = this.extensions.get(config.gameId);
        return !this.matchesExtensions(filePath, gameExtensions);
      },
    });

    watcher
      .on('add', filePath => this.handleChange(config.gameId, filePath))
      .on('change', filePath => this.handleChange(config.gameId, filePath))
      .on('unlink', filePath => this.handleChange(config.gameId, filePath))
      .on('error', error => console.error(`Watcher error for ${config.gameName}:`, error));

    this.watchers.set(config.gameId, watcher);

    // Start periodic sync interval
    this.startSyncInterval(config.gameId);
  }

  /**
   * Handle file change - mark for pending sync
   */
  private handleChange(gameId: string, filePath: string): void {
    console.log(`File changed (pending sync): ${filePath}`);

    // Add to pending changes
    if (!this.pendingChanges.has(gameId)) {
      this.pendingChanges.set(gameId, new Set());
    }
    this.pendingChanges.get(gameId)!.add(filePath);
  }

  /**
   * Start periodic sync interval for a game
   */
  private startSyncInterval(gameId: string): void {
    const interval = setInterval(() => {
      this.syncPendingChanges(gameId);
    }, this.SYNC_INTERVAL_MS);

    this.syncIntervals.set(gameId, interval);
  }

  /**
   * Sync pending changes for a game
   */
  private syncPendingChanges(gameId: string): void {
    const changes = this.pendingChanges.get(gameId);

    if (!changes || changes.size === 0) {
      return;
    }

    console.log(`\n⏰ Scheduled sync triggered for ${gameId} (${changes.size} changes detected)`);

    // Get all current files
    const allFiles = this.getWatchedFiles(gameId);

    if (allFiles.length > 0) {
      this.onFilesChanged(gameId, allFiles);
    }

    // Clear pending changes
    this.pendingChanges.delete(gameId);
  }

  /**
   * Force sync for a specific game
   */
  forceSync(gameId: string): void {
    console.log(`\n🔄 Force sync triggered for ${gameId}`);
    const allFiles = this.getWatchedFiles(gameId);

    if (allFiles.length > 0) {
      this.onFilesChanged(gameId, allFiles);
    }

    // Clear pending changes since we just synced
    this.pendingChanges.delete(gameId);
  }

  /**
   * Force sync all games
   */
  forceSyncAll(): void {
    console.log(`\n🔄 Force sync triggered for ALL games`);
    for (const gameId of this.watchers.keys()) {
      this.forceSync(gameId);
    }
  }

  /**
   * Get pending changes count for a game
   */
  getPendingChangesCount(gameId: string): number {
    return this.pendingChanges.get(gameId)?.size || 0;
  }

  /**
   * Get total pending changes across all games
   */
  getTotalPendingChanges(): number {
    let total = 0;
    for (const changes of this.pendingChanges.values()) {
      total += changes.size;
    }
    return total;
  }

  /**
   * Stop watching a specific game
   */
  async unwatch(gameId: string): Promise<void> {
    const watcher = this.watchers.get(gameId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(gameId);
    }

    const interval = this.syncIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(gameId);
    }

    this.pendingChanges.delete(gameId);
  }

  /**
   * Stop all watchers
   */
  async close(): Promise<void> {
    for (const [gameId, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();

    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();

    this.pendingChanges.clear();
  }

  /**
   * Get all files in watched directories for a game
   */
  getWatchedFiles(gameId: string): string[] {
    const watcher = this.watchers.get(gameId);
    if (!watcher) return [];

    const watchedPaths = watcher.getWatched();
    const allFiles: string[] = [];

    for (const [dir, files] of Object.entries(watchedPaths)) {
      for (const file of files as string[]) {
        const fullPath = path.join(dir, file);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          allFiles.push(fullPath);
        }
      }
    }

    return allFiles;
  }
}
