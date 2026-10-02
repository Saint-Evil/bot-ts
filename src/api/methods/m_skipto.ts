import { CallbackProps } from "@/types"

export default async function m_skipto({ user, guildId, index, commands }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]

  if(!guildId)
    return [ 'error', 'No guild provided' ]

  if(!commands?.music.apiSkipTo(guildId, Number(index)))
    return [ 'error', 'No such song in the queue' ]
  return ['service']
}
