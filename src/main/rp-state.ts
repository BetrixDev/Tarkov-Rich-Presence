import { isProcessRunning } from "./utils";

let clientLoggedIn = false;

export const STATE = {
  isGameRunning: () => isProcessRunning("EscapeFromTarkov"),
  isLauncherRunning: () => isProcessRunning("BsgLauncher"),
  clientLoggedIn: () => clientLoggedIn,
  setClientLoggedIn: (loggedIn: boolean) => {
    clientLoggedIn = loggedIn;
  },
} as const;
