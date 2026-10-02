import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { PassThrough } from 'stream'

// Same lookup as the patched discord-music-player: YTDLP_PATH, then ./bin/yt-dlp(.exe), then PATH
export const ytDlpPath = () => {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH
  const local = join(process.cwd(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
  return existsSync(local) ? local : 'yt-dlp'
}

/**
 * Downloads the lowest quality audio of a YouTube video with yt-dlp.
 * Emits ytdl-like events: 'progress' (chunkLength, downloaded, total), 'end' only on success, 'error' otherwise.
 */
export default function downloadAudio(url: string) {
  const out = new PassThrough()
  const proc = spawn(ytDlpPath(), [
    '-f', 'worstaudio[ext=webm]/worstaudio/bestaudio',
    '-o', '-', '--quiet', '--no-warnings', '--no-playlist', '--no-part',
    '--progress', '--newline',
    '--progress-template', 'download:%(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s',
    url
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })

  let stderr = ''
  let downloaded = 0
  proc.stderr.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      const progress = line.match(/^(\d+) (\d+)/)
      if (progress) {
        const current = Number(progress[1])
        out.emit('progress', current - downloaded, current, Number(progress[2]))
        downloaded = current
      } else if (line.trim()) {
        stderr = (stderr + line + '\n').slice(-2000)
      }
    }
  })

  proc.stdout.pipe(out, { end: false })
  proc.on('error', (err: NodeJS.ErrnoException) => {
    out.destroy(err.code === 'ENOENT' ? new Error(`yt-dlp not found (${ytDlpPath()}). Install yt-dlp or set YTDLP_PATH`) : err)
  })
  proc.on('close', (code) => {
    if (code === 0) out.end()
    else if (!out.destroyed) out.destroy(new Error(stderr.trim().split('\n').pop() || `yt-dlp exited with code ${code}`))
  })
  out.on('close', () => {
    if (proc.exitCode === null) proc.kill()
  })
  return out
}
