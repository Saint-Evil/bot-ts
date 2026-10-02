import db, { connection } from "../utils/db";
import { ArgsOf, Client, Guard, SlashGroup } from "discordx";
import { Discord, Slash, SlashOption } from "discordx";
import cmds from '../commands'
import { ApplicationCommandOptionType, ChannelType, CommandInteraction, GuildMember, SendableChannels } from "discord.js";

@Discord()
export class Guilds {
  @Slash({
    name: 'help',
    description: "Display help information for specified modules"
  })
  async help(
    @SlashOption({
      name: 'module',
      description: "Get help for module...",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    module: string,
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.help.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      member: interaction.member as GuildMember,
    }, true)([module])
    if (reply) {
      interaction.reply({
        content: reply.content,
        embeds: reply.embeds
      })
    } else {
    }
  }

  @Slash({
    name: 'channelname',
    description: "Changes voice autochannel name"
  })
  async channelName(
    @SlashOption({
      name: 'name',
      description: "New name for your channel...",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.utils.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      member: interaction.member as GuildMember,
    }, true)(['ChannelName', name])
    if (reply) {
      interaction.reply({
        content: reply.content,
        embeds: reply.embeds
      })
    } else {
    }
  }
}
