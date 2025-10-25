import { Request, Response, NextFunction } from 'express';
import { sessionOps, userOps, User } from '../db/database';

/**
 * Middleware to verify the user is authenticated and is the admin
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  try {
    const session = sessionOps.findById.get(sessionId) as any;

    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = userOps.findById.get(session.user_id) as User;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is admin (using Discord admin ID from env)
    const adminId = process.env.DISCORD_ADMIN_ID;

    if (!adminId) {
      console.error('DISCORD_ADMIN_ID not set in environment variables');
      return res.status(500).json({ error: 'Admin system not configured' });
    }

    if (user.discord_id !== adminId) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Attach user to request for use in route handlers
    (req as any).user = user;

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
