import { CallbackProps } from "@/types"

export default async function getoauthurl({ origin }: CallbackProps) {
  if (!process.env.OAUTH) {
    console.error('No process.env.OAUTH')
    return [ null ]
  }
  // Send the user back to the panel they came from (Discord only accepts redirects registered for the app)
  const url = new URL(process.env.OAUTH)
  if (origin && /^https?:\/\/[^/]+$/.test(origin))
    url.searchParams.set('redirect_uri', `${origin}/oauth/discord`)
  return [ url.toString() ]
}
