import { Router, Request, Response } from 'express';
import { discordAuth } from '../auth/discord-auth';
import { sessionOps, userOps, User } from '../db/database';
import crypto from 'crypto';

export const authRouter = Router();

/**
 * POST /api/auth/link
 * Client submits a 6-digit code to link with Discord account
 */
authRouter.post('/link', async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string' || code.length !== 6) {
    return res.status(400).json({ error: 'Invalid code format' });
  }

  try {
    // Verify the code
    const result = discordAuth.verifyLinkingCode(code);

    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // Get or create user with Discord info
    const user = discordAuth.getOrCreateUser(result.discordId, result.discordUsername, result.discordAvatar);

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    sessionOps.create.run(sessionId, user.id, now, now);

    res.json({
      success: true,
      sessionId,
      user: {
        id: user.id,
        username: user.discord_username,
        avatar: user.discord_avatar || null,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('Link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/verify
 * Verify if a session is still valid
 */
authRouter.get('/verify', async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  try {
    const session = sessionOps.findById.get(sessionId) as any;

    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Update last seen
    sessionOps.updateLastSeen.run(Date.now(), sessionId);

    const user = userOps.findById.get(session.user_id) as User;

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.discord_username,
        avatar: user.discord_avatar || null,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate a session
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  try {
    sessionOps.delete.run(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
