import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/auth';
import { savesRouter } from './routes/saves';
import { syncRequestsRouter } from './routes/sync-requests';
import { adminRouter } from './routes/admin';
import { discordAuth } from './auth/discord-auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/saves', savesRouter);
app.use('/api/sync-requests', syncRequestsRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Start Discord bot
async function start() {
  try {
    // Validate environment variables
    const required = [
      'DISCORD_BOT_TOKEN',
      'DISCORD_CHANNEL_ID',
      'R2_ENDPOINT',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }

    // Start Discord bot
    await discordAuth.start();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`\nCheapForce Cloud Server started!`);
      console.log(`- HTTP API: http://localhost:${PORT}`);
      console.log(`- Discord bot: Connected`);
      console.log(`\nReady to accept connections!\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
