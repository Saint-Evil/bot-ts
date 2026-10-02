import { CallbackProps } from "@/types";

export default async function getQueue({ db, user, bot, guildId, commands }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]

  if(!guildId)
    return [ 'error', 'No guild provided' ]

  const serverQueue = commands?.music.queue.get(guildId);
  // console.log('got queue', serverQueue);
  if (serverQueue) {
    return ['queue', [ ...serverQueue.songs.map(s => ({
      url: s.url,
      name: s.name,
      author: s.author,
      duration: s.duration
    })) ] ]  
  } else {
    // An empty list lets the panel clear songs left from a finished queue
    return ['queue', []]
  }
}