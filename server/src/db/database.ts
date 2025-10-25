import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'cheapforce.db');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT NOT NULL,
    discord_avatar TEXT,
    created_at INTEGER NOT NULL,
    last_sync INTEGER,
    plan TEXT DEFAULT 'free',
    storage_used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    code TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS client_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sync_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    request_type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    processed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_auth_codes_discord_id ON auth_codes(discord_id);
  CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at);
  CREATE INDEX IF NOT EXISTS idx_client_sessions_user ON client_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sync_requests_user ON sync_requests(user_id, processed);
`);

// Migration: Add discord_avatar column if it doesn't exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN discord_avatar TEXT`);
} catch (error: any) {
  // Column already exists, ignore error
  if (!error.message.includes('duplicate column name')) {
    console.error('Migration error:', error);
  }
}

export type UserPlan = 'free' | 'plus' | 'premium';

export interface User {
  id: number;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  created_at: number;
  last_sync: number | null;
  plan: UserPlan;
  storage_used: number;
}

export const PLAN_LIMITS = {
  free: {
    name: 'CheapStorage Free',
    storage: 1 * 1024 * 1024 * 1024, // 1GB
    features: ['Game saves only']
  },
  plus: {
    name: 'CheapStorage+',
    storage: 10 * 1024 * 1024 * 1024, // 10GB
    features: ['Game saves', 'App data']
  },
  premium: {
    name: 'CheapStorage++',
    storage: 100 * 1024 * 1024 * 1024, // 100GB
    features: ['Game saves', 'App data', 'Custom files']
  }
} as const;

export interface AuthCode {
  code: string;
  discord_id: string;
  created_at: number;
  expires_at: number;
  used: number;
}

export interface ClientSession {
  id: string;
  user_id: number;
  created_at: number;
  last_seen: number;
}

export interface SyncRequest {
  id: number;
  user_id: number;
  request_type: 'sync' | 'pull';
  created_at: number;
  processed: number;
}

// User operations
export const userOps = {
  create: db.prepare(`
    INSERT INTO users (discord_id, discord_username, created_at)
    VALUES (?, ?, ?)
    RETURNING *
  `),

  findByDiscordId: db.prepare(`
    SELECT * FROM users WHERE discord_id = ?
  `),

  findById: db.prepare(`
    SELECT * FROM users WHERE id = ?
  `),

  updateLastSync: db.prepare(`
    UPDATE users SET last_sync = ? WHERE id = ?
  `),

  updateStorageUsed: db.prepare(`
    UPDATE users SET storage_used = ? WHERE id = ?
  `),

  updatePlan: db.prepare(`
    UPDATE users SET plan = ? WHERE id = ?
  `),

  getAllUsers: db.prepare(`
    SELECT * FROM users
  `)
};

// Auth code operations
export const authCodeOps = {
  create: db.prepare(`
    INSERT INTO auth_codes (code, discord_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `),

  findByCode: db.prepare(`
    SELECT * FROM auth_codes WHERE code = ? AND used = 0 AND expires_at > ?
  `),

  markUsed: db.prepare(`
    UPDATE auth_codes SET used = 1 WHERE code = ?
  `),

  deleteExpired: db.prepare(`
    DELETE FROM auth_codes WHERE expires_at < ?
  `)
};

// Session operations
export const sessionOps = {
  create: db.prepare(`
    INSERT INTO client_sessions (id, user_id, created_at, last_seen)
    VALUES (?, ?, ?, ?)
  `),

  findById: db.prepare(`
    SELECT * FROM client_sessions WHERE id = ?
  `),

  updateLastSeen: db.prepare(`
    UPDATE client_sessions SET last_seen = ? WHERE id = ?
  `),

  delete: db.prepare(`
    DELETE FROM client_sessions WHERE id = ?
  `)
};

// Sync request operations
export const syncRequestOps = {
  create: db.prepare(`
    INSERT INTO sync_requests (user_id, request_type, created_at)
    VALUES (?, ?, ?)
  `),

  findPending: db.prepare(`
    SELECT * FROM sync_requests WHERE user_id = ? AND processed = 0 ORDER BY created_at DESC
  `),

  markProcessed: db.prepare(`
    UPDATE sync_requests SET processed = 1 WHERE id = ?
  `),

  deleteOld: db.prepare(`
    DELETE FROM sync_requests WHERE created_at < ? AND processed = 1
  `)
};

// Clean up expired auth codes and old sync requests periodically
setInterval(() => {
  authCodeOps.deleteExpired.run(Date.now());
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  syncRequestOps.deleteOld.run(oneDayAgo);
}, 60000); // Every minute
