# Changelog

## [1.2.0] - User Plans & Storage Management

### Added

#### User Plans System
- **Three tiers**: Free (1GB), Plus (10GB), Premium (100GB)
- Plan-based feature access:
  - Free: Game saves only
  - Plus: Game saves + app data
  - Premium: Games + apps + custom files
- Storage quota tracking per user
- Database migration to add plan and storage_used fields

#### Discord Storage Commands
- **`/storage` command**: Beautiful ASCII progress bar showing quota usage
  - Color-coded indicators (🟢 🟡 🔴)
  - Real-time storage calculation
  - Shows used, total, available, and percentage
- **`/backup` command**: Download complete backup as ZIP
  - Files < 25MB: Direct Discord attachment
  - Files > 25MB: Presigned R2 URL (1 hour validity)
  - Creates on-demand ZIP of all user files
- **`/setplan` command**: Admin-only plan management
  - Set user plans via Discord
  - Requires DISCORD_ADMIN_ID in .env
  - Sends notifications on plan changes

#### Multi-Type Support
- **Apps configuration**: New apps-config.json for app data
  - VS Code settings backup (Plus+)
  - Obsidian vaults (Plus+)
  - Easily extensible for more apps
- **Custom files folder**: Premium-only feature
  - Auto-created at ~/CheapForceCloud/CustomFiles/
  - Any file type supported
  - Automatic sync with 5-minute batching
  - README file created on first run

#### Storage Management
- Real-time storage calculation
- Quota enforcement before uploads
- Storage utilities module with helpers:
  - `calculateUserStorage()` - Real-time R2 calculation
  - `hasStorageQuota()` - Pre-upload validation
  - `formatBytes()` - Human-readable sizes
  - `generateProgressBar()` - ASCII art generator
  - `canUseFeature()` - Plan-based feature checks

#### R2 Storage Enhancements
- `listFilesWithMetadata()` - Get file sizes and dates
- `uploadAppFile()` - Dedicated app data uploads
- `uploadCustomFile()` - Custom file uploads (Premium)
- `createUserBackup()` - Generate complete ZIP backup
- Organized storage structure:
  ```
  users/{userId}/
    ├── games/
    ├── apps/
    └── custom/
  ```

### Changed

#### Database Schema
```sql
-- Added to users table:
plan TEXT DEFAULT 'free'
storage_used INTEGER DEFAULT 0

-- New operations:
updateStorageUsed
updatePlan
getAllUsers
```

#### Client Behavior
- Custom files folder auto-created on startup
- Apps config loaded alongside games
- Plan-aware feature detection
- Custom files path: `~/CheapForceCloud/CustomFiles/`

#### Server Environment
- New `DISCORD_ADMIN_ID` env variable for admin commands
- Enhanced Discord bot with 3 new commands

### Technical Details

**Plan Limits:**
```typescript
{
  free: { storage: 1GB, features: ['Game saves only'] },
  plus: { storage: 10GB, features: ['Game saves', 'App data'] },
  premium: { storage: 100GB, features: ['Game saves', 'App data', 'Custom files'] }
}
```

**Storage Calculation:**
- On-demand via `/storage` command
- Automatic after uploads
- Cached in database for performance

**Backup Creation:**
- Streams files from R2
- Creates ZIP in memory
- Handles large backups with presigned URLs

### Benefits

1. **Clear Pricing Tiers**: Easy to monetize if running as service
2. **Storage Control**: Prevent runaway R2 costs
3. **Feature Segmentation**: Encourage upgrades for power users
4. **Complete Backups**: One-command full restore capability
5. **Visual Feedback**: ASCII art makes storage usage clear
6. **Admin Control**: Easy plan management via Discord

### Migration Notes

From v1.1.0 to v1.2.0:
1. Database auto-migrates (new columns added)
2. Run `npm run register-commands` to add new Discord commands
3. Set `DISCORD_ADMIN_ID` in server `.env` for admin features
4. Custom files folder created automatically on client startup
5. Existing users default to 'free' plan

---

## [1.1.0] - Batched Sync & Discord Commands

### Added

#### Batched Sync System
- **5-minute sync intervals**: File changes are now batched and uploaded every 5 minutes instead of immediately
- Pending changes tracker: System tracks which files have changed since last sync
- Only syncs when changes are detected (no unnecessary uploads)
- Significantly reduces R2 API requests and costs

#### Discord Remote Commands
- **`/sync` command**: Force client to upload all saves immediately (bypasses 5-minute timer)
- **`/pull` command**: Force client to download latest saves from cloud
- **`/link` command**: Existing authentication command

#### Client Improvements
- Request polling: Client checks for Discord commands every 10 seconds
- Automatic command execution when detected
- Visual feedback for Discord-triggered actions
- Force sync/pull functionality accessible remotely

#### Server Enhancements
- New `sync_requests` database table for command queue
- `/api/sync-requests/pending` endpoint for client polling
- `/api/sync-requests/complete` endpoint for completion notifications
- Automatic cleanup of old processed requests

### Changed

#### File Watcher
- Replaced immediate debounce (2 seconds) with batched sync (5 minutes)
- `handleChange()` now marks files as pending instead of triggering upload
- Added `forceSync()` and `forceSyncAll()` methods
- Added pending changes tracking with `getPendingChangesCount()`

#### Client Behavior
- Auto-sync mode now runs indefinitely with periodic syncing
- Console output updated to show batched sync behavior
- Added emoji indicators for better UX (⏰, 🔄, 🔔, ✅, ❌)

#### Documentation
- Updated README with new features and workflows
- Added Discord command documentation
- Updated architecture explanations
- Added performance tips for sync intervals

### Technical Details

**Sync Intervals:**
- File monitoring: Real-time (chokidar)
- Batched upload: Every 5 minutes (configurable in `watcher.ts`)
- Discord command polling: Every 10 seconds (configurable in `index.ts`)
- Old request cleanup: Every minute (server-side)

**Database Schema:**
```sql
CREATE TABLE sync_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  request_type TEXT NOT NULL,  -- 'sync' or 'pull'
  created_at INTEGER NOT NULL,
  processed INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**New API Endpoints:**
- `GET /api/sync-requests/pending` - Returns unprocessed requests for authenticated user
- `POST /api/sync-requests/complete` - Marks request as completed

**Discord Commands:**
- Registered via `register-commands.js` script
- Handled in `discord-auth.ts`
- Stored in database for async processing by client

### Benefits

1. **Cost Reduction**: 5-minute batching reduces R2 API calls by ~12x (from every 2 seconds to every 5 minutes)
2. **R2 Free Tier Friendly**: Minimizes Class A operations (list/write)
3. **Remote Control**: Sync/pull from anywhere via Discord
4. **Better UX**: Clear feedback on sync status and timing
5. **Flexible**: Easy to adjust intervals in code

### Migration Notes

If upgrading from v1.0.0:
1. Run `npm run register-commands` in server directory to add new Discord commands
2. Database will auto-migrate (new table created on startup)
3. Client behavior changes from immediate to batched sync
4. No breaking changes to existing functionality

---

## [1.0.0] - Initial Release

### Added
- Discord authentication with 6-digit codes
- Cloudflare R2 storage integration
- Real-time file monitoring
- Cross-platform support (Windows/macOS/Linux)
- Game configuration system
- Upload/download/restore functionality
- Session management
