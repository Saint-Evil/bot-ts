// import type { PermissionsType } from '@discordx/utilities'
import type { CommandInteraction } from "discord.js";
import { ChannelType, EmbedBuilder, GuildChannel, GuildMember, inlineCode, PermissionsBitField } from "discord.js";
import type { Client, GuardFunction, Next } from "discordx";

export function AvoidGuild(guildsToAvoid: string[]): GuardFunction<CommandInteraction> {
  return async function(arg: CommandInteraction, client: Client, next: Next): Promise<unknown> {
    if (arg.guildId !== null && !guildsToAvoid.includes(arg.guildId)) {
      return next();
    }
    return;
  }
}