/// <reference path="../../node_modules/ytdl-core/typings/index.d.ts" />
// `ytdl-core` is installed as an alias of `@distube/ytdl-core`, whose typings
// only declare the `@distube/ytdl-core` module name.
declare module 'ytdl-core' {
  import ytdl = require('@distube/ytdl-core');
  export = ytdl;
}
