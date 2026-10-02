import auth from './methods/auth_discord.js';
import getoauthurl from './methods/getoauthurl.js';
import incomeUser from './methods/incomeUser.js';
import getGuilds from './methods/getguilds.js';
import getOwnGuilds from './methods/getownguilds.js';
import getRoles from './methods/getroles.js';
import getusers from './methods/getusers.js';
import getChannels from './methods/getChannels.js';
import getTriggers from './methods/gettriggers.js';
import saveTrigger from './methods/saveTrigger.js';
import getPrefix from './methods/getPrefix.js';
import gettrack from './methods/gettrack.js';
import getQueue from './methods/getQueue.js';
import getsoundtrack from './methods/getsoundtrack.js';
import m_pause from './methods/m_pause.js';
import m_play from './methods/m_play.js';
import m_stop from './methods/m_stop.js';
import m_next from './methods/m_next.js';
import m_skipto from './methods/m_skipto.js';
import m_remove from './methods/m_remove.js';
import m_add from './methods/m_add.js';
import m_search from './methods/m_search.js';
import m_seek from './methods/m_seek.js';
import setPrefix from './methods/setPrefix.js';
import deleteTrigger from './methods/deleteTrigger.js';
import signin from './methods/signin.js';
import generateInvite from './methods/generateInvite.js';
import getGreets from './methods/getGreets.js';
import setGreets from './methods/setGreets.js';
import setAutochannel from './methods/setAutochannel.js';
import getAutochannel from './methods/getAutochannel.js';

export default { 
  auth,
  getoauthurl,
  incomeUser,
  getGuilds,
  getOwnGuilds,
  getTriggers,
  getRoles,
  getusers,
  getChannels,
  getPrefix,
  setPrefix,
  getGreets,
  setGreets,
  saveTrigger,
  deleteTrigger,
  signin,
  generateInvite,
  gettrack,
  getQueue,
  m_pause,
  m_play,
  m_stop,
  m_next,
  m_skipto,
  m_remove,
  m_add,
  m_search,
  m_seek,
  getsoundtrack,
  setAutochannel,
  getAutochannel
}