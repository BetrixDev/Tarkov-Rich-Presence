import { Client } from "discord-rpc";
import { events } from "./events";
import { Notification } from "electron";
import { getData } from "./gql";

let gameStartTime = 0;
let raidStartTime = 0;

const CLIENT_ID = "1145768497398415440";

const client = new Client({ transport: "ipc" });

events.on("newGameSession", () => {
  gameStartTime = Date.now();

  client
    .login({ clientId: CLIENT_ID })
    .then((client) => {
      client.setActivity({
        largeImageText: "Escape from Tarkov",
        largeImageKey: "cover-image",
        startTimestamp: gameStartTime,
        details: "Browsing The Menus",
      });
    })
    .catch(() => {
      new Notification({
        title: "Tarkov Rich Presence",
        body: "There was an error connecting to the Discord client. Please check your internet connection and try again",
      });
    });

  events.on("updateGameEvent", (event) => {
    switch (event.type) {
      case "new-raid":
        raidStartTime = Date.now();

        if (event.data.type === "Offline") {
          client.setActivity({
            largeImageText: "Escape from Tarkov",
            largeImageKey: "cover-image",
            startTimestamp: raidStartTime,
            details: "In an offline Raid",
            state: "Playing Solo",
          });
        } else {
          const mapId = event.data.map;

          getData()
            .then((data) => {
              const mapData = data.maps.find((m) => m.nameId.toLowerCase() === mapId.toLowerCase())!;

              client.setActivity({
                largeImageText: mapData.name,
                largeImageKey: `${mapData.name.toLowerCase().split(" ")[0]}-large`,
                startTimestamp: raidStartTime,
                endTimestamp: raidStartTime + mapData.raidDuration * 60 * 1000,
                details: "In a Raid",
                state: "Playing Solo",
              });
            })
            .catch(() => {
              client.setActivity({
                largeImageText: "Escape from Tarkov",
                largeImageKey: "cover-image",
                startTimestamp: raidStartTime,
                details: "In a Raid",
                state: "Playing Solo",
              });
            });
        }

        break;
      case "main-menu":
        client.setActivity({
          largeImageText: "Escape from Tarkov",
          largeImageKey: "cover-image",
          startTimestamp: gameStartTime,
          details: "Browsing the Menus",
        });
        break;
      case "trader-screen":
        client.setActivity({
          largeImageText: "Escape from Tarkov",
          largeImageKey: "cover-image",
          startTimestamp: gameStartTime,
          details: "Browsing the Vendors",
        });
        break;
      case "flea-market-screen":
        client.setActivity({
          largeImageText: "Escape from Tarkov",
          largeImageKey: "cover-image",
          startTimestamp: gameStartTime,
          details: "Browsing the Flea Market",
        });
        break;
      case "prepare-to-escape":
        switch (event.state) {
          case "insurance":
            client.setActivity({
              largeImageText: "Escape from Tarkov",
              largeImageKey: "cover-image",
              startTimestamp: gameStartTime,
              details: "Preparing to Escape",
              state: "Insurance",
            });
            break;
          case "confirmation":
            client.setActivity({
              largeImageText: "Escape from Tarkov",
              largeImageKey: "cover-image",
              startTimestamp: gameStartTime,
              details: "Preparing to Escape",
              state: "Waiting to Confirm",
            });
            break;
          case "looking-for-group":
            client.setActivity({
              largeImageText: "Escape from Tarkov",
              largeImageKey: "cover-image",
              startTimestamp: gameStartTime,
              details: "Preparing to Escape",
              state: "Looking for Group",
            });
            break;
        }
        break;
      case "looking-for-raid":
        client.setActivity({
          largeImageText: "Escape from Tarkov",
          largeImageKey: "cover-image",
          startTimestamp: Date.now(),
          details: "Searching for a Raid",
        });
        break;

      case "raid-end":
        client.setActivity({
          largeImageText: "Escape from Tarkov",
          largeImageKey: "cover-image",
          startTimestamp: gameStartTime,
          details: "Raid ended",
        });
        break;
    }
  });
});

events.on("endGameSession", () => {
  if (client.user) {
    client.destroy();
  }
});

events.on("killWatcher", () => {
  if (client.user) {
    client.destroy();
  }
});
