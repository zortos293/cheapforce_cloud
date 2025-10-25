import { Router, Request, Response } from 'express';
import { R2Storage } from '../storage/r2-storage';
import { sessionOps, userOps, User } from '../db/database';
import multer from 'multer';
import archiver from 'archiver';
import { Readable } from 'stream';

export const savesRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
  },
});

/**
 * Middleware to verify session and attach user
 */
async function requireAuth(req: Request, res: Response, next: Function) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  const session = sessionOps.findById.get(sessionId) as any;

  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const user = userOps.findById.get(session.user_id) as User;
  (req as any).user = user;

  // Update last seen
  sessionOps.updateLastSeen.run(Date.now(), sessionId);

  next();
}

savesRouter.use(requireAuth);

/**
 * POST /api/saves/upload
 * Upload game saves (supports multiple files)
 */
savesRouter.post('/upload', upload.array('files', 50), async (req: Request, res: Response) => {
  const { gameId } = req.body;
  const files = req.files as Express.Multer.File[];
  const user = (req as any).user as User;

  if (!gameId || !files || files.length === 0) {
    return res.status(400).json({ error: 'Missing gameId or files' });
  }

  try {
    const uploadedKeys = await Promise.all(
      files.map(file =>
        R2Storage.uploadFile(
          user.id,
          gameId,
          file.originalname,
          file.buffer,
          file.mimetype
        )
      )
    );

    // Update last sync time
    userOps.updateLastSync.run(Date.now(), user.id);

    res.json({
      success: true,
      uploaded: uploadedKeys.length,
      keys: uploadedKeys
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/saves/list
 * List all saves for a user (optionally filtered by game)
 */
savesRouter.get('/list', async (req: Request, res: Response) => {
  const { gameId } = req.query;
  const user = (req as any).user as User;

  try {
    const files = await R2Storage.listFiles(
      user.id,
      gameId as string | undefined
    );

    // Parse file keys to extract metadata
    const saves = files.map(key => {
      const parts = key.split('/');
      return {
        key,
        gameId: parts[3],
        fileName: parts.slice(4).join('/'),
      };
    });

    res.json({ saves });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list saves' });
  }
});

/**
 * GET /api/saves/download/:gameId
 * Download all saves for a specific game as a zip
 */
savesRouter.get('/download/:gameId', async (req: Request, res: Response) => {
  const { gameId } = req.params;
  const user = (req as any).user as User;

  try {
    const files = await R2Storage.listFiles(user.id, gameId);

    if (files.length === 0) {
      return res.status(404).json({ error: 'No saves found for this game' });
    }

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`${gameId}-saves.zip`);
    archive.pipe(res);

    // Add each file to the archive
    for (const key of files) {
      const fileContent = await R2Storage.downloadFile(key);
      const fileName = key.split('/').slice(4).join('/');
      archive.append(fileContent, { name: fileName });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

/**
 * GET /api/saves/download-url/:gameId/:fileName
 * Get a presigned download URL for a specific file
 */
savesRouter.get('/download-url/:gameId/:fileName', async (req: Request, res: Response) => {
  const { gameId, fileName } = req.params;
  const user = (req as any).user as User;

  try {
    const key = `users/${user.id}/games/${gameId}/${fileName}`;
    const url = await R2Storage.getDownloadUrl(key);

    res.json({ url });
  } catch (error) {
    console.error('Download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * DELETE /api/saves/:gameId
 * Delete all saves for a specific game
 */
savesRouter.delete('/:gameId', async (req: Request, res: Response) => {
  const { gameId } = req.params;
  const user = (req as any).user as User;

  try {
    const files = await R2Storage.listFiles(user.id, gameId);

    await Promise.all(files.map(key => R2Storage.deleteFile(key)));

    res.json({ success: true, deleted: files.length });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});
