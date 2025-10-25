# CheapForce Cloud

A cloud storage system for automatically backing up game and app saves to Cloudflare R2, with Discord authentication for linking clients to accounts.

## Features

- **User Plans**: Three tiers (Free 1GB / Plus 10GB / Premium 100GB) with different features
- **Storage Management**: ASCII progress bar in Discord showing quota usage
- **Batched Sync**: Changes detected in real-time, uploaded every 5 minutes to minimize R2 requests
- **Discord Commands**: Control sync/pull remotely via Discord (`/sync`, `/pull`, `/storage`, `/backup`)
- **Discord Authentication**: Simple 6-digit code linking system via Discord bot
- **Complete Backups**: Download all your files as ZIP via Discord command
- **Multi-Type Support**: Games (all plans), Apps (Plus+), Custom Files (Premium)
- **Cross-Platform**: Supports Windows, macOS, and Linux
- **Efficient Storage**: Uses Cloudflare R2 (S3-compatible) for cost-effective cloud storage
- **Easy Configuration**: JSON-based configuration system
- **Restore Saves**: Download and restore your saves to any device
- **Real-time Monitoring**: File changes are tracked continuously, synced on schedule or on-demand

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │────────▶│   Server    │────────▶│Cloudflare R2│
│ (Your PC)   │◀────────│  (Node.js)  │◀────────│  (Storage)  │
└─────────────┘         └─────────────┘         └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │Discord Bot  │
                        │   (Auth)    │
                        └─────────────┘
```

## Prerequisites

- Node.js 18+ and npm
- A Discord bot token
- Cloudflare R2 account (or any S3-compatible storage)

## Setup

### 1. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" tab and create a bot
4. Copy the bot token
5. Enable "Message Content Intent" in bot settings
6. Invite the bot to your server with the following permissions:
   - Send Messages
   - Embed Links
   - Read Messages/View Channels

### 2. Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 Object Storage
3. Create a new bucket (e.g., `cheapforce-cloud-saves`)
4. Create an API token:
   - Go to "Manage R2 API Tokens"
   - Create a new token with "Edit" permissions
   - Save the Access Key ID and Secret Access Key
5. Note your R2 endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)

### 3. Server Setup

```bash
cd server
npm install

# Copy environment template
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_for_link_codes

# Cloudflare R2 Configuration
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=cheapforce-cloud-saves

# Server Configuration
PORT=3000
```

Start the server:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

### 4. Client Setup

```bash
cd client
npm install

# Copy environment template
cp .env.example .env
```

Edit `.env`:

```env
SERVER_URL=http://localhost:3000
```

If your server is on a different machine or port, update the URL accordingly.

Start the client:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

## Usage

### First Time Setup

1. **Start the server** (it should connect to Discord)
2. **Run the client** on your gaming PC
3. When prompted, use the `/link` command in your Discord server
4. The bot will send you a 6-digit code
5. Enter this code in the client to link your account

### Auto-Sync Mode

Once linked, select "Start Auto-Sync" from the client menu:

1. The client will detect installed games from the configuration
2. It will start monitoring their save directories
3. File changes are tracked in real-time
4. **Saves are uploaded every 5 minutes** (only if changes were detected)
5. Leave the client running in the background for continuous backup

### Discord Commands

Control your backups remotely from Discord:

**User Commands:**
- **`/link`** - Get a 6-digit code to link your client
- **`/sync`** - Force your client to upload all saves immediately (bypasses 5-minute timer)
- **`/pull`** - Force your client to download the latest saves from cloud
- **`/storage`** - View storage usage with ASCII progress bar
- **`/backup`** - Download complete backup as ZIP (or presigned URL if > 25MB)

**Admin Commands:**
- **`/setplan <user> <plan>`** - Set user's plan (free/plus/premium)

The client checks for Discord commands every 10 seconds when running in auto-sync mode.

See [PLANS.md](PLANS.md) for detailed plan information.

### Restore Saves

To restore saves on another device or after reinstalling:

1. Install and link the client
2. Select "Restore Saves" from the menu
3. Choose the game you want to restore
4. Select the target directory (default is the game's save location)
5. Your saves will be downloaded and extracted

## Adding New Games/Apps

Edit `shared/games-config.json` to add new games:

```json
{
  "games": [
    {
      "id": "your-game-id",
      "name": "Your Game Name",
      "enabled": true,
      "paths": [
        {
          "platform": "windows",
          "path": "%APPDATA%/YourGame/Saves",
          "type": "directory"
        },
        {
          "platform": "darwin",
          "path": "~/Library/Application Support/YourGame/Saves",
          "type": "directory"
        },
        {
          "platform": "linux",
          "path": "~/.local/share/YourGame/Saves",
          "type": "directory"
        }
      ]
    }
  ]
}
```

### Path Variables

You can use environment variables in paths:

- Windows: `%APPDATA%`, `%USERPROFILE%`, `%LOCALAPPDATA%`
- Unix: `~` (home directory), `$HOME`, `${HOME}`

### Finding Save Locations

Common save locations:

**Windows:**
- `%APPDATA%` - C:\Users\YourName\AppData\Roaming
- `%LOCALAPPDATA%` - C:\Users\YourName\AppData\Local
- `%USERPROFILE%\Documents` - C:\Users\YourName\Documents

**macOS:**
- `~/Library/Application Support/`
- `~/Library/Containers/`
- `~/Documents/`

**Linux:**
- `~/.config/`
- `~/.local/share/`
- `~/Documents/`

Check [PCGamingWiki](https://www.pcgamingwiki.com/) for specific game save locations.

## API Endpoints

### Authentication

- `POST /api/auth/link` - Link client with Discord account using 6-digit code
- `GET /api/auth/verify` - Verify session is valid
- `POST /api/auth/logout` - Logout and invalidate session

### Saves Management

- `POST /api/saves/upload` - Upload game saves (multipart/form-data)
- `GET /api/saves/list?gameId=<id>` - List all saves (optionally filtered by game)
- `GET /api/saves/download/:gameId` - Download all saves for a game as ZIP
- `GET /api/saves/download-url/:gameId/:fileName` - Get presigned download URL
- `DELETE /api/saves/:gameId` - Delete all saves for a game

### Sync Requests

- `GET /api/sync-requests/pending` - Check for pending sync/pull requests from Discord
- `POST /api/sync-requests/complete` - Notify server that a request was completed

## Project Structure

```
cheapforce_cloud/
├── server/                 # Backend server
│   ├── src/
│   │   ├── auth/          # Discord authentication
│   │   ├── storage/       # R2 storage integration
│   │   ├── routes/        # API routes
│   │   ├── db/            # SQLite database
│   │   └── index.ts       # Server entry point
│   └── package.json
├── client/                 # Desktop client
│   ├── src/
│   │   ├── api.ts         # API client
│   │   ├── watcher.ts     # File system watcher
│   │   ├── sync.ts        # Sync manager
│   │   └── index.ts       # Client entry point
│   └── package.json
├── shared/
│   └── games-config.json  # Game configurations
└── README.md
```

## How It Works

### Authentication Flow

1. User runs `/link` command in Discord
2. Discord bot generates a 6-digit code valid for 15 minutes
3. Code is sent to user via Discord message
4. User enters code in client application
5. Server verifies code and creates a session
6. Client stores session token for future requests

### File Monitoring & Sync

1. Client watches configured game save directories using `chokidar`
2. When files change, they are marked as "pending sync"
3. **Every 5 minutes**, if pending changes exist, all files are collected and uploaded
4. Files are stored in R2 with path: `users/{userId}/games/{gameId}/{fileName}`
5. Server tracks last sync time for each user

### Discord Command Flow

1. User types `/sync` or `/pull` in Discord
2. Discord bot stores request in database with user ID
3. Client polls server every 10 seconds for pending requests
4. When request found, client executes sync/pull immediately
5. Client notifies server when complete

### Storage Optimization

- **5-minute batching** minimizes R2 API requests (free tier friendly!)
- Only uploads when changes are detected (no unnecessary syncs)
- Files are uploaded directly to R2 (no intermediate storage)
- Compression is used for HTTP transfers
- Presigned URLs can be used for large file downloads

## Security Considerations

- Session tokens are stored locally in `~/.cheapforce-cloud/session.json`
- Discord auth codes expire after 15 minutes
- All API endpoints require valid session authentication
- R2 access is restricted to server only (credentials not exposed to client)

## Performance Tips

1. **For large saves**: The system handles files up to 100MB per file
2. **Sync interval**: Default is 5 minutes - adjust `SYNC_INTERVAL_MS` in `watcher.ts` if needed
3. **Request polling**: Client checks for Discord commands every 10 seconds - adjust in `index.ts`
4. **Storage costs**: R2 has no egress fees, only storage costs (~$0.015/GB/month)
5. **API optimization**: Batched uploads reduce R2 Class A operations (list/write)

## Troubleshooting

### Client can't connect to server

- Ensure server is running and accessible
- Check `SERVER_URL` in client `.env`
- Verify firewall settings

### Discord bot not responding

- Verify bot token is correct
- Ensure bot is in the server
- Check bot has required permissions
- Make sure Message Content Intent is enabled

### Files not syncing

- Check if game paths exist on your system
- Verify game is enabled in `games-config.json`
- Look for errors in client console
- Ensure you have write permissions to the save directory

### R2 upload failures

- Verify R2 credentials are correct
- Check bucket name matches configuration
- Ensure R2 endpoint URL is correct
- Verify API token has edit permissions

## Future Enhancements

- Conflict resolution for multi-device syncing
- Incremental/delta sync for large saves
- Web dashboard for managing saves
- Compression for save files
- Version history and rollback
- Share saves with friends

## License

MIT

## Contributing

Feel free to submit issues and pull requests!
