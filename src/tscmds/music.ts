import db, { connection } from '../utils/db';
import { ArgsOf, Client, Guard, SlashGroup } from 'discordx';
import { Discord, Slash, SlashOption } from 'discordx';
import { Guild } from '@/types';
import cmds from '../commands'
import { ApplicationCommandOptionType, ChannelType, CommandInteraction, GuildMember, SendableChannels } from 'discord.js';
import { AvoidGuild } from '../guards/global/AvoidGuild';

@Discord()
@SlashGroup({ name: 'music', description: 'Music module of Latte' })
@SlashGroup('music')
export class Music {
  @Slash({
    name: 'play',
    description: 'Play track or playlist by query or link'
  })
  async musicPlay(
    @SlashOption({
      name: 'query',
      description: 'Enter query(use double quotes e.g. "query" to search), link for song or playlist to play',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    query: string,
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await (await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true))(['play', query])
    if (reply) {
      await interaction.reply(reply).catch(er => {
        console.error(er, er.requestBody)
      })
    } else {
    }
  }

  @Slash({
    name: 'pause',
    description: 'Pauses current song'
  })
  async musicPause(
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true)(['pause'])
    if (reply) {
      interaction.reply(reply)
    } else {
    }
  }

  @Slash({
    name: 'stop',
    description: 'Stop music and clear queue'
  })
  async musicStop(
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true)(['stop'])
    if (reply) {
      interaction.reply(reply)
    } else {
    }
  }

  @Slash({
    name: 'status',
    description: 'Display music player status'
  })
  async musicStatus(
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true)(['status'])
    if (reply) {
      interaction.reply(reply)
    } else {
    }
  }

  @Slash({
    name: 'skip',
    description: 'Skip current, or given number or range of tracks'
  })
  async musicSkip(
    @SlashOption({
      name: 'number',
      description: '(Optional) Enter number (e.g. 5) or range (e.g. 2-5) of tracks to skip',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    number: string,
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true)(['skip', number])
    if (reply) {
      interaction.reply(reply)
    } else {
    }
  }
  
  @Slash({
    name: 'repeat',
    description: 'Switch repeat mode or set certain mode'
  })
  async musicRepeat(
    @SlashOption({
      name: 'mode',
      description: '(Optional) Enter `disabled`, `song` or `queue`',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    mode: string,
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true)(['repeat', mode])
    if (reply) {
      interaction.reply(reply)
    } else {
    }
  }
  
  @Slash({
    name: 'shuffle',
    description: 'Set shuffle mode for next playlist'
  })
  async musicShuffle(
    interaction: CommandInteraction
  ): Promise<void> {
    const reply = await cmds.music.execute({
      channel: interaction.channel as SendableChannels | null,
      guild: interaction.guild,
      guildId: interaction.guildId,
      member: interaction.member as GuildMember,
    }, true)(['shuffle'])
    if (reply) {
      interaction.reply(reply)
    } else {
      interaction.reply('Something went wrong')
    }
  }
}