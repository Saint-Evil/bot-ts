import { CallbackProps } from "@/types";

export default async function m_play({ db, user, guildId, commands }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]
  
  if(!guildId)
    return [ 'error', 'Guild not provided' ]

  const serverQueue = commands?.music.queue.get(guildId);

  if(!serverQueue || serverQueue.destroyed || !serverQueue.isPlaying)
    return [ 'error', 'Nothing is playing']

  if (serverQueue.paused && serverQueue.nowPlaying) {
    // play() takes the guild id itself, unlike pause() which takes a guild-like object
    await commands?.music.play(guildId)
  } else {
    /* @ts-ignore */
    commands?.music.pause({ id: guildId })
  }
  return ['service']
}