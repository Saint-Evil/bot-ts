import ffmpeg from 'fluent-ffmpeg'
import { dirname } from '@discordx/importer'
import { cwd } from 'process';
import { ffmpegPath, ffprobePath } from './ffmpegPath.js';

const __dirname = dirname(import.meta.url);

const convertVideo = (xs: any, format: string, rootDir: string = cwd()) => {
  const convertedFilePath = `${xs}.${format}`;
  return new Promise((resolve, reject) => {
    const command = ffmpeg(rootDir+'/public/'+xs+'.webm').setFfmpegPath(ffmpegPath())
    const probe = ffprobePath()
    if (probe) command.setFfprobePath(probe)
    command
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
