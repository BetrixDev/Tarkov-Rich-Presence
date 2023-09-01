import { z } from "zod";

export const configSchema = z.object({
  exePath: z.string().default("C:\\Battlestate Games\\eft (live)\\EscapeFromTarkov.exe"),
  isEnabled: z.boolean().default(true),
  shouldCloseButtonQuit: z.boolean().default(false),
  openOnStartup: z.boolean().default(false),
  minimizedOnStartup: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG = configSchema.parse({});
