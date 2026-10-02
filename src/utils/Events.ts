import { slot, Slot } from "ts-event-bus";

const Events = {
  emit: slot<{guild: string, evt: string}>(),
  soundtrack: slot<{guild: string, track: string}>(),
  audioProgress: slot<{guild: string, dd: number, dl: number}>(),
  error: slot<Error>(),
};

export default Events;