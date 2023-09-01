import { watch } from "chokidar";
import { events } from "./events";
import { getConfig } from ".";
import { read as readLastLines } from "read-last-lines";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import * as z from "zod";

let isGameRunning = false;
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
  raidMode: z.union([z.literal("Online"), z.literal("Offline")]),
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

  events.emit("updateGameEvent", {
    type: "new-raid",
    data: {
      map: parsed.data.location.toLowerCase(),
      type: parsed.data.raidMode,
    },
  });

  isInRaid = true;
}

events.on("spawnWatcher", () => {
  spawnWatcher();
});

export function spawnWatcher() {
  const watchPath = `${getConfig().exePath.replace("\\EscapeFromTarkov.exe", "")}\\Logs`;

  function handleNewGameSession() {
    isGameRunning = true;
    events.emit("newGameSession");
    spawnWatchForEnd();
  }

  const watcher = watch(`${watchPath}`, {
    persistent: true,
    ignoreInitial: true,
    atomic: true,
    awaitWriteFinish: false,
    usePolling: false,
    interval: 10,
    depth: 2,
  })
    .once("ready", () => {
      if (isGameRunning || checkIfProcessRunning()) {
        handleNewGameSession();
      }
    })
    .on("add", () => {
      if (!isGameRunning) {
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
          events.emit("updateGameEvent", { type: "looking-for-raid" });
          isInRaid = true;
        }

        const url = stripURL(extractedLine);

        if (!url) return;

        // if (url.includes("getTraderAssort")) {
        //   events.emit("updateGameEvent", "trader-screen", undefined);
        // } else if (url.includes("ragfair")) {
        //   events.emit("updateGameEvent", "flea-market-screen", undefined);
        // } else
        if (url.includes("insurance/items/list/cost")) {
          events.emit("updateGameEvent", { type: "prepare-to-escape", state: "insurance" });
          isInRaid = false;
        } else if (
          url.includes("match/group/invite/cancel-all") ||
          url.includes("match/group/looking/stop")
        ) {
          events.emit("updateGameEvent", { type: "prepare-to-escape", state: "confirmation" });
          isInRaid = false;
        } else if (url.includes("match/group/status")) {
          events.emit("updateGameEvent", { type: "prepare-to-escape", state: "looking-for-group" });
          isInRaid = false;
        } else if (url.includes("client/putMetrics") || url.includes("/match/offline/end")) {
          isInRaid = false;
          events.emit("updateGameEvent", { type: "raid-end" });
        } else if (url.includes("client/items")) {
          isInRaid = false;
          events.emit("updateGameEvent", { type: "main-menu" });
        } else if (url.includes("bot/generate")) {
          events.emit("updateGameEvent", { type: "new-raid", data: { type: "Offline" } });
          isInRaid = true;
        } else if (url.includes("game/keepalive")) {
          // already aknowledged the raid
          if (isInRaid) return;

          parseNewRaid(path);
        }
      } else if (path.includes(" notifications.log")) {
        const extractedLine = await readLastLines(path, 1);

        console.log(extractedLine);
      }
    });

  events.on("killWatcher", handleKillWatcher);
  function handleKillWatcher() {
    watcher.close();
    events.off("killWatcher", handleKillWatcher);
  }
}

function checkIfProcessRunning() {
  try {
    const result = execSync('tasklist | find /i "EscapeFromTarkov.exe"');
    return result.toString().length > 0;
  } catch {
    return false;
  }
}

function spawnWatchForEnd() {
  function intervalHandler() {
    const isProcessRunning = checkIfProcessRunning();

    if (!isProcessRunning) {
      handleEndSession();
    }
  }

  const interval = setInterval(intervalHandler, 15 * 1000);

  function handleEndSession() {
    clearInterval(interval);
    events.emit("endGameSession");
    events.emit("killWatcher");
    isGameRunning = false;
  }
}
