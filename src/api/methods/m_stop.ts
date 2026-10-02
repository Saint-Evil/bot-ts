import { CallbackProps } from "@/types"

export default async function m_stop({ db, user, commands, guildId }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]
  
  /* @ts-ignore */
  commands?.music.stop({ id: guildId })  
  return ['track', null ]  
}