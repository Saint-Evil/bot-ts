import { createEventBus } from 'ts-event-bus';
import Events from './Events';

const EventBus = createEventBus({
  events: Events,
});

export default EventBus;
