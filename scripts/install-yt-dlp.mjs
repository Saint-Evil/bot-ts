// Downloads the yt-dlp binary for this platform into bin/ (used for music playback and the panel's waveform).
// Runs on `yarn install`; `yarn ytdlp:update` re-downloads the latest release.
// Skipped when YTDLP_PATH is set. Never fails the install: playback just reports yt-dlp as missing.
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

const update = process.argv.includes('--update')

const asset = (() => {
  if (process.platform === 'win32') return 'yt-dlp.exe'
  if (process.platform === 'darwin') return 'yt-dlp_macos'
  if (process.platform === 'linux') return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
  return null
})()

const dir = join(process.cwd(), 'bin')
const target = join(dir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')

if (process.env.YTDLP_PATH) {
  console.log(`[yt-dlp] YTDLP_PATH is set (${process.env.YTDLP_PATH}), skipping download`)
} else if (!asset) {
  console.warn(`[yt-dlp] no prebuilt binary for ${process.platform}/${process.arch}; install yt-dlp and set YTDLP_PATH`)
} else if (existsSync(target) && !update) {
  // already installed
} else {
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`
  try {
    console.log(`[yt-dlp] downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    mkdirSync(dir, { recursive: true })
    // Write next to the target first so a failed download never leaves a broken binary
    const tmp = `${target}.download`
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
    if (process.platform !== 'win32') chmodSync(tmp, 0o755)
    renameSync(tmp, target)
    console.log(`[yt-dlp] installed to ${target}`)
  } catch (err) {
    console.warn(`[yt-dlp] download failed (${err.message}); put yt-dlp into ${target} or set YTDLP_PATH`)
  }
}
