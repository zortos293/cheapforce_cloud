require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your CheapForce Cloud client to your Discord account')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Force your client to upload all game saves immediately')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('pull')
    .setDescription('Force your client to download the latest saves from cloud')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('storage')
    .setDescription('View your storage usage and quota')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Download a complete backup of all your files as a ZIP')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('setplan')
    .setDescription('Set a user\'s plan (Admin only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to update')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('plan')
        .setDescription('The plan to assign')
        .setRequired(true)
        .addChoices(
          { name: 'Free', value: 'free' },
          { name: 'Plus', value: 'plus' },
          { name: 'Premium', value: 'premium' }
        ))
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    // For guild commands (faster, good for development)
    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commands }
      );
      console.log('Successfully registered guild commands!');
    } else {
      // For global commands (slower, but works everywhere)
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands }
      );
      console.log('Successfully registered global commands!');
      console.log('Note: Global commands can take up to 1 hour to update.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();
