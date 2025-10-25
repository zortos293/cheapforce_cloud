# Quick Start Guide

Get CheapForce Cloud running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Discord bot created ([guide](https://discord.com/developers/applications))
- [ ] Cloudflare R2 bucket created ([guide](https://dash.cloudflare.com/))

## Step 1: Discord Bot Setup (2 minutes)

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" tab → "Add Bot"
4. Copy the **Bot Token**
5. Enable **Message Content Intent**
6. Go to "OAuth2" → "URL Generator"
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`
7. Copy the generated URL and invite bot to your server
8. Copy your **Application ID** (from General Information)
9. Copy your **Server/Guild ID** (right-click server → Copy ID in Discord)
10. Copy a **Channel ID** where link codes will be sent

## Step 2: Cloudflare R2 Setup (2 minutes)

1. Go to https://dash.cloudflare.com/
2. Navigate to R2 Object Storage
3. Click "Create bucket" → Name it `cheapforce-cloud-saves`
4. Go to "Manage R2 API Tokens" → "Create API Token"
   - Permissions: "Object Read & Write"
   - Copy **Access Key ID** and **Secret Access Key**
5. Note your **Account ID** from the R2 dashboard URL

## Step 3: Server Setup (1 minute)

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

```env
DISCORD_BOT_TOKEN=<your_bot_token>
DISCORD_CLIENT_ID=<your_application_id>
DISCORD_CHANNEL_ID=<your_channel_id>
DISCORD_GUILD_ID=<your_server_id>

R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your_access_key>
R2_SECRET_ACCESS_KEY=<your_secret_key>
R2_BUCKET_NAME=cheapforce-cloud-saves

PORT=3000
```

Register Discord commands:

```bash
npm run register-commands
```

Start the server:

```bash
npm run dev
```

You should see:
```
Discord bot logged in as YourBot#1234
CheapForce Cloud Server started!
```

## Step 4: Client Setup (1 minute)

Open a new terminal:

```bash
cd client
npm install
cp .env.example .env
```

Edit `client/.env`:

```env
SERVER_URL=http://localhost:3000
```

Start the client:

```bash
npm run dev
```

## Step 5: Link and Test

1. In Discord, type `/link` in your server
2. Bot will send you a 6-digit code
3. Enter the code in the client terminal
4. Select "Start Auto-Sync"
5. Done! Your game saves are now being backed up

## Verify It's Working

1. Make a change to a supported game save file
2. Check the client terminal for "Syncing..." messages
3. In Discord, you should see the file being uploaded

## Troubleshooting

**Bot not responding to /link**
```bash
# Re-run command registration
cd server
npm run register-commands
```

**Client can't connect**
- Check server is running
- Verify `SERVER_URL` is correct
- Check firewall settings

**No games detected**
- Ensure games are installed
- Check paths in `shared/games-config.json`
- Add your game manually (see README)

## Next Steps

- Add more games to `shared/games-config.json`
- Test restore functionality on another device
- Set up the server on a VPS for 24/7 operation
- Configure the client to run on startup

## Production Deployment

For production use:

**Server:**
```bash
cd server
npm run build
npm start
```

**Client:**
```bash
cd client
npm run build
npm start
```

Consider using PM2 for process management:
```bash
npm install -g pm2
pm2 start dist/index.js --name cheapforce-server
```

## Support

- See full documentation in [README.md](README.md)
- Check game save locations: https://www.pcgamingwiki.com/
- Report issues: https://github.com/your-repo/issues

Enjoy your automated cloud saves!
