import { ICommand } from './types.js';
import Music from './comms/Music.v2.js';
import Help from './comms/Help.js';
import Admin from './comms/Admin.js';
import Utility from './comms/Utility.js';

export interface Commands {
  // [key: string]: ICommand
  music: Music,
  help: Help,
  admin: Admin,
  utils: Utility
}

const commands: Commands = {
  music: new Music(),
  help: new Help(),
  admin: new Admin(),
  utils: new Utility()
};


export default commands;
