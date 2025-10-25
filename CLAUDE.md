# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CheapForce Cloud is a cloud storage system for backing up game/app saves to Cloudflare R2, with Discord authentication for linking clients to accounts. It consists of three main components:

1. **Server** (Express.js + Discord.js): HTTP API and Discord bot
2. **Client** (Electron GUI + Node.js background service): **Windows-only** desktop app with GUI for authentication/welcome, then runs as background daemon
3. **Shared**: Configuration files for games/apps

**Important**:
- The client is a **Windows-only** application
- Uses Electron for GUI windows during authentication and welcome
- Runs silently in the background with a Windows system tray icon
- All ongoing control happens via Discord bot commands

## Development Commands

### Server

```bash
cd server

# Development (auto-reload)
npm run dev

# Register Discord slash commands (required before first run)
npm run register-commands

# Build for production
npm run build

# Start production
npm start
```

### Client

```bash
cd client

# Install dependencies
npm install

# Development (Electron GUI mode)
npm run dev:electron

# Build TypeScript
npm run build

# Start production (Electron GUI)
npm start

# Package as executable (creates installers for your platform)
npm run package
```

## Architecture Overview

### Authentication Flow

1. User runs `/link` in Discord → bot sends 6-digit code to channel (15-minute expiry)
2. Client prompts user on startup: "Enter your 6-digit linking code"
3. User copies code from Discord and enters it in client
4. Server validates code and creates session
5. **Server returns user object with Discord info**:
   - `sessionId`: Session token
   - `user.id`: Internal user ID
   - `user.username`: Discord username
   - `user.avatar`: Discord avatar URL or hash
   - `user.discriminator`: Discord discriminator (if applicable)
   - `user.plan`: Current plan (free/plus/premium)
6. Client displays welcome message with Discord username and avatar
7. Session stored in `~/.cheapforce-cloud/session.json`
8. All API requests require session token in Authorization header

**Important**: The link code is posted in the Discord channel (DISCORD_CHANNEL_ID), not sent via DM.

### File Sync Architecture

**Client-side (background service):**
- Auto-sync is ALWAYS enabled at startup (no user choice)
- `FileWatcher` (watcher.ts) uses `chokidar` to monitor directories
- Changes marked as "pending sync" in memory
- Every 5 minutes, if pending changes exist, trigger sync
- `SyncManager` (sync.ts) collects all files and uploads via multipart form data
- Runs silently in background, no UI/menu
- All control via Discord bot commands

**Server-side:**
- Files uploaded to R2 at `users/{userId}/games/{gameId}/{fileName}`
- Storage quota checked before each upload (plan-based limits)
- Database tracks `storage_used` and `last_sync` per user

### Discord Command System

All client control happens through Discord bot commands. The client has NO interactive menu.

**Available commands:**
- `/link` - Generate linking code for new client
- `/sync` - Force immediate upload of all saves
- `/pull` - Force download and restore latest saves
- `/storage` - View storage usage and quota
- `/backup` - Download complete backup as ZIP
- `/list` - List all saved files (to be implemented)
- `/setplan` - Change user plan (owner only)

**Flow:**
1. User runs command (e.g., `/sync`) in Discord
2. Bot stores request in `sync_requests` table with user_id
3. Client polls `/api/sync-requests/pending` every 10 seconds
4. Client executes action (force sync/pull) silently in background
5. Client calls `/api/sync-requests/complete` to mark done
6. Bot sends confirmation message to Discord channel

### Plan System

Three tiers with different features:
- **Free (1GB)**: Games only (apps and custom files are blocked)
- **Plus (10GB)**: Games + Apps (custom files blocked)
- **Premium (100GB)**: Games + Apps + Custom files (all features)

Plans stored in `users.plan` column. The `canUseFeature()` function in `storage-utils.ts` enforces feature restrictions. Client detects plan via `/api/auth/verify` and adjusts watched directories accordingly.

**Plan changes**: Only the server owner (DISCORD_ADMIN_ID in .env) can use `/setplan` to change user plans. Regular users cannot upgrade themselves.

## Key Files & Responsibilities

### Server (`server/src/`)

- **index.ts**: Express app setup, Discord bot initialization, environment validation
- **db/database.ts**: SQLite schema and prepared statements (users, auth_codes, client_sessions, sync_requests)
  - `users` table stores: discord_id, discord_username, **discord_avatar**, plan, storage_used
- **auth/discord-auth.ts**: Discord bot, slash commands, link code generation
  - When creating/updating user, fetch Discord user info via Discord API
  - Store avatar hash, construct full URL: `https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png`
- **storage/r2-storage.ts**: S3 client wrapper for Cloudflare R2 operations
- **routes/auth.ts**: `/link`, `/verify`, `/logout` endpoints
  - `/link` endpoint returns Discord user info (username, avatar) on successful authentication
  - `/verify` endpoint returns updated user info for session validation
- **routes/saves.ts**: Upload, download, list, delete save files
- **routes/sync-requests.ts**: Pending/complete endpoints for Discord commands
- **utils/storage-utils.ts**: Quota checking, progress bar generation, backup ZIP creation

### Client (`client/src/`)

- **electron-main.ts**: Electron main process entry point
  - Initializes Electron app
  - Creates system tray icon with context menu
  - Starts the CheapForceClient
- **index.ts**: Main client logic (exported as CheapForceClient class)
  - Authentication flow with GUI
  - Auto-sync startup
  - Background daemon loop
  - Discord command polling
- **api.ts**: HTTP client with session management and automatic token injection
  - Handles receiving and storing Discord user info from server
- **watcher.ts**: Chokidar wrapper, file change tracking, 5-minute batch timer
- **sync.ts**: Upload/download logic, multipart form handling
- **gui/gui-manager.ts**: Electron window management
  - Creates and manages link code window
  - Creates and manages welcome window
  - Handles IPC communication
- **gui/preload.ts**: Electron preload script for secure IPC
- **gui/link-code.html**: Link code input UI
  - Beautiful gradient design
  - Instructions for using /link command
  - Auto-submit when 6 digits entered
  - Error handling
- **gui/welcome.html**: Welcome screen UI
  - Displays Discord avatar (circular with status badge)
  - Shows username and plan
  - Auto-closes after 3 seconds
  - Starting background sync indicator

**Note**:
- Client is an Electron app with GUI windows for authentication/welcome
- First run shows BLOCKING link code window until code is entered
- After authentication, displays welcome window with Discord avatar and info
- Welcome window auto-closes after 3 seconds
- Client then runs in background with system tray icon
- No interactive menu - all control via Discord commands

### Shared (`shared/`)

- **games-config.json**: Game definitions with Windows glob patterns and extension filters
  - Each game has `watchPaths` array with `pattern` and `extensions`
  - Supports glob wildcards: `*` and `**`
  - Extension filtering per path
  - Examples: Minecraft, Terraria, Stardew Valley, Elden Ring, Dark Souls III, Skyrim
- **apps-config.json**: Application definitions with same pattern structure
  - Examples: VS Code, Obsidian, Notion, Discord Settings

## Important Patterns

### Path Resolution & Glob Patterns (Windows)

Games/apps use a flexible path pattern system with:
- **Windows environment variables** (expanded at runtime)
- **Glob patterns** for matching multiple directories
- **File extension filtering** for specific file types

**Environment Variables:**
- `%APPDATA%` → C:\Users\{Username}\AppData\Roaming
- `%USERPROFILE%` → C:\Users\{Username}
- `%LOCALAPPDATA%` → C:\Users\{Username}\AppData\Local

**Glob Pattern Examples:**
```json
{
  "id": "game-name",
  "name": "Game Name",
  "enabled": true,
  "watchPaths": [
    {
      "pattern": "%APPDATA%/GameName/saves",
      "extensions": [".dat", ".json"]
    },
    {
      "pattern": "%LOCALAPPDATA%/GameName/*/profiles",
      "extensions": [".sav"]
    },
    {
      "pattern": "%USERPROFILE%/Documents/My Games/GameName",
      "extensions": [".ess", ".bak"]
    }
  ]
}
```

**Pattern Features:**
- `*` - Matches any characters within a directory name
- `**` - Matches any number of directories (recursive)
- Multiple `watchPaths` per game/app for different locations
- Each path can have its own extension filter
- Empty string `""` in extensions matches files with no extension

**Extension Filtering:**
- Only files with specified extensions are watched and synced
- Reduces unnecessary syncing of temporary/cache files
- Example: `[".dat", ".json", ""]` - watches .dat, .json, and files with no extension

## Adding New Games/Apps

To add support for a new game or app, edit the appropriate config file in `shared/` directory.

### Adding a Game (`shared/games-config.json`)

```json
{
  "id": "your-game-id",
  "name": "Your Game Name",
  "enabled": true,
  "watchPaths": [
    {
      "pattern": "%APPDATA%/YourGame/Saves",
      "extensions": [".sav", ".dat", ".json"]
    },
    {
      "pattern": "%LOCALAPPDATA%/YourGame/*/profiles",
      "extensions": [".xml"]
    }
  ]
}
```

### Pattern Examples

**Single directory:**
```json
"pattern": "%APPDATA%/GameName/saves"
```

**Wildcard for user profiles:**
```json
"pattern": "%APPDATA%/GameName/*/saves"
// Matches: GameName/user1/saves, GameName/user2/saves, etc.
```

**Specific file in multiple locations:**
```json
"pattern": "%APPDATA%/GameName/*/save.dat"
```

**Multiple watchPaths for different locations:**
```json
"watchPaths": [
  {
    "pattern": "%USERPROFILE%/Documents/My Games/Game/Players",
    "extensions": [".plr", ".bak"]
  },
  {
    "pattern": "%USERPROFILE%/Documents/My Games/Game/Worlds",
    "extensions": [".wld", ".bak"]
  }
]
```

### Extension Filter Examples

```json
// Only specific file types
"extensions": [".dat", ".json"]

// Include files with no extension
"extensions": [".sav", ""]

// All files (no filter - use with caution)
"extensions": []
```

### Finding Game Save Locations

1. Check [PCGamingWiki](https://www.pcgamingwiki.com/) for the game
2. Common Windows locations:
   - `%APPDATA%` (C:\Users\{User}\AppData\Roaming)
   - `%LOCALAPPDATA%` (C:\Users\{User}\AppData\Local)
   - `%USERPROFILE%\Documents` (C:\Users\{User}\Documents)
   - `%USERPROFILE%\Saved Games` (C:\Users\{User}\Saved Games)
3. Look for save file extensions (.sav, .dat, .ess, .sl2, etc.)
4. Create patterns with wildcards for multi-user/profile directories
5. Add extension filter to exclude cache/temp files

### Storage Quota Enforcement

Before every upload in `saves.ts`:
1. Get current `storage_used` from database
2. Calculate new total: `current + upload_size`
3. Compare against plan limit from `PLAN_LIMITS`
4. Reject with 402 if over quota

### Session Management

- Sessions stored in SQLite with `last_seen` timestamp
- Client automatically loads session from `~/.cheapforce-cloud/session.json`
- Session file contains:
  - `sessionId`: Token for API authentication
  - `user`: Discord user object (id, username, avatar, plan)
- Session token sent as `Authorization: Bearer <token>` header
- Server validates session on protected routes
- `/api/auth/verify` endpoint returns updated user info including Discord avatar

### File Upload Format

Client sends multipart form data with:
- `gameId`: string identifier
- `files`: array of files with preserved directory structure

Server reconstructs paths in R2: `users/{userId}/games/{gameId}/{relativePath}`

## Testing Changes

1. **Start server**: `cd server && npm run dev`
2. **Register commands**: `npm run register-commands` (if Discord commands changed)
3. **Start client**: `cd client && npm run dev:electron`
4. **Link account (first run only)**:
   - Client opens **BLOCKING GUI window** with link code input
   - Window will NOT close until you enter a valid code
   - In Discord, run `/link` command
   - Bot posts code to channel (DISCORD_CHANNEL_ID)
   - Copy the 6-digit code from Discord
   - Paste into the GUI window (or type it)
   - Window auto-submits when 6 digits are entered
   - On success: link window closes, welcome window appears
   - Welcome window shows your Discord avatar and info
   - After 3 seconds, welcome window closes
   - Client runs in background with system tray icon
5. **Test sync**: Modify a game save file, wait for sync or use `/sync` command
6. **Stop client**:
   - Right-click system tray icon → Exit
   - Or close from Electron window (if dev tools open)
   - Or Alt+F4

### Client Startup Behavior

**First run (no session) - GUI LINK WINDOW**:
- Electron app launches
- **Opens GUI window**: Link code input screen
  - Beautiful gradient design
  - Shows instructions for `/link` command
  - Input field for 6-digit code
  - "Link Account" button
- **Window BLOCKS until user enters valid code**
- User workflow:
  1. Run `/link` in Discord server
  2. Copy the 6-digit code from Discord channel
  3. Type/paste code into GUI window
  4. Press Enter or click "Link Account" (auto-submits at 6 digits)
  5. Client validates code with server via API
- Once linked successfully:
  - Receives Discord user info (username, avatar URL, plan)
  - Saves session to `~/.cheapforce-cloud/session.json`
  - Link window closes
  - **Welcome window appears**:
    - Displays circular Discord avatar with status badge
    - Shows "Welcome, {username}!"
    - Displays plan badge (Free/Plus/Premium)
    - Shows "Starting background sync..." with spinner
    - Auto-closes after 3-second countdown
  - **System tray icon appears**
  - **Auto-sync starts in background**
  - No menu, no further prompts

**Subsequent runs (session exists) - GUI WELCOME ONLY**:
- Electron app launches
- Loads session from `~/.cheapforce-cloud/session.json`
- Verifies session with server (gets updated Discord info)
- **Opens GUI welcome window**:
  - Displays "Welcome back, {username}!" + avatar
  - Shows current plan and auto-sync status
  - Auto-closes after 3 seconds
- **System tray icon appears**
- **Immediately starts auto-sync in background**
- Continues running until quit from tray icon

**Background operation (Windows)**:
- Runs silently with only Windows system tray icon visible
- No console window (GUI app)
- Monitors game/app directories continuously
- Uploads changes every 5 minutes (if any detected)
- Polls for Discord commands every 10 seconds
- Executes Discord commands (`/sync`, `/pull`) when received
- Logs activity to console (visible in dev mode only)
- Stays running until "Exit" from tray menu

## Environment Variables

### Server (.env)

Required:
- `DISCORD_BOT_TOKEN`: Bot token from Discord Developer Portal
- `DISCORD_CHANNEL_ID`: Channel ID for link code messages
- `R2_ENDPOINT`: Cloudflare R2 endpoint URL
- `R2_ACCESS_KEY_ID`: R2 API token access key
- `R2_SECRET_ACCESS_KEY`: R2 API token secret key
- `R2_BUCKET_NAME`: R2 bucket name

Optional:
- `PORT`: Server port (default: 3000)
- `DISCORD_CLIENT_ID`: Application ID for command registration
- `DISCORD_GUILD_ID`: Server ID for guild-specific commands
- `DISCORD_ADMIN_ID`: Owner user ID for `/setplan` command (only this user can change plans)

### Client (.env)

Required:
- `SERVER_URL`: Server URL (e.g., `http://localhost:3000`)

## Client GUI Architecture (Windows Only)

The client uses Electron for Windows GUI:

**Electron Main Process** (`electron-main.ts`):
- Manages app lifecycle
- Creates Windows system tray icon
- Starts CheapForceClient instance
- Handles app quit events
- Sets Windows app user model ID for proper taskbar integration

**GUI Windows**:
1. **Link Code Window** (`link-code.html`):
   - Shows on first run when no session exists
   - BLOCKS until user enters 6-digit code
   - Beautiful gradient design with instructions
   - Auto-submits when 6 digits are entered
   - Validates code via IPC to main process
   - Closes on successful authentication

2. **Welcome Window** (`welcome.html`):
   - Shows after successful authentication
   - Displays Discord avatar (fetched from CDN)
   - Shows username, plan badge, and auto-sync status
   - Auto-closes after 3-second countdown
   - Animated entrance with smooth transitions

**Windows System Tray**:
- Icon shows in Windows system tray (notification area)
- Right-click menu shows:
  - Status: Running
  - Auto-Sync: Enabled
  - Open Discord (opens browser)
  - Exit (quits app)
- Double-click tray icon opens Discord
- Stays in tray even when all windows are closed

**Background Operation**:
- After GUI windows close, client runs silently
- No console window (runs as GUI app)
- Monitors files and syncs every 5 minutes
- Polls for Discord commands every 10 seconds
- Stays running until "Exit" from tray menu

**Packaging**:
- `npm run package` creates Windows installer:
  - **NSIS installer** (.exe) for Windows x64
  - Includes desktop shortcut
  - Includes Start Menu shortcut
  - Allows custom installation directory
  - Installer includes all dependencies
- Can be configured to run on Windows startup

## Common Issues

### Discord bot not responding

- Ensure `DISCORD_BOT_TOKEN` is correct
- Enable "Message Content Intent" in Discord Developer Portal
- Run `npm run register-commands` to register slash commands
- Check bot has proper permissions in server

### Files not syncing

- Verify game paths exist on the Windows system
- Check game is enabled in `shared/games-config.json`
- Ensure user plan allows the content type (games/apps/custom)
- Check client console for errors (if visible in dev mode)
- Verify client is running: Check Windows Task Manager for "CheapForce Cloud"
- Check system tray icon is visible

### Storage quota exceeded

- Use `/storage` command in Discord to check usage
- Owner can upgrade plan: `/setplan @user <free|plus|premium>`
- Delete old saves via `/api/saves/:gameId` endpoint

### Client not responding to Discord commands

- Check client is running and connected to server
- Verify polling is working (check server logs)
- Ensure session hasn't expired (restart client if needed)
