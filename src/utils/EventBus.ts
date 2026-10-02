import { createEventBus } from 'ts-event-bus';
import Events from './Events.js';

const EventBus = createEventBus({
  events: Events,
});

export default EventBus;
