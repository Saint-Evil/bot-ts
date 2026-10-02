import { CallbackProps } from "@/types"

/** Adds a link (song or playlist) or a search query to the queue from the panel */
export default async function m_add({ user, guildId, query, commands }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]

  if(!guildId)
    return [ 'error', 'No guild provided' ]

  const failure = await commands?.music.apiAdd(guildId, user.id, String(query ?? ''))
  if (failure)
    return [ 'error', failure ]
  return ['service']
}
