import { CallbackProps } from "@/types"

export default async function m_remove({ user, guildId, index, url, commands }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]

  if(!guildId)
    return [ 'error', 'No guild provided' ]

  if(!commands?.music.apiRemove(guildId, Number(index), url))
    return [ 'error', 'No such song in the queue' ]
  return ['service']
}
