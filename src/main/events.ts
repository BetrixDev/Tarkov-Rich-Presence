import EventEmitter from "events";

export type PrepareToEscapeState = "insurance" | "confirmation" | "looking-for-group";

export type NewRaidData =
  | {
      map: string;
      type: "Online";
    }
  | {
      type: "Offline";
    };

type GameEvent =
  | {
      type: "main-menu";
    }
  | {
      type: "trader-screen";
    }
  | {
      type: "flea-market-screen";
    }
  | {
      type: "prepare-to-escape";
      state: PrepareToEscapeState;
    }
  | {
      type: "raid-end";
    }
  | {
      type: "looking-for-raid";
    }
  | {
      type: "new-raid";
      data: NewRaidData;
    };

interface EmitterEvents {
  updateWatchPath: (newPath: string) => void;
  killWatcher: () => void;
  spawnWatcher: () => void;
  newGameSession: () => void;
  endGameSession: () => void;
  updateGameEvent: (args: GameEvent) => void;
}

declare interface TypedEventEmitter {
  on<U extends keyof EmitterEvents>(event: U, listener: EmitterEvents[U]): this;
  off<U extends keyof EmitterEvents>(event: U, listener: EmitterEvents[U]): this;
  once<U extends keyof EmitterEvents>(event: U, listener: EmitterEvents[U]): this;
  emit<U extends keyof EmitterEvents>(event: U, ...args: Parameters<EmitterEvents[U]>): boolean;
}

class TypedEventEmitter extends EventEmitter {}

export const events = new TypedEventEmitter();
