import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export class R2Storage {
  /**
   * Upload a file to R2 storage
   */
  static async uploadFile(
    userId: number,
    gameId: string,
    fileName: string,
    fileContent: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const key = `users/${userId}/games/${gameId}/${fileName}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        userId: userId.toString(),
        gameId: gameId,
        uploadedAt: Date.now().toString(),
      },
    }));

    return key;
  }

  /**
   * Download a file from R2 storage
   */
  static async downloadFile(key: string): Promise<Buffer> {
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    if (!response.Body) {
      throw new Error('File not found');
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  /**
   * List all files for a user and game
   */
  static async listFiles(userId: number, gameId?: string): Promise<string[]> {
    const prefix = gameId
      ? `users/${userId}/games/${gameId}/`
      : `users/${userId}/games/`;

    const response = await r2Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    }));

    return response.Contents?.map(obj => obj.Key!) || [];
  }

  /**
   * List all files with metadata (including size)
   */
  static async listFilesWithMetadata(userId: number, type?: 'games' | 'apps' | 'custom'): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
    let prefix = `users/${userId}/`;

    if (type === 'games') {
      prefix += 'games/';
    } else if (type === 'apps') {
      prefix += 'apps/';
    } else if (type === 'custom') {
      prefix += 'custom/';
    }

    const response = await r2Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    }));

    return response.Contents?.map(obj => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified
    })) || [];
  }

  /**
   * Delete a file from R2 storage
   */
  static async deleteFile(key: string): Promise<void> {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
  }

  /**
   * Get a presigned URL for direct upload (for large files)
   */
  static async getUploadUrl(userId: number, gameId: string, fileName: string): Promise<string> {
    const key = `users/${userId}/games/${gameId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(r2Client, command, { expiresIn: 3600 });
  }

  /**
   * Get a presigned URL for direct download
   */
  static async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(r2Client, command, { expiresIn: 3600 });
  }

  /**
   * Delete all files for a user
   */
  static async deleteUserFiles(userId: number): Promise<void> {
    const files = await this.listFiles(userId);

    await Promise.all(
      files.map(key => this.deleteFile(key))
    );
  }

  /**
   * Upload to apps directory
   */
  static async uploadAppFile(
    userId: number,
    appId: string,
    fileName: string,
    fileContent: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const key = `users/${userId}/apps/${appId}/${fileName}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        userId: userId.toString(),
        appId: appId,
        uploadedAt: Date.now().toString(),
      },
    }));

    return key;
  }

  /**
   * Upload to custom files directory
   */
  static async uploadCustomFile(
    userId: number,
    fileName: string,
    fileContent: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const key = `users/${userId}/custom/${fileName}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        userId: userId.toString(),
        uploadedAt: Date.now().toString(),
      },
    }));

    return key;
  }

  /**
   * Create a complete backup ZIP for a user (all files)
   */
  static async createUserBackup(userId: number): Promise<Buffer> {
    const archiver = require('archiver');
    const { Readable } = require('stream');

    const files = await this.listFilesWithMetadata(userId);

    return new Promise(async (resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add each file to the archive
      for (const file of files) {
        try {
          const fileContent = await this.downloadFile(file.key);
          const fileName = file.key.replace(`users/${userId}/`, '');
          archive.append(fileContent, { name: fileName });
        } catch (error) {
          console.error(`Failed to add ${file.key} to backup:`, error);
        }
      }

      archive.finalize();
    });
  }
}
