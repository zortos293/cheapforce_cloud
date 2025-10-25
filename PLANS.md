# CheapForce Cloud - User Plans

CheapForce Cloud offers three tiers to suit different storage needs.

## Plan Comparison

| Feature | Free | Plus | Premium |
|---------|------|------|---------|
| **Name** | CheapStorage Free | CheapStorage+ | CheapStorage++ |
| **Storage** | 1 GB | 10 GB | 100 GB |
| **Game Saves** | ✅ | ✅ | ✅ |
| **App Data** | ❌ | ✅ | ✅ |
| **Custom Files** | ❌ | ❌ | ✅ |
| **Discord Commands** | ✅ | ✅ | ✅ |
| **Auto-Sync** | ✅ | ✅ | ✅ |

## Plan Details

### 🆓 CheapStorage Free
**Storage:** 1 GB
**Perfect for:** Casual gamers

**Features:**
- Automatic game save backups
- Discord authentication
- `/sync` and `/pull` commands
- `/storage` command to monitor usage
- `/backup` command to download saves
- 5-minute batched sync
- Cross-platform support

**Limitations:**
- Game saves only
- 1 GB storage limit

---

### ➕ CheapStorage+
**Storage:** 10 GB
**Perfect for:** Power users and developers

**Everything in Free, plus:**
- **App data backup** (VS Code, Obsidian, etc.)
- 10x storage capacity
- Backup application configurations

**Example Apps Supported:**
- Visual Studio Code settings
- Obsidian vaults
- Other productivity apps (configurable)

---

### 🌟 CheapStorage++
**Storage:** 100 GB
**Perfect for:** Content creators and professionals

**Everything in Plus, plus:**
- **Custom files backup**
- 100 GB storage capacity
- Upload ANY file type
- Complete backup solution

**Custom Files Folder:**
- Located at: `~/CheapForceCloud/CustomFiles/`
- Put any files here for automatic backup
- Photos, documents, projects, etc.
- Synced every 5 minutes with auto-sync

---

## Discord Commands

All plans have access to these commands:

### `/link`
Link your client to your Discord account using a 6-digit code.

### `/sync`
Force your client to upload all saves immediately (bypasses 5-minute timer).

### `/pull`
Force your client to download the latest saves from cloud.

### `/storage`
View your storage usage with a beautiful ASCII progress bar.

**Example output:**
```
📊 CheapStorage+ - Storage Usage

█████████████░░░░░░░░░░░░

Used        Total       Available
2.5 GB      10 GB       7.5 GB

Percentage
🟢 25.00%
```

### `/backup`
Download a complete backup of all your files as a ZIP.

- Files < 25MB: Sent directly as Discord attachment
- Files > 25MB: Presigned download URL (valid 1 hour)

---

## Admin Commands

### `/setplan <user> <plan>`
**Admin only** - Set a user's plan.

**Options:**
- `free` - CheapStorage Free (1 GB)
- `plus` - CheapStorage+ (10 GB)
- `premium` - CheapStorage++ (100 GB)

**Setup:**
Set your Discord user ID in `.env`:
```env
DISCORD_ADMIN_ID=your_discord_user_id
```

**Example:**
```
/setplan @User premium
```

This will:
1. Update user's plan in database
2. Send confirmation to admin
3. Notify in Discord channel

---

## Storage Structure

Files are organized by type in R2 storage:

```
users/
├── {userId}/
│   ├── games/
│   │   ├── minecraft/
│   │   ├── terraria/
│   │   └── ...
│   ├── apps/           (Plus & Premium only)
│   │   ├── vscode/
│   │   ├── obsidian/
│   │   └── ...
│   └── custom/         (Premium only)
│       ├── photos/
│       ├── documents/
│       └── ...
```

---

## Upgrading Plans

1. **Admin upgrades user:**
   ```
   /setplan @Username premium
   ```

2. **User receives notification** in Discord channel

3. **Client automatically detects new plan** on next sync

4. **New features unlock immediately:**
   - Plus: Apps config loaded
   - Premium: Custom files folder created

---

## Storage Quota

### What counts toward quota?
- All uploaded files (games, apps, custom)
- Compressed as stored
- Calculated in real-time

### What happens when full?
- Uploads are rejected
- Client shows error message
- Use `/storage` to check usage
- Delete old backups or upgrade plan

### Checking storage:
```
/storage
```

Shows:
- Used space
- Total space
- Available space
- Percentage with color indicator:
  - 🟢 Green: < 75%
  - 🟡 Yellow: 75-90%
  - 🔴 Red: > 90%

---

## Best Practices

### Free Plan
- Backup only essential game saves
- Remove old/unused game backups
- Monitor storage regularly

### Plus Plan
- Backup game saves + important app data
- Use for development configurations
- Great for multiple computers

### Premium Plan
- Unlimited backup flexibility
- Use custom folder for important files
- Complete backup solution
- Perfect for content creators

---

## FAQ

**Q: Can I downgrade my plan?**
A: Yes, admin can change plan anytime. Files may be deleted if over new limit.

**Q: What happens to my files if I downgrade?**
A: You'll need to reduce storage below new limit or files may be inaccessible.

**Q: How often is storage calculated?**
A: Real-time when you use `/storage` command. Also updated after each sync.

**Q: Can I share backups with others?**
A: Not directly, but you can download via `/backup` and share the ZIP.

**Q: What's the largest file I can backup?**
A: 100MB per file. Larger files need to be split.

**Q: Is data encrypted?**
A: Data is stored in Cloudflare R2. Add encryption if needed.

---

## Pricing Suggestions

While CheapForce Cloud is open-source, if running as a service:

- **Free:** Always free (supported by higher tiers)
- **Plus:** $2-3/month
- **Premium:** $5-7/month

Based on Cloudflare R2 costs (~$0.015/GB/month).

---

## Configuration

### Adding Apps (Plus & Premium)

Edit `shared/apps-config.json`:

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
        }
      ]
    }
  ]
}
```

### Custom Files (Premium)

Files are automatically detected from:
- Windows: `C:\Users\YourName\CheapForceCloud\CustomFiles\`
- macOS: `~/CheapForceCloud/CustomFiles/`
- Linux: `~/CheapForceCloud/CustomFiles/`

Just drop files in this folder - they'll sync automatically!

---

## Support

For plan upgrades or issues:
1. Contact your admin
2. Use `/setplan` command (admin only)
3. Check `/storage` for current usage
4. Use `/backup` to download all files

Enjoy CheapForce Cloud! 🚀
