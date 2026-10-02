import fs from 'fs'
import { cwd } from 'process'
import { resolve } from 'path'
import downloadAudio from './downloadAudio.js'
import convertVideo from './convertVideo.js'
import EventBus from './EventBus.js'

// Served by express.static from src/public
export const folder = cwd() + '/src'

const inFlight = new Map<string, Promise<string>>()

/** Stable file name for a song: YouTube video id when present (not query params like `si`) */
export const trackName = (url: string) => {
  const id = url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/)?.[1]
  return `temp-${id ?? Buffer.from(url).toString('base64url').slice(-24)}`
}

const download = (url: string, name: string, guild: string) => new Promise<string>((resolve, reject) => {
  const writeStream = fs.createWriteStream(`${folder}/public/${name}.webm`)
  downloadAudio(url)
    .on('progress', (ln: number, dd: number, dl: number) => {
      EventBus.audioProgress({ dd, dl, guild })
    })
    .on('error', (err) => {
      writeStream.destroy()
      reject(err)
    })
    .pipe(writeStream)
    .on('finish', () => {
      convertVideo(name, 'mp3', folder).then((vid) => {
        // The webm is only the ffmpeg source
        fs.rmSync(`${folder}/public/${name}.webm`, { force: true })
        resolve(vid as string)
      }, reject)
    })
})

/**
 * Prepares the mp3 the panel draws its waveform from and announces it to the guild.
 * Concurrent requests for the same song share one download, so the file is never written twice at once.
 */
export const prepareTrack = (url: string, guild: string) => {
  const name = trackName(url)
  let job = inFlight.get(name)
  if (!job) {
    if (fs.existsSync(`${folder}/public/${name}.mp3`)) {
      job = Promise.resolve(`${name}.mp3`)
    } else {
      job = download(url, name, guild).finally(() => inFlight.delete(name))
      inFlight.set(name, job)
    }
  }
  job.then(
    (track) => EventBus.soundtrack({ track, guild }),
    (err) => EventBus.error(err)
  )
  return job
}

/** Absolute path of a fully prepared mp3 of the song, or null when it is missing or still being made */
export const cachedTrack = (url: string) => {
  const name = trackName(url)
  const file = resolve(`${folder}/public/${name}.mp3`)
  return !inFlight.has(name) && fs.existsSync(file) ? file : null
}

// Files touched within this window may still be downloading to a panel
const GRACE_MS = 60 * 1000

/**
 * Deletes temp track files of songs that are in no queue (of any guild) and not being prepared.
 * @param keepUrls urls of all songs currently queued across guilds
 */
export const cleanupTracks = (keepUrls: Iterable<string>) => {
  const keep = new Set([...keepUrls].map(trackName))
  const dir = `${folder}/public`
  let files: string[]
  try {
    files = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const file of files) {
    const name = file.match(/^(temp-.+)\.(webm|mp3)$/)?.[1]
    if (!name || keep.has(name) || inFlight.has(name)) continue
    try {
      if (Date.now() - fs.statSync(`${dir}/${file}`).mtimeMs < GRACE_MS) continue
      fs.rmSync(`${dir}/${file}`, { force: true })
    } catch (err) {
      console.error('[soundtrack] cleanup failed', file, err)
    }
  }
}
