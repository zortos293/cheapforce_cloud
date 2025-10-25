import { ApiClient } from './api';
import path from 'path';
import fs from 'fs';

export class SyncManager {
  private syncing: Set<string> = new Set();

  constructor(private api: ApiClient) {}

  /**
   * Upload files for a specific game
   */
  async uploadGameFiles(gameId: string, filePaths: string[], basePath: string): Promise<void> {
    if (this.syncing.has(gameId)) {
      console.log(`Already syncing ${gameId}, skipping...`);
      return;
    }

    this.syncing.add(gameId);

    try {
      console.log(`\nSyncing ${gameId}...`);
      console.log(`Uploading ${filePaths.length} file(s)`);

      // Prepare files with relative paths
      const files = filePaths.map(filePath => ({
        path: filePath,
        name: path.relative(basePath, filePath),
      }));

      await this.api.uploadFiles(gameId, files);

      console.log(`Successfully synced ${gameId}`);
    } catch (error: any) {
      console.error(`Failed to sync ${gameId}:`, error.message);
    } finally {
      this.syncing.delete(gameId);
    }
  }

  /**
   * Download and restore saves for a game
   */
  async restoreGameSaves(gameId: string, targetPath: string): Promise<void> {
    try {
      console.log(`\nRestoring saves for ${gameId}...`);

      const tempZip = path.join(process.cwd(), `${gameId}-restore.zip`);

      // Download zip
      await this.api.downloadGameSaves(gameId, tempZip);

      // Extract zip
      await this.extractZip(tempZip, targetPath);

      // Clean up
      fs.unlinkSync(tempZip);

      console.log(`Successfully restored saves to ${targetPath}`);
    } catch (error: any) {
      console.error(`Failed to restore ${gameId}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract a zip file
   */
  private async extractZip(zipPath: string, targetPath: string): Promise<void> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);

    // Ensure target directory exists
    fs.mkdirSync(targetPath, { recursive: true });

    // Extract
    zip.extractAllTo(targetPath, true);
  }

  /**
   * Initial sync - upload all existing files for monitored games
   */
  async initialSync(gameId: string, files: string[], basePath: string): Promise<void> {
    if (files.length === 0) {
      console.log(`No files to sync for ${gameId}`);
      return;
    }

    console.log(`\nInitial sync for ${gameId}: ${files.length} file(s)`);
    await this.uploadGameFiles(gameId, files, basePath);
  }
}
