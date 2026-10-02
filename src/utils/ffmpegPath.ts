import { existsSync } from 'fs'
import { resolve } from 'path'
import ffmpegStatic from 'ffmpeg-static'

const existing = (path?: string) => (path && existsSync(resolve(path)) ? resolve(path) : null)

/** FFMPEG_PATH when it points to an existing file, otherwise the binary installed by ffmpeg-static */
export const ffmpegPath = () => existing(process.env.FFMPEG_PATH) ?? (ffmpegStatic as unknown as string | null) ?? 'ffmpeg'

/** FFPROBE_PATH when it exists; plain conversions don't need ffprobe */
export const ffprobePath = () => existing(process.env.FFPROBE_PATH)
