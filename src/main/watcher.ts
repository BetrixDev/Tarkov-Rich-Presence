import { watch } from "chokidar";
import { getConfig } from ".";
import { read as readLastLines } from "read-last-lines";
import { readFileSync } from "fs";
import * as z from "zod";
import { watcherEvents } from "./watcher-events";
import { STATE } from "./rp-state";
import { gameEvents } from "./game-events";

let isInRaid = false;

const URL_REGEXP =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()'@:%_+.~#?!&//=]*)/gi;

const NEW_RAID_LINE_REGEXP =
  /'Profileid: (?<profileId>.*?), Status: (?<status>.*?), RaidMode: (?<raidMode>.*?), Ip: (?<serverIP>.*?), Port: (?<serverPort>.*?), Location: (?<location>.*?), Sid: (?<sid>.*?), GameMode: (?<gamemode>.*?), shortId: (?<raidId>.*?)'/;

function stripURL(str: string) {
  const url = str.match(URL_REGEXP);

  if (url) {
    return url.at(0);
  }

  return;
}

const groupsSchema = z.object({
  raidMode: z.literal("Online"),
  serverIP: z.string(),
  location: z.string(),
});

function parseNewRaid(path: string) {
  const logs = readFileSync(path).toString().split("\n").reverse();

  let newRaidLine: string | undefined;

  for (const line of logs) {
    if (newRaidLine) break;

    if (line.includes("TRACE-NetworkGameCreate profileStatus")) {
      newRaidLine = line;
    }
  }

  if (!newRaidLine) return;

  const groups = newRaidLine.match(NEW_RAID_LINE_REGEXP)?.groups;

  const parsed = groupsSchema.safeParse(groups);

  if (!parsed.success) return;

  gameEvents.emit("updateGameState", {
    type: "new-raid",
    data: {
      map: parsed.data.location.toLowerCase(),
      type: parsed.data.raidMode,
    },
  });

  isInRaid = true;
}

watcherEvents.on("spawnLogWatcher", () => {
  spawnWatcher();
});

export function spawnWatcher() {
  const watchPath = `${getConfig().exePath.replace("\\EscapeFromTarkov.exe", "")}\\Logs`;

  function handleNewGameSession() {
    if (!STATE.clientLoggedIn()) {
      gameEvents.emit("loginClient");
    } else {
      gameEvents.emit("newGameSession");
    }
    spawnWatchForEnd();
  }

  const watcher = watch(watchPath, {
    persistent: true,
    ignoreInitial: true,
    atomic: true,
    awaitWriteFinish: false,
    usePolling: false,
    interval: 10,
    depth: 2,
  })
    .once("ready", () => {
      if (STATE.isGameRunning()) {
        handleNewGameSession();
      }
    })
    .on("add", () => {
      if (STATE.isGameRunning()) {
        handleNewGameSession();
      }
    })
    .on("change", async (path) => {
      if (path.includes(" traces.log")) {
        const extractedLine = await readLastLines(path, 1);

        // A raid has started
        if (extractedLine.includes("TRACE-NetworkGameCreate 5")) {
          parseNewRaid(path);
        } else if (extractedLine.includes("TRACE-NetworkGameMatching")) {
          gameEvents.emit("updateGameState", { type: "looking-for-raid" });
          isInRaid = true;
        }

        const url = stripURL(extractedLine);

        if (!url) return;

        if (url.includes("insurance/items/list/cost")) {
          gameEvents.emit("updateGameState", { type: "prepare-to-escape", state: "insurance" });
          isInRaid = false;
        } else if (
          url.includes("match/group/invite/cancel-all") ||
          url.includes("match/group/looking/stop")
        ) {
          gameEvents.emit("updateGameState", { type: "prepare-to-escape", state: "confirmation" });
          isInRaid = false;
        } else if (url.includes("match/group/status")) {
          gameEvents.emit("updateGameState", { type: "prepare-to-escape", state: "looking-for-group" });
          isInRaid = false;
        } else if (url.includes("client/putMetrics") || url.includes("/match/offline/end")) {
          isInRaid = false;
          gameEvents.emit("updateGameState", { type: "raid-end" });
        } else if (url.includes("client/items")) {
          isInRaid = false;
          gameEvents.emit("updateGameState", { type: "main-menu" });
        } else if (url.includes("bot/generate") || url.includes("getTraderAssort")) {
          gameEvents.emit("updateGameState", { type: "new-raid", data: { type: "Offline" } });
          isInRaid = true;
        } else if (url.includes("game/keepalive")) {
          // already aknowledged the raid
          if (isInRaid) return;

          parseNewRaid(path);
        }
      }
    });

  watcherEvents.on("killLogWatcher", () => {
    watcherEvents.removeAllListeners("killLogWatcher");
    watcher.close();
    gameEvents.emit("destroyClient");
  });
}

function spawnWatchForEnd() {
  function intervalHandler() {
    const processRunning = STATE.isGameRunning();

    if (!processRunning) {
      handleEndSession();
    }
  }

  const interval = setInterval(intervalHandler, 15 * 1000);

  function handleEndSession() {
    clearInterval(interval);
    gameEvents.emit("endGameSession");
    watcherEvents.emit("killLogWatcher");
  }
}
