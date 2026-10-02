import type { Client, Guild, Message, TextChannel, VoiceChannel } from 'discord.js';
import { Db } from 'mongodb';
import fs from 'fs';
import { prepareTrack, cachedTrack, cleanupTracks as cleanupTrackFiles } from '../utils/soundtrack';
import ytpl from 'ytpl';
import ytsr, { Video, Image } from 'ytsr'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } from '@discordjs/voice';
import { DateTime, Duration } from 'luxon';
import { ICommand, Song, VideoItem, PartialMessage, MusicStatus, Response } from '../types';
import { Player, Queue, RepeatMode, Utils } from 'discord-music-player';
import EventBus from '../utils/EventBus';
import convertVideo from '../utils/convertVideo';
import { cwd } from 'process';

const folder = cwd() + '/src';

const isPlaylistUrl = (url: string) =>
  url.startsWith('https://www.youtube.com/playlist?') ||
  (url.startsWith('https://www.youtube.com/watch?') && (url.includes('&list=') || url.includes('?list='))) ||
  url.startsWith('https://open.spotify.com/playlist/')

// const cookie = 'PREF=f6=480&f7=100&tz=Europe.Kyiv&f5=30000&volume=7&autoplay=true; APISID=pGJCYh6FSZ39-Xgs/A5F8ZJfceDeI-l9Xk; SAPISID=S-RgmdHSHYvLmy7H/A06rYZAVSEXnlLcsR; __Secure-1PAPISID=S-RgmdHSHYvLmy7H/A06rYZAVSEXnlLcsR; __Secure-3PAPISID=S-RgmdHSHYvLmy7H/A06rYZAVSEXnlLcsR; SID=WAhUS_UNjB5ZSQXU3UA-2ukEF0kU_NMIpjQa1-xtHG30IzrSQQQACh4y6G6NZV22nieCSw.; SIDCC=AP8dLtwTot6DSOmSE0VOHhwxOi2L0e9CFmxxGPlzf83dakp1qrHt9hSh9CemVr8Yj-OAqp0H7Sga; _gcl_au=1.1.1474912045.1682343726; s_gl=9ac72c6a1fae954ce2c787405a80b298dQIAAABVUw==; wide=0';

class Music implements ICommand { 
  queue: Map<String, Queue> = new Map<String, Queue>();
  bot : Client | null = null;
  db: Db | null = null;
  player: Player | null = null;
  random: Map<string,boolean> = new Map<string,boolean>();

  init = (bot: Client, db: Db): void => {
    if(!this.bot) this.bot = bot;
    if(!this.db) this.db = db;
    // Longer songs are never queued nor downloaded; MAX_SONG_MINUTES=0 disables the limit
    this.maxSongMinutes = Number(process.env.MAX_SONG_MINUTES ?? 180) || 0
    const player = new Player(bot, {
      deafenOnJoin: true,
      quality: 'low',
      timeout: 60,
      /* @ts-ignore option added by our patch of discord-music-player */
      maxSongDuration: this.maxSongMinutes * 60 * 1000,
      // Play (and seek) from the mp3 already prepared for the panel instead of downloading again
      localAudio: cachedTrack,
      // ytdlRequestOptions: {
      //   Headers: {
      //     Cookie: cookie
      //   }
      // }
    });
    this.player = player;
    // Without a listener Player's 'error' event is thrown and kills the process
    player.on('error', (error, queue) => {
      console.error('[Music].[player]', queue?.guild?.id, error)
    })
    // Lets the panel refresh its song list
    const queueChanged = (q: Queue) => EventBus.emit({ guild: q.guild.id, evt: 'queuechanged' })
    player.on('songAdd', queueChanged)
    player.on('playlistAdd', queueChanged)
    player.on('songFirst', queueChanged)
    player.on('queueEnd', (q) => {
      queueChanged(q)
      this.cleanupTracks()
    })
    player.on('queueDestroyed', (q) => {
      queueChanged(q)
      this.cleanupTracks()
    })
    player.on('songChanged',(q, newSong, oldSong) => {
        EventBus.emit({ guild: q.guild.id, evt: 'songchanged' })

        prepareTrack(newSong.url, q.guild.id).catch(() => {})
        this.cleanupTracks()
    })

    // Also catches files left by previous runs
    this.cleanupTracks()
    if (!this.cleanupTimer)
      this.cleanupTimer = setInterval(this.cleanupTracks, 10 * 60 * 1000).unref()
  }

  cleanupTimer: NodeJS.Timeout | null = null;
  maxSongMinutes = 0;

  // play() isn't awaited (slash commands must reply within 3s), so the reason is sent separately
  notifyPlayError = (msg: PartialMessage) => (err: any) => {
    console.error('[Music].[execute]', err)
    if (err?.name === 'SongTooLong')
      msg.channel?.send({ content: `Songs longer than ${Duration.fromObject({ minutes: this.maxSongMinutes }).toFormat("h'h' mm'm'")} are not played.` }).catch(() => {})
  }

  /** Deletes temp track files of songs that are queued in no guild */
  cleanupTracks = () => {
    const queued: string[] = []
    for (const q of this.queue.values())
      if (!q.destroyed) queued.push(...q.songs.map(s => s.url))
    cleanupTrackFiles(queued)
  }

  rebornQueue = (id: string) => {
    const error = (...msg: string[]) => console.error('[Music].[rebornQueue]', ...msg)
    const log = (...msg: string[]) => console.log('[Music].[rebornQueue]', ...msg)
    if (!this.queue.get(id) || this.queue.get(id)?.destroyed || this.queue.get(id)?.songs.length === 0) {
      log('queue is destroyed')
      this.player?.deleteQueue(id)
      const newQ = this.player?.createQueue(id)
      if (newQ) {
        this.queue.set(id, newQ)
        return newQ
      } else {
        error('Cannot recreate queue')
      }
    }
  }

  execute = (msg: PartialMessage, isSlash: boolean = false) => {
    return async (args: string[]) => {
      const error = (...msg: string[]) => console.error('[Music].[execute]', ...msg)
      const log = (...msg: string[]) => console.log('[Music].[execute]', ...msg)

      if (!msg.guild || !msg.guildId || !msg.member) {
        log('Not a guild message')
        return null
      }

      if(!this.bot) {
        error('No bot for initialization')
        return
      }
      
      if (!this.player) {
        this.player = new Player(this.bot)
      }

      let serverQueue : Queue | undefined = this.queue.get(msg.guild?.id);
      // console.log(serverQueue)
      const voiceChannel = msg.member.voice.channel;

      const gid = msg.guild.id

      // Queue.leave() (timeout, stop, empty channel) marks the queue destroyed without
      // always emitting 'queueDestroyed', so a stale queue has to be replaced here
      if (!serverQueue || serverQueue.destroyed) {
        if (serverQueue) log('Queue was destroyed, creating a new one')
        const guildQueue = this.player.createQueue(gid);
        this.queue.set(gid, guildQueue);
        serverQueue = guildQueue;
      }
      // serverQueue.textChannel = msg.channel;
      const me = msg.guild.members.me
      if (!me) {
        error('Me not found')
        return
      }
      if (!this.player) {
        error('Player not found')
        return
      }
      let musiccmd = args.shift();
      if(!musiccmd)
      {
        msg.channel?.send({ content: 'No command to execute. Use `>help music` to get detaled info.' })
        return
      }
      else {
        musiccmd = musiccmd.toLowerCase();
      }
      switch(musiccmd){
        case 'play':
         {
           if (!voiceChannel) {
              const reply = { content: 'You need to be in a voice channel to play music!' }
              return isSlash ? reply : msg.channel?.send(reply);
            }
            const permissions = voiceChannel.permissionsFor(me);
            if (!permissions.has('Connect') || !permissions.has('Speak')) {
              const reply = { content: 'I need the permissions to join and speak in your voice channel!' }
              return isSlash ? reply : msg.channel?.send(reply);
            }
            let reply = { content: 'Default message' }

            if(args.length > 0) {
              const url = args.shift();
              let videos: VideoItem[] = [];
              reply.content = 'No query, url or it does not match supported format'
              if (!url) {
                error ('Smth strange with url (args)')
                const reply = { content: 'No query, url or it does not match supported format' }
                return isSlash ? reply : msg.channel?.send(reply);
              }
              log(url)
              await serverQueue.join(voiceChannel);
              if(isPlaylistUrl(url)) {
                serverQueue.playlist(url, {
                  shuffle: this.random.get(gid) || false,
                  requestedBy: msg.member.user,
                }).catch(this.notifyPlayError(msg))
              }
              else if(url.startsWith('https://www.youtube.com/watch?') || url.startsWith('https://youtube') || url.startsWith('https://music.youtube') || url.startsWith('https://youtu.be/') || url.startsWith('https://open.spotify.com/track/')) {
                serverQueue.play(url).catch(this.notifyPlayError(msg))
              }
              else if (url.startsWith('"')) {
                const sreq = [ url, ...args ].join(" ").replace('"', '')
                serverQueue.play(sreq).catch(this.notifyPlayError(msg))
              } else {
                const reply = { content: 'This source is not supported yet' }
                return isSlash ? reply : msg.channel?.send(reply)
              }
            } else if(!serverQueue || serverQueue.songs.length == 0) {
              reply.content = 'Sorry, nothing to play :('
              return reply
            }
        
            reply.content = `Player will now play!`
            return isSlash ? reply : msg.channel?.send(reply)
          }
          break;
        case 'skip':
          {
            const result = this.skip(msg, serverQueue, args);
            return isSlash ? result : msg.channel?.send(result)
          }
          break;
        case 'stop':
          {
            const result = this.stop(msg, serverQueue);
            let guildQueue = this.player.getQueue(msg.guild.id);
            guildQueue?.stop();
            return isSlash ? result : msg.channel?.send(result)
          }
          break;
        case 'pause':
          {
            const result = this.pause(msg.guild);
            return isSlash ? result : msg.channel?.send(result)
          }
          break;
        case 'shuffle': {
            const result = this.setRandom(msg.guild.id)
            return isSlash ? result : msg.channel?.send(result)
          }
          break;
        case 'repeat':
          {
            const result = this.setRepeat(msg.guild.id)
            return isSlash ? result : msg.channel?.send(result)
          }
          break;
        case 'status':
          {
            const result = this.status<Response>(msg.guild.id, false);
            return isSlash ? result : msg.channel?.send(result)
          }
          break;
        default: 
          if (isSlash) { return { content: 'No such command in command list' } } 
          break;
      }
    }
  }

  skip = (message: PartialMessage, serverQueue: Queue, args: string[]) => {
    if (!message.member?.voice.channel) {
      const reply = { content: 'You have to be in a voice channel to stop the music!' }
      return reply
    }
    if (!serverQueue) {
      const reply = { content: 'There is no song that I could skip!' }
      return reply
    } 
    const song = serverQueue.nowPlaying;
    let toSend = "";
    let minIdx = 0, maxIdx = 1;
    if(args.length > 0 && args[0])
    {
      const toSkip : number[] = []
      if(args[0].includes('-')){
        const range = args[0].split('-');
        minIdx = Math.min(Number(range[0]), Number(range[1])) || 1;
        maxIdx = Math.max(Number(range[0]), Number(range[1])) || 2;
        for(let i = minIdx - 2; i <= maxIdx - 2;  i++){
          toSkip.push(i || 0);
        }
      }
      else
      {
        toSkip.push(Number(args[0]) - 1 || 0)
        minIdx = Number(args[0]) - 1 || 0;
      }
      serverQueue.songs = serverQueue.songs.filter((song, index) => !toSkip.includes(index));
      if(minIdx <= 1) {
        serverQueue.skip()
      }
      toSend = `${toSkip.length} songs skipped!`
      if (minIdx > 1) toSend += ' First skip index is rather than current song, thus we keep it playing!'
    }
    else
      toSend = `${song?.name} skipped!`
    const reply = { content: toSend }
    if(minIdx <= 0) {
      serverQueue.skip()
    }
    return reply
  }

  /** YouTube suggestions for the panel's search box; songs over the length limit are left out */
  apiSearch = async (query: string, limit = 8) => {
    query = query.trim()
    if (!query || !this.player) return []
    // Utils.search reads the length limit from queue.player.options
    const songs = await Utils.search(query, {}, { player: this.player } as unknown as Queue, limit).catch(() => [])
    return songs.map((song) => ({
      title: song.name,
      subtitle: song.author,
      url: song.url,
      duration: song.duration,
      // Search gives hq720 images; the list only needs a small preview
      thumbnail: song.url.match(/[?&]v=([\w-]{11})/)
        ? `https://i.ytimg.com/vi/${song.url.match(/[?&]v=([\w-]{11})/)![1]}/mqdefault.jpg`
        : song.thumbnail,
    }))
  }

  /**
   * Adds a song, playlist or search query to the guild queue from the panel.
   * Joins the voice channel the user sits in when the bot is not connected yet.
   * @returns an error message, or null on success
   */
  apiAdd = async (guildId: string, userId: string | undefined, query: string): Promise<string | null> => {
    const error = (...msg: any[]) => console.error('[Music].[apiAdd]', ...msg)
    query = query.trim()
    if (!query) return 'Enter a link or a search query'
    if (!this.bot || !this.player) return 'Player is not ready'
    const guild = this.bot.guilds.cache.get(guildId)
    if (!guild) return `I'm not at this guild`

    let serverQueue = this.queue.get(guildId)
    if (!serverQueue || serverQueue.destroyed) {
      serverQueue = this.player.createQueue(guildId)
      this.queue.set(guildId, serverQueue)
    }

    const member = userId ? await guild.members.fetch(userId).catch(() => null) : null
    try {
      if (!serverQueue.connection) {
        const voiceChannel = member?.voice.channel
        if (!voiceChannel) return 'Join a voice channel on this server first'
        const me = guild.members.me
        const permissions = me && voiceChannel.permissionsFor(me)
        if (!permissions?.has('Connect') || !permissions.has('Speak'))
          return 'I need the permissions to join and speak in your voice channel'
        await serverQueue.join(voiceChannel)
      }
      if (isPlaylistUrl(query)) {
        await serverQueue.playlist(query, {
          shuffle: this.random.get(guildId) || false,
          requestedBy: member?.user,
        })
      } else {
        await serverQueue.play(query, { requestedBy: member?.user })
      }
      return null
    } catch (err: any) {
      error(err)
      if (err?.name === 'SongTooLong')
        return `Songs longer than ${Duration.fromObject({ minutes: this.maxSongMinutes }).toFormat("h'h' mm'm'")} are not played`
      return err?.message || 'Could not add the song'
    }
  }

  /**
   * Removes the song at `index` of the queue (0 skips the one playing now).
   * `url` guards against removing another song if the queue changed meanwhile.
   */
  apiRemove = (guildId: string, index: number, url?: string) => {
    const serverQueue = this.queue.get(guildId);
    if (!serverQueue || serverQueue.destroyed || !Number.isInteger(index) || index < 0 || index >= serverQueue.songs.length)
      return false;
    if (url && serverQueue.songs[index].url !== url)
      return false;
    if (index === 0) {
      serverQueue.skip();
    } else {
      serverQueue.remove(index);
      EventBus.emit({ guild: guildId, evt: 'queuechanged' })
    }
    return true;
  }

  /** Skips straight to the song at `index` of the queue (0 is the one playing now) */
  apiSkipTo = (guildId: string, index: number) => {
    const serverQueue = this.queue.get(guildId);
    if (!serverQueue || !Number.isInteger(index) || index < 1 || index >= serverQueue.songs.length)
      return false;
    serverQueue.skip(index - 1);
    return true;
  }

  apiNext = (guildId: string) => {
    const serverQueue = this.queue.get(guildId);
    if(serverQueue) {
      serverQueue.skip()
      // serverQueue.send({ content: `${song?.title} skipped!` }).finally(() => {
      //   serverQueue.connection && serverQueue.connection.dispatcher && serverQueue.connection.dispatcher.end();
      // });
      return;
    }
  }
  
  /** Seeks the current song; `pos` in milliseconds */
  apiSeek = async (guildId: string, pos: number) => {
    const error = (...msg: string[]) => console.error('[Music].[apiSeek]', ...msg)
    const log = (...msg: string[]) => console.log('[Music].[apiSeek]', ...msg)

    const serverQueue = this.queue.get(guildId);
    if (!serverQueue || serverQueue.destroyed || !serverQueue.isPlaying || !serverQueue.nowPlaying) {
      error('No song')
      return false
    }
    try {
      // Restarting the stream while paused would play it while the queue still thinks it is paused
      if (serverQueue.paused) serverQueue.setPaused(false)
      await serverQueue.seek(pos)
      return true
    } catch (err) {
      error(err as string)
      return false
    }
  }
  
  stop = (message: PartialMessage, serverQueue: Queue) => {
    const error = (...msg: string[]) => console.error('[Music].[stop]', ...msg)
    const log = (...msg: string[]) => console.log('[Music].[stop]', ...msg)

    if (!message.guildId) {
      log('DM')
      return { content: 'Not a guild!' }
    }

    if (!message.member?.voice.channel) {
      const reply = { content: 'You have to be in a voice channel to stop the music!' }
      return reply
    }
    serverQueue.stop();
    serverQueue.clearQueue();
    serverQueue.leave();

    return { content: 'Queue is emptied!' }
  }
  
  play = async (guildId: string) => {
    const error = (...msg: string[]) => console.error('[Music].[play]', ...msg)
    const log = (...msg: string[]) => console.log('[Music].[play]', ...msg)

    
    const serverQueue = this.queue.get(guildId);
    if(!serverQueue) return
    if(serverQueue.paused) {
      serverQueue.setPaused(false)
    }
    
    serverQueue.setPaused(false)
  }

  pause = (guild: Guild) => {
    const serverQueue = this.queue.get(guild.id);
    let reply = { content: 'No queue or current song!' }
    if(!serverQueue || !serverQueue.nowPlaying) return reply
    if (!serverQueue.nowPlaying) {
      reply.content = 'Nothing to pause :('
      return reply
    }
    if(serverQueue.paused) {
      serverQueue.setPaused(false)
      reply.content = 'Player resumed!'
    } 
    else
    {
      serverQueue.setPaused(true);
      reply.content = 'Player paused'
    }
    return reply
  }

  setRandom = (guildId: string) => {
    this.random.set(guildId, !this.random.get(guildId))
    if (this.queue.get(guildId)) {
      this.queue.get(guildId)?.shuffle()
      return `Shuffle mode set [${this.random.get(guildId) ? 'enabled' : 'disabled'}].`
    }
    return `Shuffle mode set [${this.random.get(guildId) ? 'enabled' : 'disabled'}]. Next playlist will be [${this.random.get(guildId) ? 'randomized' : 'strict'}]..`
  }

  getMode = (guildId: string, mode?: string) => {
    if (!mode) {
      const currentRepMode = this.queue.get(guildId)?.repeatMode
      if (currentRepMode === RepeatMode.DISABLED) {
        return RepeatMode.QUEUE;
      } else if (currentRepMode === RepeatMode.QUEUE) {
        return RepeatMode.SONG;
      } else {
        return RepeatMode.DISABLED;
      }
    } else {
      return RepeatMode[mode.toUpperCase() as keyof typeof RepeatMode];
    }
  }
  setRepeat = (guildId: string, mode?: string) => {
    if (this.queue.get(guildId)) {
      const nextMode = this.getMode(guildId, mode);
      const modeSet = this.queue.get(guildId)?.setRepeatMode(nextMode)
      // RepeatMode is a numeric enum; show its name instead of 0/1/2
      return `Repeat mode ${modeSet ? 'was' : 'wasn`t'} set to "${RepeatMode[nextMode]?.toLowerCase() ?? mode}"`
    }
    return `Player is not started`
  }

  status = <T>(guildId: string, api: boolean): T => {
    const error = (...msg: string[]) => console.error('[Music].[status]', ...msg)
    const log = (...msg: string[]) => console.log('[Music].[status]', ...msg)
    // console.log('STATUS', api)
    // After the bot leaves voice the queue is destroyed but keeps isPlaying, and its getters throw
    const guildQueue = this.queue.get(guildId);
    const serverQueue = guildQueue && !guildQueue.destroyed ? guildQueue : undefined;
    const getPlayingStatus = () => {
      let status = 'Not started.';
      try {
        if(!serverQueue || (serverQueue && !serverQueue.nowPlaying))
          status = 'Not started.';
        if(serverQueue && !serverQueue.nowPlaying && serverQueue.songs.length > 0)
          status = 'Started. Nothing to play.';
        // `paused` throws NothingPlaying while the next song is still loading
        if(serverQueue && serverQueue.nowPlaying && serverQueue.isPlaying && serverQueue.paused)
          status = 'Paused.'
        if(serverQueue && serverQueue.nowPlaying && serverQueue.isPlaying && !serverQueue.paused)
          status = 'Playing.'
        // After a seek or song change the new stream takes a moment to start; the position stands still meanwhile
        if(status === 'Playing.' && serverQueue?.connection?.player.state.status === AudioPlayerStatus.Buffering)
          status = 'Loading.'
      }catch(err: any) {
        error(err)
      }
      return status; 
    };

    const getCurrentSong = () => {
      let song: string = 'None';
      if(serverQueue && serverQueue.nowPlaying)
        song = serverQueue.nowPlaying.name || 'None'
      return song;
    }

    const getAuthor = () => {
      let song = {
        name: 'None'
      }
      if(serverQueue && serverQueue.nowPlaying)
        song = { name: serverQueue.nowPlaying.author }
      return song;
    }

    const getSongPosition = (api: boolean) => {
      let postition = api ? 0 : '0:00';
      if (!serverQueue || !serverQueue.connection || !serverQueue.nowPlaying) return postition;

      const time = (serverQueue.connection.time + serverQueue.nowPlaying.seekTime) || 0
      postition = api ? (time) : Duration.fromMillis(time).toFormat('m:ss');
      return postition;
    }

    const getSongsLeft = () => {
      let left = 0;
      if(serverQueue)
        left = serverQueue.songs.length;
      return left;
    }

    const getThumbnail = (api: boolean) => {
      // const placeholder = "https://pngimage.net/wp-content/uploads/2018/05/apagar-png-5.png";
      // Relative to the bot HTTP server (src/public); the panel prefixes its API_URL
      const placeholder = "poff.png";
      let thumbnail = placeholder
      if(serverQueue && serverQueue.nowPlaying)
      {
        if (api) {
          thumbnail = (serverQueue.nowPlaying.thumbnail || placeholder)
        } else {
          thumbnail = (serverQueue.nowPlaying.thumbnail || placeholder)
        }
      }
      return thumbnail;
    }

    if (api) {
      return {
        status: getPlayingStatus(),
        title:  getCurrentSong() ? getCurrentSong().split('|')[0] : 'Title',
        author: getAuthor() ? getAuthor() : 'Author',
        time: getSongPosition(api),
        thumb: getThumbnail(api),
        url: (serverQueue && serverQueue.nowPlaying) ? serverQueue.nowPlaying.url : null,
        driver: 'DMP'
      } as unknown as T
    }

    const embed = {
      color: 0x0099ff,
      title: 'Current player state:',
      url: 'https://discord.js.org',
      author: {
        name: 'Some name',
        icon_url: 'https://i.imgur.com/AfFp7pu.png',
        url: 'https://discord.js.org',
      },
      description: 'Some description here',
      thumbnail: {
        url: 'https://i.imgur.com/AfFp7pu.png',
      },
      fields: [
        {
          name: 'Status',
          value: getPlayingStatus(),
        },
        {
          name: 'Current song',
          value: getCurrentSong(),
        },
        {
          name: 'Position',
          value: getSongPosition(false),
        },
        {
          name: 'Songs left',
          value: getSongsLeft(),
        }
      ],
      image: {
        url: 'https://i.imgur.com/AfFp7pu.png',
      },
      timestamp: new Date(),
      footer: {
        text: 'Some footer text here',
        icon_url: 'https://i.imgur.com/AfFp7pu.png',
      },
    };

    // const embed = new MessageEmbed()
    //   .setColor('#0099ff')
    //   .setTitle('Current player state:')
    //   .addFields(
    //     {
    //       name: 'Status',
    //       value: getPlayingStatus(),
    //     },
    //     {
    //       name: 'Current song',
    //       value: getCurrentSong(),
    //     },
    //     {
    //       name: 'Position',
    //       value: getSongPosition(),
    //     },
    //     {
    //       name: 'Songs left',
    //       value: getSongsLeft(),
    //     }
    //   )
    //   .setTimestamp();
    
      
    if(getPlayingStatus() == 'Not started.') {
      embed.thumbnail = { url: getThumbnail(false) }
    }else{
      embed.image = { url: getThumbnail(false) };
      if(getCurrentSong() !== 'None' && serverQueue?.nowPlaying) {
        embed.url = serverQueue.nowPlaying.url;
      }
    }
    
    // console.log(embed)
    return { content: 'Status', embeds: [embed] } as unknown as T
    // serverQueue?.textChannel.send();
  }
  
  shortDescription = (): string => {
    return 'Music provider';
  }

  detailedDescription = (): string => {
    return `Use this provider to listen to music.
    Available commands: \`play\`, \`skip\`, \`pause\`, \`stop\`, \`status\`.
    
    Usage: \`\`\`
  >music play {youtube video or playlist link}

  >music status

  >music skip

  >music skip 1-5\`\`\``;
  }

}


export default Music;
