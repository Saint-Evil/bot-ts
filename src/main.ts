import 'reflect-metadata';
import { dirname, importx } from '@discordx/importer'
import { Interaction, Message, MessageReaction, OAuth2Scopes, PartialMessageReaction, PartialUser, User } from 'discord.js'

import { Server } from 'http'
import { Server as SockServ } from 'socket.io'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'

import fs from 'fs'

import bot from './utils/bot'
import commands from './commands'
import methods from './api/index'
import client, { connection } from './utils/db'
import { Db } from 'mongodb'
import { prepareTrack } from './utils/soundtrack'
import { Callback, CallbackProps, DsUser } from './types'
import { fileURLToPath } from 'url';
import { DateTime, Duration } from 'luxon';
import EventBus from './utils/EventBus';
import convertVideo from './utils/convertVideo';
import { cwd } from 'process';

// const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(import.meta.url);

// import { IntentsBitField } from 'discord.js';
// import { Client } from 'discordx';

// export const bot = new Client({
//   botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

//   // Discord intents
//   intents: [
//     IntentsBitField.Flags.Guilds,
//     IntentsBitField.Flags.GuildMembers,
//     IntentsBitField.Flags.GuildMessages,
//     IntentsBitField.Flags.GuildMessageReactions,
//     IntentsBitField.Flags.GuildVoiceStates,
//     IntentsBitField.Flags.GuildMessageTyping,
//     IntentsBitField.Flags.DirectMessageTyping,
//     IntentsBitField.Flags.GuildPresences
//   ],

//   // Debug logs are disabled in silent mode
//   silent: false,

//   // Configuration for @SimpleCommand
//   simpleCommand: {
//     prefix: '>',
//   },
// })

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(express.static(__dirname+'/public/'))
const http = new Server(app);
const srv = new SockServ(http, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});
dotenv.config({ quiet: true })

bot.once('ready', async () => {
  await bot.guilds.fetch();
  await bot.initApplicationCommands();
  console.log("Bot started");
  console.log(bot.generateInvite(
    {
      scopes: [OAuth2Scopes.Bot],
      permissions: ['Administrator']
    }
  ))
})

bot.on("interactionCreate", (interaction: Interaction) => {
  bot.executeInteraction(interaction);
});

// bot.on("messageCreate", (message: Message) => {
//   bot.executeCommand(message);
// });

// bot.on("messageReactionAdd", (reaction: PartialMessageReaction | MessageReaction, user: PartialUser | User) => {
//   console.log('reaction', user.toString())
//   commands.admin.onReact(user, reaction)
// })

// bot.on("messageReactionRemove", (reaction: PartialMessageReaction | MessageReaction, user: PartialUser | User) => {
//   console.log('unreaction', user.toString())
//   commands.admin.onUndoReact(user, reaction)
// })

async function run() {
  if(!process.env.TOKEN) {
    console.error('No bot token provided')
    process.exit(1)
  }
  const db: Db = connection //(await client.connect()).db('latte')
  for(const cmd in commands) {
    /* @ts-ignore */
    commands[cmd].init(bot, db)
  }
  const token: string = process.env.TOKEN || ''

  app.get('/', function(req, res){
    console.log('Its trying get me!')
    res.sendFile(__dirname+'/templates/successful_login.html')
  });

  app.get('/auth/discord', async (req, res) => { 
   const token = await methods.auth({db, code: req.query.code?.toString() })
  //  console.log(token) 
   return token
  }, function(req, res){
    res.sendFile(__dirname+'/templates/successful_login.html')
  });

  app.get('/api/gettrack/:gid', async (req, res) => {
    const guildId = req.params.gid
    const servQ = commands.music.queue.get(guildId)
    console.log('>GETTRACK')
    if (servQ && servQ.nowPlaying) {
      console.log('Now playing', servQ.nowPlaying)
      try {
        res.send(await prepareTrack(servQ.nowPlaying.url, guildId))
      } catch (e) {
        res.send('error')
      }
    }
  })

  srv.on('error', (reason) => {
    console.error('SRV Error', reason);
  })
  srv.on('connect_error', function(err) {
    console.error('SRV Error', err);
  });
  srv.on('connection', (socket) => {
    console.log('..new connection')
    let user: DsUser;
    let guildId: string | undefined = undefined;

    const unsubAudioProg = EventBus.audioProgress.on(({guild, dl, dd}) => {
      console.log('1pg', guild, dd, dl)
      if (guildId === guild) {

        socket.emit('audioprogress', {dd, dl});
      }
    })

    const unsubTrack = EventBus.soundtrack.on(({guild, track}) => {
      if (guildId === guild) {
        socket.emit('soundtrack', track);
      }
    })

    const unsubEvts = EventBus.emit.on(({guild, evt}) => {
      if (guildId === guild) {
        switch (evt) {
          case 'songchanged':
            socket.emit('songchanged');
            break;
          case 'queuechanged':
            socket.emit('queuechanged');
            break;
        }
      }
    })

    socket.on('error', (reason) => {
      console.error('Socket Error', reason);
    })
    socket.on('connect_error', function(err) {
      console.error('Socket Error', err);
    });

    socket.on('disconnect', async (reason) => {
      console.error('Socket Disconnect', reason);
      unsubAudioProg();
      unsubTrack();
      unsubEvts();
      if(user)
        await db.collection('users').updateOne( { _id: user._id }, { $set: user } );
    })

    socket.on('gettrack', async ({ guildId }) => {
      const servQ = commands.music.queue.get(guildId)
      console.log('--GETTRACK')
      if (servQ && servQ.nowPlaying) {
        // Announces the file to the guild via EventBus.soundtrack; errors go to EventBus.error
        prepareTrack(servQ.nowPlaying.url, servQ.guild.id).catch(() => {})
      }
    })

    socket.on('action', async (originalPayload, cb) => {
      const payload: CallbackProps = {
        ...originalPayload,
        db,
        id: user ? user._id : undefined,
        user: originalPayload.user || user,
        bot,
        commands
      };
      if (payload.method !== 'gettrack')
        console.log('method: ', payload.method)
      
      if (payload.guildId || payload.guild) {
        guildId = payload.guildId || payload.guild?.id;
      }
        /* @ts-ignore */
      if (!methods[payload.method]) {
        socket.emit('error', 'Unknown method')
        return
      }
      // console.log('__>USER:', payload.user)
      const requireAuth = [
        'getGuilds',
        'getOwnGuilds',
        'getTriggers',
        'getChannels',
        'gettrack',
        'getsoundtrack',
        'getusers',
        'getRoles',
        'getPrefix'
      ]

      if(requireAuth.includes(originalPayload.method) && !user)
      {
        console.log('original:', originalPayload)
        socket.emit('getuser', originalPayload)
        if(cb)
          cb(originalPayload)
        return
      }

      let result: any[];
      try {
        /* @ts-ignore */
        result = await methods[payload.method](payload);
      } catch (err) {
        // A failing panel request must not take the whole bot down
        console.error('method failed:', payload.method, err)
        result = [ 'error', (err as Error)?.message || 'Internal error' ]
      }
      if (!result)
        result = [ 'error', 'Empty result' ]

      if (result[0] == 'error') {
        console.log('met-res', payload.method, result)
      }
      if(result[0] == 'signin-ok' || result[0] == 'user')
        user = result[1];

      // console.log('user:: ', user)
      if(cb)
        cb(result);
      else if (Array.isArray(result))
        /* @ts-ignore */
        socket.emit(...result);
    })
  });
  // The following syntax should be used in the commonjs environment
  //
  await importx(__dirname + "/{events,tscmds}/**/*.{ts,js}");

  // The following syntax should be used in the ECMAScript environment
  // await importx(dirname(import.meta.url) + "/{events,tscmds}/**/*.{ts,js}");

  // Let's start the bot
  // if (!process.env.BOT_TOKEN) {
  //   throw Error("Could not find BOT_TOKEN in your environment");
  // }

  
  app.listen(process.env.PORT || 8090, function(){
    console.log(`listening on 82.193.104.224:${process.env.PORT}`);
  });

  srv.listen(Number.parseInt(process.env.PORT_SOCK||'8099'))

  // bot.on('guildMemberUpdate', commands.admin.onMemberUpdated)
  
  bot.on('messageCreate', async (msg: Message) => {
    // TODO: conditional
    if (msg.author.bot) return;

    // console.log('message')
    if (msg.guildId) {
      // console.log('guildId')
      // Guild message
      const triggersOnMessage = await (await db.collection('callbacks').find({
        guild: msg.guildId,
        trigger: 'OnMessage'
      })).toArray()
      let prefix = '>'
      const dbguild = await db.collection('guilds').findOne({
        id: msg.guildId
      })
      const guildPrefix = dbguild?.prefix
      if(guildPrefix)
        prefix = guildPrefix
      // console.log('guild prefix', prefix)
      // console.log('got prefix', msg)
      if (!msg.content.startsWith(prefix) && triggersOnMessage.length === 0) return;
      // console.log('ok')
      if(triggersOnMessage.length > 0) {
        commands.admin.onMessage(msg, triggersOnMessage as Callback[])
      }
      // console.log(msg.guild.id);
      const commandBody = msg.content.slice(prefix.length);
      // console.log(commandBody)
      const args = commandBody.split(' ');
      const command = args.shift()?.toLowerCase();
      // console.log(command)
      if(command) {
        if(command && Object.keys(commands).includes(command)) {
          /* @ts-ignore */
          commands[command].execute(msg)(args);
        }
      }
    }
  })
  // Log in with your bot token
  await bot.login(token);
}

run();