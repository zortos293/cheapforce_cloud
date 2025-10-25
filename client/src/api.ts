import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import FormData from 'form-data';

export class ApiClient {
  private client: AxiosInstance;
  private sessionId: string | null = null;

  constructor(private serverUrl: string) {
    this.client = axios.create({
      baseURL: serverUrl,
      timeout: 30000,
    });

    // Add auth interceptor
    this.client.interceptors.request.use(config => {
      if (this.sessionId) {
        config.headers.Authorization = `Bearer ${this.sessionId}`;
      }
      return config;
    });
  }

  /**
   * Link client with Discord account using 6-digit code
   */
  async link(code: string): Promise<{ userId: number; username: string }> {
    const response = await this.client.post('/api/auth/link', { code });
    this.sessionId = response.data.sessionId;

    // Save session for future use
    this.saveSession();

    return response.data.user;
  }

  /**
   * Verify current session is valid
   */
  async verify(): Promise<{ valid: boolean; user?: any }> {
    try {
      const response = await this.client.get('/api/auth/verify');
      return response.data;
    } catch {
      return { valid: false };
    }
  }

  /**
   * Logout and invalidate session
   */
  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      this.sessionId = null;
      this.clearSession();
    }
  }

  /**
   * Upload files for a game
   */
  async uploadFiles(gameId: string, files: { path: string; name: string }[]): Promise<void> {
    const formData = new FormData();
    formData.append('gameId', gameId);

    for (const file of files) {
      formData.append('files', fs.createReadStream(file.path), file.name);
    }

    await this.client.post('/api/saves/upload', formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  /**
   * List all saves
   */
  async listSaves(gameId?: string): Promise<any[]> {
    const params = gameId ? { gameId } : {};
    const response = await this.client.get('/api/saves/list', { params });
    return response.data.saves;
  }

  /**
   * Download all saves for a game
   */
  async downloadGameSaves(gameId: string, outputPath: string): Promise<void> {
    const response = await this.client.get(`/api/saves/download/${gameId}`, {
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * Get download URL for a specific file
   */
  async getDownloadUrl(gameId: string, fileName: string): Promise<string> {
    const response = await this.client.get(`/api/saves/download-url/${gameId}/${fileName}`);
    return response.data.url;
  }

  /**
   * Delete all saves for a game
   */
  async deleteSaves(gameId: string): Promise<void> {
    await this.client.delete(`/api/saves/${gameId}`);
  }

  /**
   * Check for pending sync/pull requests from Discord
   */
  async checkPendingRequests(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/sync-requests/pending');
      return response.data.requests || [];
    } catch (error) {
      console.error('Failed to check pending requests:', error);
      return [];
    }
  }

  /**
   * Notify server that a request was completed
   */
  async notifyRequestComplete(requestType: string, success: boolean): Promise<void> {
    try {
      await this.client.post('/api/sync-requests/complete', {
        requestType,
        success
      });
    } catch (error) {
      console.error('Failed to notify completion:', error);
    }
  }

  /**
   * Load saved session from file
   */
  loadSession(): boolean {
    try {
      const sessionPath = this.getSessionPath();
      if (fs.existsSync(sessionPath)) {
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        this.sessionId = data.sessionId;
        return true;
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
    return false;
  }

  /**
   * Save session to file
   */
  private saveSession(): void {
    try {
      const sessionPath = this.getSessionPath();
      fs.mkdirSync(require('path').dirname(sessionPath), { recursive: true });
      fs.writeFileSync(sessionPath, JSON.stringify({ sessionId: this.sessionId }));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Clear saved session
   */
  private clearSession(): void {
    try {
      const sessionPath = this.getSessionPath();
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Get path to session file
   */
  private getSessionPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return require('path').join(homeDir, '.cheapforce-cloud', 'session.json');
  }

  isAuthenticated(): boolean {
    return this.sessionId !== null;
  }
}
