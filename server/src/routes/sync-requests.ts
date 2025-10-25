import { Router, Request, Response } from 'express';
import { syncRequestOps, sessionOps, userOps, User, SyncRequest } from '../db/database';

export const syncRequestsRouter = Router();

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

syncRequestsRouter.use(requireAuth);

/**
 * GET /api/sync-requests/pending
 * Check for pending sync/pull requests
 */
syncRequestsRouter.get('/pending', async (req: Request, res: Response) => {
  const user = (req as any).user as User;

  try {
    const requests = syncRequestOps.findPending.all(user.id) as SyncRequest[];

    if (requests.length === 0) {
      return res.json({ requests: [] });
    }

    // Mark all as processed
    for (const request of requests) {
      syncRequestOps.markProcessed.run(request.id);
    }

    res.json({ requests });
  } catch (error) {
    console.error('Pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

/**
 * POST /api/sync-requests/complete
 * Notify server that a request was completed
 */
syncRequestsRouter.post('/complete', async (req: Request, res: Response) => {
  const { requestType, success } = req.body;
  const user = (req as any).user as User;

  try {
    // Could send Discord notification here
    console.log(`User ${user.id} completed ${requestType}: ${success ? 'success' : 'failed'}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Complete request error:', error);
    res.status(500).json({ error: 'Failed to process completion' });
  }
});
