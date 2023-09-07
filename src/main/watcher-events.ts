import { Emitter } from "strict-event-emitter";

type Events = {
  spawnLogWatcher: [];
  killLogWatcher: [];
};

export const watcherEvents = new Emitter<Events>();
