import { existsSync } from 'node:fs';
import path from 'node:path';
import { Client, GatewayIntentBits, Events, SlashCommandBuilder } from 'discord.js';
import { errorMessage, logger } from './logger.js';
import { getKosenStatus } from './service.js';

const command = new SlashCommandBuilder()
  .setName('kosen')
  .setDescription('国立高専線・高専方面のバスの現在地を表示します');

function loadEnvFile(): void {
  if (process.env.DISCORD_TOKEN?.trim()) return;
  const envFile = process.env.BOT_ENV_FILE
    ? path.resolve(process.env.BOT_ENV_FILE)
    : path.resolve(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

async function main(): Promise<void> {
  loadEnvFile();

  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) {
    logger.error('DISCORD_TOKEN が設定されていません。.env.example を参照してください。');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`${readyClient.user.tag} としてログインしました`);

    const guildId = process.env.DISCORD_GUILD_ID?.trim();
    try {
      if (guildId) {
        const guild = await readyClient.guilds.fetch(guildId);
        await guild.commands.set([command.toJSON()]);
        logger.info(`ギルド ${guildId} に /kosen を登録しました`);
      } else {
        await readyClient.application.commands.set([command.toJSON()]);
        logger.info('/kosen をグローバル登録しました');
      }
    } catch (error) {
      logger.error(`コマンドの登録に失敗しました: ${errorMessage(error)}`);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'kosen') return;

    await interaction.deferReply();

    try {
      const text = await getKosenStatus();
      await interaction.editReply({ content: text });
    } catch (error) {
      logger.error(`バス情報の取得に失敗しました: ${errorMessage(error)}`);
      await interaction.editReply({
        content: `バス情報を取得できませんでした。時間をおいて試してください。\n\`${errorMessage(error)}\``,
      });
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} を受信しました。停止します。`);
    await client.destroy();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await client.login(token);
  } catch (error) {
    logger.error(`ログインに失敗しました: ${errorMessage(error)}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  logger.error(`起動に失敗しました: ${errorMessage(error)}`);
  process.exitCode = 1;
});
