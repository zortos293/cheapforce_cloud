# Setting Up User Plans - Quick Guide

## Prerequisites Complete Setup

After completing the standard setup from [QUICKSTART.md](QUICKSTART.md), follow these steps to enable plan features.

## Step 1: Set Admin User ID

Get your Discord user ID:
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your username → Copy ID

Add to `server/.env`:
```env
DISCORD_ADMIN_ID=123456789012345678
```

## Step 2: Register New Commands

```bash
cd server
npm run register-commands
```

This adds:
- `/storage` - View usage
- `/backup` - Download backups
- `/setplan` - Admin only

Restart the server:
```bash
npm run dev
```

## Step 3: Test Storage Command

In Discord, type:
```
/storage
```

You should see:
```
📊 CheapStorage Free - Storage Usage

█░░░░░░░░░░░░░░░░░░░░░░░░

Used        Total       Available
0 Bytes     1 GB        1 GB

Percentage
🟢 0.00%
```

## Step 4: Upgrade a User (Admin)

```
/setplan @Username premium
```

This:
- ✅ Updates user to Premium (100GB)
- ✅ Enables custom files folder
- ✅ Sends notification to channel

## Step 5: Client-Side Changes

### Custom Files Folder

The client automatically creates:
- Windows: `C:\Users\YourName\CheapForceCloud\CustomFiles\`
- macOS: `~/CheapForceCloud/CustomFiles/`
- Linux: `~/CheapForceCloud/CustomFiles/`

Premium users can drop any files here!

### Apps Support (Plus & Premium)

Edit `shared/apps-config.json` to add apps:

```json
{
  "apps": [
    {
      "id": "your-app",
      "name": "Your App",
      "enabled": true,
      "paths": [
        {
          "platform": "windows",
          "path": "%APPDATA%/YourApp",
          "type": "directory"
        },
        {
          "platform": "darwin",
          "path": "~/Library/Application Support/YourApp",
          "type": "directory"
        },
        {
          "platform": "linux",
          "path": "~/.config/YourApp",
          "type": "directory"
        }
      ]
    }
  ]
}
```

## Step 6: Test Backup Command

```
/backup
```

Results:
- **< 25MB**: ZIP file sent directly
- **> 25MB**: Download link (valid 1 hour)

Example output:
```
✅ Your backup is ready! (12.5 MB)
[cheapforce-backup-username-1234567890.zip]
```

## Common Admin Tasks

### Check Who's Linked
Currently requires database query. Future: `/users` command planned.

### Change User Plan
```
/setplan @User free     # Downgrade to Free
/setplan @User plus     # Upgrade to Plus
/setplan @User premium  # Upgrade to Premium
```

### Monitor Storage Usage
Users can self-check with `/storage`

### Clean Up Old Backups
Users download via `/backup` then delete locally

## Plan Enforcement

The system automatically:
- ✅ Checks quota before uploads
- ✅ Rejects uploads when over limit
- ✅ Shows available space in `/storage`
- ✅ Calculates storage in real-time

## Testing Plan Features

### Test Free Plan (Default)
1. Link a new user
2. Upload game saves
3. Try `/storage` - shows 1GB limit
4. Try to upload > 1GB - rejected

### Test Plus Plan
1. Upgrade user: `/setplan @User plus`
2. Upload game saves
3. Add apps to config
4. Apps should sync
5. `/storage` shows 10GB limit

### Test Premium Plan
1. Upgrade user: `/setplan @User premium`
2. All features unlocked
3. Drop files in CustomFiles folder
4. Files auto-sync
5. `/storage` shows 100GB limit

## Troubleshooting

### `/setplan` not working
- Check `DISCORD_ADMIN_ID` is set
- Verify you're using your own ID
- Restart server after adding

### Storage shows 0 Bytes
- Normal for new users
- Upload some files first
- Run `/sync` to force upload
- Then `/storage` will show usage

### Custom folder not created
- Client must run at least once
- Check home directory permissions
- Look for README.txt inside folder

### Backup fails
- Check R2 credentials
- Verify files exist (run `/storage`)
- Try smaller backup first

## Security Notes

### Admin Access
- Only one admin supported
- Use personal Discord ID
- Don't share .env file

### Plan Changes
- Instant effect
- No data loss
- Quota enforced immediately

### Storage Limits
- Calculated from R2
- Cached in database
- Updated on sync

## Next Steps

1. **Document your plans** - Let users know tiers
2. **Set pricing** - If monetizing
3. **Monitor usage** - Check R2 dashboard
4. **Add more apps** - Extend apps-config.json
5. **Customize limits** - Edit PLAN_LIMITS in database.ts

## Advanced Configuration

### Change Plan Limits

Edit `server/src/db/database.ts`:

```typescript
export const PLAN_LIMITS = {
  free: {
    name: 'CheapStorage Free',
    storage: 2 * 1024 * 1024 * 1024, // Change to 2GB
    features: ['Game saves only']
  },
  // ... etc
}
```

### Add More Plans

1. Add to UserPlan type
2. Add to PLAN_LIMITS
3. Update `/setplan` choices
4. Re-register commands

### Custom Storage Paths

Edit client source to change:
```typescript
const CUSTOM_FILES_PATH = path.join(os.homedir(), 'YourFolder');
```

## Support

See full documentation:
- [PLANS.md](PLANS.md) - Detailed plan comparison
- [README.md](README.md) - Main documentation
- [QUICKSTART.md](QUICKSTART.md) - Initial setup

Enjoy your multi-tier cloud storage! 🎉
