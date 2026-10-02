import ffmpeg from 'fluent-ffmpeg'
import { dirname } from '@discordx/importer'
import { cwd } from 'process';

const __dirname = dirname(import.meta.url);

const convertVideo = (xs: any, format: string, rootDir: string = cwd()) => {
  const convertedFilePath = `${xs}.${format}`;
  return new Promise((resolve, reject) => {
    if (!process.env.FFMPEG_PATH) {
      console.error('No process.env.FFMPEG_PATH')
      return reject(new Error('No process.env.FFMPEG_PATH'))
    }
    if (!process.env.FFPROBE_PATH) {
      console.error('No process.env.FFPROBE_PATH')
      return reject(new Error('No process.env.FFPROBE_PATH'))
    }
    ffmpeg(rootDir+'/public/'+xs+'.webm')
      .setFfmpegPath(process.env.FFMPEG_PATH)
      .setFfprobePath(process.env.FFPROBE_PATH)
      .toFormat(format)
      .on("start", commandLine => {
        console.log(`Spawned Ffmpeg with command: ${commandLine}`);
      })
      .on("error", (err, stdout, stderr) => {
        console.log(err, stdout, stderr);
        reject(err);
      })
      .on("end", (stdout, stderr) => {
        console.log(stdout, stderr);
        resolve(convertedFilePath);
      })
      .saveToFile(rootDir+'/public/'+`${convertedFilePath}`);
  });
};

export default convertVideo;
