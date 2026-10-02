import { ICommand } from './types';
import Music from './comms/Music.v2';
import Help from './comms/Help';
import Admin from './comms/Admin';
import Utility from './comms/Utility';

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
