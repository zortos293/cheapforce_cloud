import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/admin';
import fs from 'fs';
import path from 'path';

export const adminRouter = Router();

const APPS_CONFIG_PATH = path.join(__dirname, '../../../shared/apps-config.json');
const GAMES_CONFIG_PATH = path.join(__dirname, '../../../shared/games-config.json');

interface WatchPath {
  pattern: string;
  extensions: string[];
}

interface App {
  id: string;
  name: string;
  enabled: boolean;
  watchPaths: WatchPath[];
}

interface AppsConfig {
  $schema: string;
  apps: App[];
}

interface Game {
  id: string;
  name: string;
  enabled: boolean;
  watchPaths: WatchPath[];
}

interface GamesConfig {
  $schema: string;
  games: Game[];
}

/**
 * GET /api/admin/apps
 * Get all apps
 */
adminRouter.get('/apps', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = fs.readFileSync(APPS_CONFIG_PATH, 'utf-8');
    const config: AppsConfig = JSON.parse(data);

    res.json({
      success: true,
      apps: config.apps
    });
  } catch (error) {
    console.error('Error reading apps config:', error);
    res.status(500).json({ error: 'Failed to read apps configuration' });
  }
});

/**
 * GET /api/admin/games
 * Get all games
 */
adminRouter.get('/games', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = fs.readFileSync(GAMES_CONFIG_PATH, 'utf-8');
    const config: GamesConfig = JSON.parse(data);

    res.json({
      success: true,
      games: config.games
    });
  } catch (error) {
    console.error('Error reading games config:', error);
    res.status(500).json({ error: 'Failed to read games configuration' });
  }
});

/**
 * POST /api/admin/apps
 * Add a new app
 */
adminRouter.post('/apps', requireAdmin, async (req: Request, res: Response) => {
  const { id, name, enabled, watchPaths } = req.body;

  // Validation
  if (!id || !name || typeof enabled !== 'boolean' || !Array.isArray(watchPaths)) {
    return res.status(400).json({ error: 'Invalid app data' });
  }

  // Validate ID format (lowercase, hyphens only)
  if (!/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: 'ID must be lowercase letters, numbers, and hyphens only' });
  }

  // Validate watchPaths structure
  for (const wp of watchPaths) {
    if (!wp.pattern || typeof wp.pattern !== 'string' || !Array.isArray(wp.extensions)) {
      return res.status(400).json({ error: 'Invalid watchPath structure' });
    }
  }

  try {
    const data = fs.readFileSync(APPS_CONFIG_PATH, 'utf-8');
    const config: AppsConfig = JSON.parse(data);

    // Check if ID already exists
    if (config.apps.some(app => app.id === id)) {
      return res.status(400).json({ error: 'An app with this ID already exists' });
    }

    // Add new app
    const newApp: App = {
      id,
      name,
      enabled,
      watchPaths
    };

    config.apps.push(newApp);

    // Write back to file
    fs.writeFileSync(APPS_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    res.json({
      success: true,
      app: newApp
    });
  } catch (error) {
    console.error('Error adding app:', error);
    res.status(500).json({ error: 'Failed to add app' });
  }
});

/**
 * PUT /api/admin/apps/:id
 * Update an existing app
 */
adminRouter.put('/apps/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, enabled, watchPaths } = req.body;

  // Validation
  if (!name || typeof enabled !== 'boolean' || !Array.isArray(watchPaths)) {
    return res.status(400).json({ error: 'Invalid app data' });
  }

  // Validate watchPaths structure
  for (const wp of watchPaths) {
    if (!wp.pattern || typeof wp.pattern !== 'string' || !Array.isArray(wp.extensions)) {
      return res.status(400).json({ error: 'Invalid watchPath structure' });
    }
  }

  try {
    const data = fs.readFileSync(APPS_CONFIG_PATH, 'utf-8');
    const config: AppsConfig = JSON.parse(data);

    // Find app index
    const appIndex = config.apps.findIndex(app => app.id === id);

    if (appIndex === -1) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Update app (keep the same ID)
    config.apps[appIndex] = {
      id,
      name,
      enabled,
      watchPaths
    };

    // Write back to file
    fs.writeFileSync(APPS_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    res.json({
      success: true,
      app: config.apps[appIndex]
    });
  } catch (error) {
    console.error('Error updating app:', error);
    res.status(500).json({ error: 'Failed to update app' });
  }
});

/**
 * DELETE /api/admin/apps/:id
 * Delete an app
 */
adminRouter.delete('/apps/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const data = fs.readFileSync(APPS_CONFIG_PATH, 'utf-8');
    const config: AppsConfig = JSON.parse(data);

    // Find app index
    const appIndex = config.apps.findIndex(app => app.id === id);

    if (appIndex === -1) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Remove app
    config.apps.splice(appIndex, 1);

    // Write back to file
    fs.writeFileSync(APPS_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    res.json({
      success: true,
      message: 'App deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting app:', error);
    res.status(500).json({ error: 'Failed to delete app' });
  }
});

/**
 * POST /api/admin/games
 * Add a new game
 */
adminRouter.post('/games', requireAdmin, async (req: Request, res: Response) => {
  const { id, name, enabled, watchPaths } = req.body;

  // Validation
  if (!id || !name || typeof enabled !== 'boolean' || !Array.isArray(watchPaths)) {
    return res.status(400).json({ error: 'Invalid game data' });
  }

  // Validate ID format (lowercase, hyphens only)
  if (!/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: 'ID must be lowercase letters, numbers, and hyphens only' });
  }

  // Validate watchPaths structure
  for (const wp of watchPaths) {
    if (!wp.pattern || typeof wp.pattern !== 'string' || !Array.isArray(wp.extensions)) {
      return res.status(400).json({ error: 'Invalid watchPath structure' });
    }
  }

  try {
    const data = fs.readFileSync(GAMES_CONFIG_PATH, 'utf-8');
    const config: GamesConfig = JSON.parse(data);

    // Check if ID already exists
    if (config.games.some(game => game.id === id)) {
      return res.status(400).json({ error: 'A game with this ID already exists' });
    }

    // Add new game
    const newGame: Game = {
      id,
      name,
      enabled,
      watchPaths
    };

    config.games.push(newGame);

    // Write back to file
    fs.writeFileSync(GAMES_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    res.json({
      success: true,
      game: newGame
    });
  } catch (error) {
    console.error('Error adding game:', error);
    res.status(500).json({ error: 'Failed to add game' });
  }
});

/**
 * PUT /api/admin/games/:id
 * Update an existing game
 */
adminRouter.put('/games/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, enabled, watchPaths } = req.body;

  // Validation
  if (!name || typeof enabled !== 'boolean' || !Array.isArray(watchPaths)) {
    return res.status(400).json({ error: 'Invalid game data' });
  }

  // Validate watchPaths structure
  for (const wp of watchPaths) {
    if (!wp.pattern || typeof wp.pattern !== 'string' || !Array.isArray(wp.extensions)) {
      return res.status(400).json({ error: 'Invalid watchPath structure' });
    }
  }

  try {
    const data = fs.readFileSync(GAMES_CONFIG_PATH, 'utf-8');
    const config: GamesConfig = JSON.parse(data);

    // Find game index
    const gameIndex = config.games.findIndex(game => game.id === id);

    if (gameIndex === -1) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Update game (keep the same ID)
    config.games[gameIndex] = {
      id,
      name,
      enabled,
      watchPaths
    };

    // Write back to file
    fs.writeFileSync(GAMES_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    res.json({
      success: true,
      game: config.games[gameIndex]
    });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

/**
 * DELETE /api/admin/games/:id
 * Delete a game
 */
adminRouter.delete('/games/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const data = fs.readFileSync(GAMES_CONFIG_PATH, 'utf-8');
    const config: GamesConfig = JSON.parse(data);

    // Find game index
    const gameIndex = config.games.findIndex(game => game.id === id);

    if (gameIndex === -1) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Remove game
    config.games.splice(gameIndex, 1);

    // Write back to file
    fs.writeFileSync(GAMES_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    res.json({
      success: true,
      message: 'Game deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});
