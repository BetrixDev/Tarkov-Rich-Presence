import { Client, Presence } from "discord-rpc";
import { gameEvents } from "./game-events";
import { STATE } from "./rp-state";
import { match } from "ts-pattern";
import { getConfig } from ".";
import { getData } from "./gql";

let gameStartTime = 0;
let raidStartTime = 0;

const ACTIVITIES = {
  browsingMenus: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: gameStartTime,
    details: "Browsing The Menus",
  }),
  launcher: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: Date.now(),
    details: "In the Launcher",
  }),
  prepareInsurance: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: gameStartTime,
    details: "Preparing to Escape",
    state: "Buying Insurance",
  }),
  prepareConfirmation: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: gameStartTime,
    details: "Preparing to Escape",
    state: "Waiting to Confirm",
  }),
  prepateLFG: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: gameStartTime,
    details: "Preparing to Escape",
    state: "Looking for Group",
  }),
  lookingForRaid: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: Date.now(),
    details: "Searching for a Raid",
  }),
  raidEnd: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: gameStartTime,
    details: "Raid ended",
  }),
  offlineRaid: () => ({
    largeImageText: "Escape from Tarkov",
    largeImageKey: "cover-large",
    startTimestamp: raidStartTime,
    details: "In an offline Raid",
  }),
} as const satisfies Record<string, () => Presence>;

const client = new Client({ transport: "ipc" });

gameEvents.on("loginClient", async () => {
  STATE.setClientLoggedIn(true);
  await client.login({ clientId: "1145768497398415440" });

  if (STATE.isLauncherRunning() && getConfig().watchLauncher) {
    client.setActivity(ACTIVITIES.launcher());

    gameEvents.on("newGameSession", () => {
      gameEvents.removeAllListeners("newGameSession");

      gameStartTime = Date.now();
      client.setActivity(ACTIVITIES.browsingMenus());
      listenToGameEvents();
    });
  } else if (STATE.isGameRunning()) {
    gameStartTime = Date.now();
    client.setActivity(ACTIVITIES.browsingMenus());
    listenToGameEvents();
  }

  function listenToGameEvents() {
    gameEvents.on("updateGameState", async (gameState) => {
      const newActivity = await match(gameState)
        .returnType<Presence | Promise<Presence>>()
        .with({ type: "main-menu" }, () => ACTIVITIES.browsingMenus())
        .with({ type: "prepare-to-escape", state: "insurance" }, () => ACTIVITIES.prepareInsurance())
        .with({ type: "prepare-to-escape", state: "confirmation" }, () => ACTIVITIES.prepareConfirmation())
        .with({ type: "prepare-to-escape", state: "looking-for-group" }, () => ACTIVITIES.prepateLFG())
        .with({ type: "looking-for-raid" }, () => ACTIVITIES.lookingForRaid())
        .with({ type: "raid-end" }, () => ACTIVITIES.raidEnd())
        .with({ type: "new-raid", data: { type: "Online" } }, ({ data: { map: mapId } }) => {
          raidStartTime = Date.now();

          return getData()
            .then((data) => {
              const mapData = data.maps.find((m) => m.nameId.toLowerCase() === mapId.toLowerCase())!;

              return {
                largeImageText: mapData.name,
                largeImageKey: `${mapData.name.toLowerCase().split(" ")[0]}-large`,
                startTimestamp: raidStartTime,
                details: "In a Raid",
                state: mapData.name,
              };
            })
            .catch(() => {
              return {
                largeImageText: "Escape from Tarkov",
                largeImageKey: "cover-large",
                startTimestamp: raidStartTime,
                details: "In a Raid",
              };
            });
        })
        .with({ type: "new-raid", data: { type: "Offline" } }, () => ACTIVITIES.offlineRaid())
        .run();

      client.setActivity(newActivity);
    });
  }
});

gameEvents.on("endGameSession", () => {
  // if (isProcessRunning("BsgLauncher") && getConfig().watchLauncher) {
  //
  // } else {
  gameEvents.emit("destroyClient");
  // }
});

gameEvents.on("destroyClient", () => {
  gameEvents.removeAllListeners("updateGameState");

  STATE.setClientLoggedIn(false);

  if (client.user) {
    client.destroy();
  }
});
