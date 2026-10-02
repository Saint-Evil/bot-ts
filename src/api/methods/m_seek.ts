import { CallbackProps } from "@/types";

/** `pos` is the position in seconds, as the panel's waveform reports it */
export default async function m_seek({ user, guildId, commands, pos }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]
  if(!guildId)
    return [ 'error', 'No guild provided' ]
  const seconds = Number(pos)
  if(!Number.isFinite(seconds) || seconds < 0)
    return [ 'error', 'Invalid position' ]

  if(!await commands?.music.apiSeek(guildId, seconds * 1000))
    return [ 'error', 'Nothing to seek' ]
  return ['service']
}
