import { CallbackProps } from "@/types"

/** Search suggestions (title, author, duration, thumbnail, url) for the panel's add song box */
export default async function m_search({ user, query, commands }: CallbackProps) {
  if(!user)
    return [ 'error', 'Not authorized' ]

  return [ 'suggestions', await commands?.music.apiSearch(String(query ?? '')) ?? [] ]
}
