import type { Client, Guild, GuildMember, Message, TextChannel, VoiceBasedChannel, VoiceChannel } from 'discord.js';
import { Db, MongoClient } from 'mongodb';
import { Action, ICommand, PartialMessage } from '@/types';
// import config from '../config.json';
import commands from '../commands.js';
import timeoutPromise from '../utils/timeoutPromise.js';

class Utility implements ICommand { 
  bot: Client | null = null;
  db: Db | null = null;
  channel: TextChannel | null = null;

  init = (bot: Client, db: Db) => {
    if(!this.bot) this.bot = bot;
    if(!this.db) this.db = db;
  }

  execute = (msg: PartialMessage, isSlash: boolean = false) => {
    return async (args: string[]) => {
      const error = (...msg: string[]) => console.error('[Utility].[execute]', ...msg)
      const log = (...msg: string[]) => console.log('[Utility].[execute]', ...msg)

      this.channel = msg.channel as TextChannel;
      if (!msg.guild) {
        log('Not a guild message')
        return
      }
      if (!this.db) {
        error('Database not set')
        return
      }

      const utilcmd = args.shift();
      const guild = (await this.db.collection('guilds').findOne({
        id: msg.guild.id
      }))
      if (!guild) {
        error('Not registered guild')
        return
      }
      const guildPrefix = guild.prefix
      if(!utilcmd){
        const reply = {
          content: `No channel name provided, ${msg.member}.`,
          embeds: [],
        }
        if (isSlash) {
          return reply
        }
        return this.channel.send(reply)
      }
      let answer = 'Ok'

      switch(utilcmd) {
        case 'ChannelName': {
          try {
            await this.doAction({
              id: 'null',
              type: 'ChannelName',
              message: args.join(' ')
            },
            msg.member!,
            msg)
          } 
          catch (ex) {
            if (ex instanceof Error) {
              answer = ex.message;
            }
          }
        }
        break;
        default:
          break;
      }
      const reply = { 
        content: `Changing, ${msg.member}. Note, you can rename channel only 2 times in 10 minutes`,
        embeds: [{
          title: utilcmd,
          color: 15548997,
          /* @ts-ignore */
          description: answer,
        }]
      }
      if (isSlash) {
        return reply
      }
      return this.channel.send(reply);
    }
  }

  doAction = async (act: Action, user: GuildMember, msg?: PartialMessage) => {
    switch(act.type) {
      case 'ChannelName': {
        if (!act.message || !user.voice.channel) {
          console.log("No name or channel")
          throw new Error('No name or channel')
        }
        return this.changeChannelName(act.message, user.voice.channel, msg?.guild?.id!)
      };
      break;
      default:
        break;
    }
  }

  async changeChannelName(name: string, channel: VoiceBasedChannel, guildId: string): Promise<void> {
    const error = (...msg: string[]) => console.error('[Utility].[execute]', ...msg)
    const log = (...msg: string[]) => console.log('[Utility].[execute]', ...msg)

    const guild = await this.db?.collection('guilds').findOne({
      id: guildId
    });

    if (!guild) {
      error('No guild found')
      return
    }

    const { autochannel } = guild
    let list = autochannel.list || []
    const editable = list.includes(channel.name);

    if (!editable) {
      throw new Error('You cannot rename this channel!')
    }

    list = list.filter((chan: string) => chan !== channel.name);

    const newAutochannel = {
      ...autochannel,
      list: [
        ...list,
        name
      ]
    };

    // await timeoutPromise( as Promise<VoiceChannel>, 3000, new Error('Channel name can be changed only 2ce in 10 minutes'))
    channel.setName(name)

    /* @ts-ignore */
    const updatedCb = (await this.db.collection('guilds').findOneAndUpdate({
      id: guildId
    }, {
      $set: {
        autochannel: newAutochannel
      }
    }, {
      returnDocument: 'after',
      includeResultMetadata: true
    }))
  }
  
  shortDescription = (): string => {
    return 'Utility provider';
  }

  detailedDescription = (): string => {
    return 'Can provide detailed help for each command that was documented.\nJust use `\>help {command}\` to display detailed info.';
  }
}


export default Utility;
