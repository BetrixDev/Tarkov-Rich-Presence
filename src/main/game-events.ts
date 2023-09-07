import { Emitter } from "strict-event-emitter";

export type PrepareToEscapeState = "insurance" | "confirmation" | "looking-for-group";

export type NewRaidData =
  | {
      map: string;
      type: "Online";
    }
  | {
      type: "Offline";
    };

type GameState =
  | {
      type: "main-menu";
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

type Events = {
  loginClient: [];
  destroyClient: [];
  newGameSession: [];
  endGameSession: [];
  updateGameState: [state: GameState];
};

export const gameEvents = new Emitter<Events>();
