import { execSync } from "child_process";

export function isProcessRunning(processName: "EscapeFromTarkov" | "BsgLauncher") {
  try {
    const result = execSync(`tasklist | find /i "${processName}.exe"`);
    return result.toString().length > 0;
  } catch {
    return false;
  }
}
