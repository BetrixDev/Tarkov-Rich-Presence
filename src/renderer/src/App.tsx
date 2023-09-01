import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Switch } from "./components/ui/switch";
import { Button } from "./components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Config } from "src/config";
import { Separator } from "./components/ui/separator";

function App(): JSX.Element {
  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ["config"],
    queryFn: () => window.api.fetchConfig(),
  });

  const { mutate: purgeTempCache, isLoading: isPurging } = useMutation({
    mutationFn: () => window.api.purgeTempCache(),
  });

  async function updateConfig<TKey extends keyof Config>(key: TKey, value: Config[TKey]) {
    window.api.updateConfig(key, value).then(() => refetchConfig());
  }

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen text-stone-50 bg-neutral-950 flex p-4 gap-4 flex-col justify-between">
      <Card className="w-full overflow-auto flex-grow">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Basic configuration for Tarkov RP</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex gap-2 font-semibold">
              <Switch
                checked={config.isEnabled}
                onClick={() => updateConfig("isEnabled", !config.isEnabled)}
              />
              Master Switch
            </div>
            <Separator />
            <div className="flex flex-col gap-1 items-start">
              <div className="flex flex-col gap-1 w-full">
                <Button
                  variant="outline"
                  onClick={() => window.api.promptPathUpdate().then(() => refetchConfig())}
                >
                  Update exe path
                </Button>
                <p className="text-xs text-neutral-500">{config.exePath}</p>
              </div>
              <Button
                variant="link"
                size="sm"
                className="font-mono text-sm p-0 h-5"
                onClick={() => {
                  window.open("https://google.com");
                }}
              >
                Find out why?
              </Button>
            </div>
            <Separator />
            <Button
              variant="outline"
              onClick={() => {
                purgeTempCache();
              }}
              disabled={isPurging}
            >
              Refetch temp data
            </Button>

            <Separator />
            <div className="gap-2 flex font-semibold">
              <Switch
                checked={config.shouldCloseButtonQuit}
                onClick={() => updateConfig("shouldCloseButtonQuit", !config.shouldCloseButtonQuit)}
              />
              Close button should quit
            </div>
          </div>
        </CardContent>
      </Card>
      <button
        className="border border-neutral-200 dark:border-neutral-800 p-2 rounded-md font-semibold hover:underline hover:cursor-pointer"
        onClick={() => window.open("https://github.com/BetrixDev")}
      >
        Made with ❤️ by Betrix
      </button>
    </div>
  );
}

export default App;
