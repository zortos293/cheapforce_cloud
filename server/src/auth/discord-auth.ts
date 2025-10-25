import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { authCodeOps, userOps, User } from '../db/database';
import { calculateUserStorage, getStorageInfo, formatBytes, generateProgressBar, canUseFeature } from '../utils/storage-utils';
import { R2Storage } from '../storage/r2-storage';
import crypto from 'crypto';

export class DiscordAuth {
  private client: Client;
  private channelId: string;
  private ready: boolean = false;

  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds]
    });

    this.channelId = process.env.DISCORD_CHANNEL_ID!;

    this.client.once('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.ready = true;
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'link') {
        await this.handleLinkCommand(interaction);
      } else if (interaction.commandName === 'sync') {
        await this.handleSyncCommand(interaction);
      } else if (interaction.commandName === 'pull') {
        await this.handlePullCommand(interaction);
      } else if (interaction.commandName === 'storage') {
        await this.handleStorageCommand(interaction);
      } else if (interaction.commandName === 'backup') {
        await this.handleBackupCommand(interaction);
      } else if (interaction.commandName === 'setplan') {
        await this.handleSetPlanCommand(interaction);
      }
    });
  }

  async start() {
    await this.client.login(process.env.DISCORD_BOT_TOKEN!);
  }

  /**
   * Generate a 6-digit linking code for a Discord user
   */
  generateLinkingCode(discordId: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAt = now + (15 * 60 * 1000); // 15 minutes

    authCodeOps.create.run(code, discordId, now, expiresAt);

    return code;
  }

  /**
   * Verify a linking code and return the associated Discord user
   */
  verifyLinkingCode(code: string): { discordId: string } | null {
    const authCode = authCodeOps.findByCode.get(code, Date.now()) as any;

    if (!authCode) {
      return null;
    }

    authCodeOps.markUsed.run(code);
    return { discordId: authCode.discord_id };
  }

  /**
   * Send linking code to Discord channel
   */
  async sendLinkingCode(discordId: string, discordUsername: string): Promise<string> {
    if (!this.ready) {
      throw new Error('Discord bot not ready');
    }

    const code = this.generateLinkingCode(discordId);

    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('CheapForce Cloud - Link Your Account')
        .setDescription(`Hey <@${discordId}>! Use this code to link your client:`)
        .addFields(
          { name: 'Linking Code', value: `\`${code}\``, inline: true },
          { name: 'Expires In', value: '15 minutes', inline: true }
        )
        .setFooter({ text: 'Enter this code in your CheapForce Cloud client' })
        .setTimestamp();

      await channel.send({
        content: `<@${discordId}>`,
        embeds: [embed]
      });

      return code;
    } catch (error) {
      console.error('Error sending linking code:', error);
      throw new Error('Failed to send linking code to Discord');
    }
  }

  /**
   * Handle the /link command from Discord
   */
  private async handleLinkCommand(interaction: any) {
    const discordId = interaction.user.id;
    const discordUsername = interaction.user.username;

    try {
      const code = await this.sendLinkingCode(discordId, discordUsername);

      await interaction.reply({
        content: `Your linking code has been sent! Check the channel for your code.`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: 'Failed to generate linking code. Please try again.',
        ephemeral: true
      });
    }
  }

  /**
   * Get or create user from Discord ID
   */
  getOrCreateUser(discordId: string, discordUsername: string): User {
    let user = userOps.findByDiscordId.get(discordId) as User | undefined;

    if (!user) {
      user = userOps.create.get(discordId, discordUsername, Date.now()) as User;
    }

    return user;
  }

  /**
   * Handle the /sync command - force client to upload saves
   */
  private async handleSyncCommand(interaction: any) {
    const discordId = interaction.user.id;

    try {
      const user = userOps.findByDiscordId.get(discordId) as User | undefined;

      if (!user) {
        await interaction.reply({
          content: 'You need to link your client first! Use `/link` to get started.',
          ephemeral: true
        });
        return;
      }

      // Store sync request in database
      this.storeSyncRequest(user.id);

      await interaction.reply({
        content: '✅ Sync request sent! Your client will upload all saves shortly.',
        ephemeral: true
      });

      // Also send to channel for visibility
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔄 Force Sync Requested')
        .setDescription(`<@${discordId}> requested a force sync.`)
        .addFields({ name: 'Status', value: 'Your client will sync within the next check interval.' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Sync command error:', error);
      await interaction.reply({
        content: 'Failed to request sync. Please try again.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle the /pull command - force client to download latest saves
   */
  private async handlePullCommand(interaction: any) {
    const discordId = interaction.user.id;

    try {
      const user = userOps.findByDiscordId.get(discordId) as User | undefined;

      if (!user) {
        await interaction.reply({
          content: 'You need to link your client first! Use `/link` to get started.',
          ephemeral: true
        });
        return;
      }

      // Store pull request in database
      this.storePullRequest(user.id);

      await interaction.reply({
        content: '✅ Pull request sent! Your client will download the latest saves shortly.',
        ephemeral: true
      });

      // Also send to channel
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('⬇️ Force Pull Requested')
        .setDescription(`<@${discordId}> requested a force pull.`)
        .addFields({ name: 'Status', value: 'Your client will download latest saves within the next check interval.' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Pull command error:', error);
      await interaction.reply({
        content: 'Failed to request pull. Please try again.',
        ephemeral: true
      });
    }
  }

  /**
   * Store a sync request for a user
   */
  private storeSyncRequest(userId: number): void {
    const { syncRequestOps } = require('../db/database');
    syncRequestOps.create.run(userId, 'sync', Date.now());
  }

  /**
   * Store a pull request for a user
   */
  private storePullRequest(userId: number): void {
    const { syncRequestOps } = require('../db/database');
    syncRequestOps.create.run(userId, 'pull', Date.now());
  }

  /**
   * Handle the /storage command - show storage usage
   */
  private async handleStorageCommand(interaction: any) {
    const discordId = interaction.user.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const user = userOps.findByDiscordId.get(discordId) as User | undefined;

      if (!user) {
        await interaction.editReply({
          content: 'You need to link your client first! Use `/link` to get started.'
        });
        return;
      }

      // Calculate current storage
      await calculateUserStorage(user.id);
      const updatedUser = userOps.findById.get(user.id) as User;
      const info = getStorageInfo(updatedUser);

      const progressBar = generateProgressBar(info.percentUsed, 25);
      const percentColor = info.percentUsed > 90 ? '🔴' : info.percentUsed > 75 ? '🟡' : '🟢';

      const embed = new EmbedBuilder()
        .setColor(info.percentUsed > 90 ? 0xFF0000 : info.percentUsed > 75 ? 0xFFFF00 : 0x00FF00)
        .setTitle(`📊 ${info.plan} - Storage Usage`)
        .setDescription(`\`\`\`\n${progressBar}\n\`\`\``)
        .addFields(
          { name: 'Used', value: formatBytes(info.used), inline: true },
          { name: 'Total', value: formatBytes(info.limit), inline: true },
          { name: 'Available', value: formatBytes(info.available), inline: true },
          { name: 'Percentage', value: `${percentColor} ${info.percentUsed.toFixed(2)}%`, inline: false }
        )
        .setFooter({ text: `User ID: ${user.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Storage command error:', error);
      await interaction.editReply({
        content: 'Failed to retrieve storage information. Please try again.'
      });
    }
  }

  /**
   * Handle the /backup command - send user's complete backup
   */
  private async handleBackupCommand(interaction: any) {
    const discordId = interaction.user.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const user = userOps.findByDiscordId.get(discordId) as User | undefined;

      if (!user) {
        await interaction.editReply({
          content: 'You need to link your client first! Use `/link` to get started.'
        });
        return;
      }

      // Check if user has any files
      const files = await R2Storage.listFilesWithMetadata(user.id);

      if (files.length === 0) {
        await interaction.editReply({
          content: '📭 You don\'t have any backups yet. Start syncing with your client!'
        });
        return;
      }

      await interaction.editReply({
        content: '⏳ Creating your backup archive... This may take a moment.'
      });

      // Create backup ZIP
      const backupData = await R2Storage.createUserBackup(user.id);

      // Check if file is too large for Discord (25MB limit)
      const sizeMB = backupData.length / (1024 * 1024);

      if (sizeMB > 24) {
        // Upload to R2 and send presigned URL instead
        const backupKey = await R2Storage.uploadCustomFile(
          user.id,
          `backup-${Date.now()}.zip`,
          backupData,
          'application/zip'
        );

        const url = await R2Storage.getDownloadUrl(backupKey);

        await interaction.editReply({
          content: `✅ Your backup is ready!\n\n⚠️ File is too large for Discord (${formatBytes(backupData.length)})\n\n🔗 Download link (valid for 1 hour):\n${url}`
        });
      } else {
        // Send as Discord attachment
        const attachment = new AttachmentBuilder(backupData, {
          name: `cheapforce-backup-${user.discord_username}-${Date.now()}.zip`
        });

        await interaction.editReply({
          content: `✅ Your backup is ready! (${formatBytes(backupData.length)})`,
          files: [attachment]
        });
      }
    } catch (error) {
      console.error('Backup command error:', error);
      await interaction.editReply({
        content: 'Failed to create backup. Please try again later.'
      });
    }
  }

  /**
   * Handle the /setplan command - set user's plan (admin only)
   */
  private async handleSetPlanCommand(interaction: any) {
    const adminId = process.env.DISCORD_ADMIN_ID;

    if (!adminId || interaction.user.id !== adminId) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
      return;
    }

    const targetUser = interaction.options.getUser('user');
    const plan = interaction.options.getString('plan');

    try {
      const user = userOps.findByDiscordId.get(targetUser.id) as User | undefined;

      if (!user) {
        await interaction.reply({
          content: `❌ User ${targetUser.username} is not linked to CheapForce Cloud.`,
          ephemeral: true
        });
        return;
      }

      userOps.updatePlan.run(plan, user.id);

      await interaction.reply({
        content: `✅ Updated ${targetUser.username}'s plan to **${plan.toUpperCase()}**`,
        ephemeral: true
      });

      // Send notification to channel
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📦 Plan Updated')
        .setDescription(`<@${targetUser.id}> has been upgraded to **CheapStorage ${plan === 'free' ? 'Free' : plan === 'plus' ? '+' : '++'}**`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('SetPlan command error:', error);
      await interaction.reply({
        content: 'Failed to update plan. Please try again.',
        ephemeral: true
      });
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(discordId: string, title: string, message: string, color: number = 0x5865F2): Promise<void> {
    if (!this.ready) return;

    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(`<@${discordId}> ${message}`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}

export const discordAuth = new DiscordAuth();
