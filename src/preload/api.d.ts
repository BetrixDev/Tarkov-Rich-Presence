import type { Config } from "../config";

export type API = {
  fetchConfig: () => Promise<Config>;
  updateConfig: <TKey extends keyof Config>(key: TKey, value: Config[TKey]) => Promise<Config>;
  promptPathUpdate: () => Promise<void>;
  purgeTempCache: () => Promise<void>;
};
