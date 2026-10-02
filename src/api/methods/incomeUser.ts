import { CallbackProps } from "@/types"

export default async function incomeUser({db, user, incomeUser, token}: CallbackProps) {
  console.log('incUser', user, incomeUser)
  if (!token) {
    return [ 'error', 'Token not provided' ]
  }

  /* @ts-ignore */
  const updatedUser = await db.collection('users').findOneAndUpdate({
    id: incomeUser.id
  }, {
    '$set': {
      ...incomeUser,
      token
    }
  }, {
    upsert: true,
    returnDocument: 'after',
    includeResultMetadata: true
  })

  console.log('incUpdUser', updatedUser)
  return [ 'user', updatedUser ]
}