import db, { connection } from "../utils/db.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { Guild } from "@/types";
import cmds from '../commands.js'
import wire from '../utils/wire.js'
import { ChannelType } from "discord.js";
import terminalLink from "terminal-link";

// console = wire
@Discord()
export class Guilds {

  @On({ event: 'voiceStateUpdate' })
  async onVoiceStateUpdate([oldState, newState]: ArgsOf<'voiceStateUpdate'>, client: Client): Promise<void> {
    // wire.log('voice state changed', oldState, newState)
    
    const guild = await connection.collection('guilds').findOne({
      id: newState.guild.id
    })
    
    if (!guild) return;
    
    const { autochannel } = guild
    if (!autochannel) return;
    
    if (newState.channel?.name === autochannel.name) {
      // Join
      if (oldState.member?.user.bot) return;
      if (newState.member && newState.channel?.members.some(member => member.id === newState.member?.id)) {
        // console.log(`NNAMKE`, newState.member)
        const newChannelName = newState.member.user.username + '\'s channel'
        const newVoiceChannel = await newState.guild.channels.create({
          name: newChannelName,
          type: ChannelType.GuildVoice,
          parent: newState.channel?.parent
        })
        const list = autochannel.list || []
        const newAutochannel = {
          ...autochannel,
          list: [
            ...list,
            newChannelName
          ]
        }
          /* @ts-ignore */
        const updatedCb = (await connection.collection('guilds').findOneAndUpdate({
          id: newState.guild.id
        }, {
          $set: {
            autochannel: newAutochannel
          }
        }, {
          returnDocument: 'after',
          includeResultMetadata: true
        }))
  
        /* @ts-ignore */
        if (updatedCb && updatedCb.ok === 1) {
          newState.member?.voice.setChannel(newVoiceChannel, 'Created personal channel')
        }
      }
    } else if (autochannel.list && autochannel.list.includes(oldState.channel?.name)) {
      wire.log('Not the autochannel')
      // Left last

      if (oldState.channel && oldState.channel.members.size === 0) {
        const oldChannelName = oldState.channel?.name
        await oldState.channel.delete();
        const newAutochannel = {
          ...autochannel,
          list: autochannel.list.filter((c:string) => c !== oldChannelName)
        }

        // wire.log('newAutochannel', newAutochannel)
        
        /* @ts-ignore */
        const updatedCb = (await connection.collection('guilds').findOneAndUpdate({
          id: newState.guild.id
        }, {
          $set: {
            autochannel: newAutochannel
          }
        }, {
          returnDocument: 'after',
          includeResultMetadata: true
        }))

        /* @ts-ignore */
        // wire.log(updatedCb.ok)
      }
    }
    // let guildDb = connection.collection('guilds').findOne({ id: guild.id })
    // if ()
  
    // console.log(guildDB)
    // console.log("Message Deleted", client.user?.username, message.content);
  }

  @On({ event: 'guildCreate' })
  async onGuildCreate([guild]: ArgsOf<'guildCreate'>, client: Client): Promise<void> {
    console.log('create', guild)
    // let guildDb = connection.collection('guilds').findOne({ id: guild.id })
    // if ()
    const guildDB = await connection.collection('guilds').updateOne({
      id: guild.id,
    }, {
      $set: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        region: guild.preferredLocale, // || guild.region,
        memberCount: guild.memberCount,
        large: guild.large,
        features: guild.features,
        afkTimeout: guild.afkTimeout,
        afkChannelID: guild.afkChannelId,
        systemChannelID: guild.systemChannelId,
        // embedEnabled: guild.embedEnabled,
        premiumTier: guild.premiumTier,
        premiumSubscriptionCount: guild.premiumSubscriptionCount,
        verificationLevel: guild.verificationLevel,
        explicitContentFilter: guild.explicitContentFilter,
        mfaLevel: guild.mfaLevel,
        joinedTimestamp: guild.joinedTimestamp,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        maximumMembers: guild.maximumMembers,
        maximumPresences: guild.maximumPresences,
        description: guild.description,
        banner: guild.banner,
        rulesChannelID: guild.rulesChannelId,
        publicUpdatesChannelID: guild.publicUpdatesChannelId,
        preferredLocale: guild.preferredLocale,
        ownerID: guild.ownerId,
        emojis: []
      }
    }, {
      upsert: true,
    })
    // console.log(guildDB)
    // console.log("Message Deleted", client.user?.username, message.content);
  }

  @On({ event: 'guildDelete' })
    async onGuildDelete([guild]: ArgsOf<'guildDelete'>, client: Client): Promise<void> {
      console.log('delete', guild)
      // let guildDb = connection.collection('guilds').findOne({ id: guild.id })
      // if ()
      const archivedGuild = await connection.collection('guilds').findOne<Guild>({
        id: guild.id,
      })

      const archived = await connection.collection('archive').insertOne({
        ...archivedGuild
      })

      const event = await connection.collection('globalEvents').insertOne({
        name: 'remove',
        type: 'guild',
        gId: guild.id,
        gName: guild.name
      })

      const guildDB = await connection.collection('guilds').deleteOne({
        id: guild.id,
      })
      // console.log(guildDB)
      console.log('Done', archived, event, guildDB);
    }

    @On({ event: 'messageReactionAdd' })
    async onMessageReactionAdd([reaction, user]: ArgsOf<'messageReactionAdd'>, client: Client): Promise<void> {
      console.log('react', user.toString(), user.username, terminalLink('Open message', reaction.message.url))
      cmds.admin.init(client, connection)
      // let guildDb = connection.collection('guilds').findOne({ id: guild.id })
      // if ()
      cmds.admin.onReact(user, reaction)
      // console.log(guildDB)
      // console.log("Message Deleted", client.user?.username, message.content);
    }

    @On({ event: 'messageReactionRemove' })
    async onMessageReactionRemove([reaction, user]: ArgsOf<'messageReactionAdd'>, client: Client): Promise<void> {
      console.log('unreact', user.toString(), user.username, terminalLink('Open message', reaction.message.url) )
      cmds.admin.init(client, connection)
      // let guildDb = connection.collection('guilds').findOne({ id: guild.id })
      // if ()
      cmds.admin.onUndoReact(user, reaction)
      // console.log(guildDB)
      // console.log("Message Deleted", client.user?.username, message.content);
    }

    @On({ event: 'guildMemberAdd' })
    async onGuildMemberAdd([member]: ArgsOf<'guildMemberAdd'>, client: Client): Promise<void> {
      console.log('new user', member.user.username)
      cmds.admin.init(client, connection)
      await cmds.admin.onJoin(member)
    }

    @On({ event: 'guildMemberRemove' })
    async onGuildMemberRemove([member]: ArgsOf<'guildMemberRemove'>, client: Client): Promise<void> {
      console.log('user leave', member.user.username)
      cmds.admin.init(client, connection)
      await cmds.admin.onLeft(member)
    }

    @On({ event: 'guildMemberUpdate' })
    async onGuildMemberUpdate([member, newMember]: ArgsOf<'guildMemberUpdate'>, client: Client): Promise<void> {
      console.log('user update', member.user.username)
      cmds.admin.init(client, connection)
      await cmds.admin.onMemberUpdated(member, newMember)
    }
}
