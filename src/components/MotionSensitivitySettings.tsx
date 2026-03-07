import { useDetectionBackend } from "../hooks/useDetectionBackend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function MotionSensitivitySettings({
  intervalMs,
  setIntervalMs,
}: {
  intervalMs: number;
  setIntervalMs: (val: number) => void;
}) {
  const {
    mode,
    setMode,
    opencvConfig,
    updateOpencvConfig,
    yoloConfig,
    updateYoloConfig,
    webgpuEnabled,
    setWebgpuEnabled,
    trackedObjects,
    toggleTrackedObject,
  } = useDetectionBackend();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Detection Mode</CardTitle>
        <CardDescription>Choose how you want to detect motion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="mode-toggle" className="flex flex-col space-y-1">
            <span>Smart Object Detection (YOLO)</span>
            <span className="font-normal text-xs text-muted-foreground">
              Uses AI to detect specific objects. Turn off for fast, lightweight pixel motion.
            </span>
          </Label>
          <Switch
            id="mode-toggle"
            checked={mode === "yolo"}
            onCheckedChange={(c) => setMode(c ? "yolo" : "opencv")}
          />
        </div>

        {mode === "opencv" && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Pixel Motion Settings</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Sensitivity (Difference Threshold)</Label>
                <span className="text-xs text-muted-foreground">{opencvConfig.diffThreshold}</span>
              </div>
              <Input
                type="range"
                value={opencvConfig.diffThreshold}
                onInput={(e) =>
                  updateOpencvConfig({
                    diffThreshold: parseInt((e.target as HTMLInputElement).value, 10),
                  })
                }
                max={100}
                min={1}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Motion Area</Label>
                <span className="text-xs text-muted-foreground">
                  {opencvConfig.motionAreaPercentage}%
                </span>
              </div>
              <Input
                type="range"
                value={opencvConfig.motionAreaPercentage}
                onInput={(e) =>
                  updateOpencvConfig({
                    motionAreaPercentage: parseFloat((e.target as HTMLInputElement).value),
                  })
                }
                max={20}
                min={0.1}
                step={0.1}
              />
            </div>
          </div>
        )}

        {mode === "yolo" && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Smart Object Settings</h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="webgpu-toggle" className="flex flex-col space-y-1">
                <span>WebGPU Acceleration</span>
                <span className="font-normal text-xs text-muted-foreground">
                  Faster inference if supported by your browser.
                </span>
              </Label>
              <Switch
                id="webgpu-toggle"
                checked={webgpuEnabled}
                onCheckedChange={setWebgpuEnabled}
              />
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex justify-between">
                <Label>Confidence Threshold</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(yoloConfig.confidenceThreshold * 100)}%
                </span>
              </div>
              <Input
                type="range"
                value={yoloConfig.confidenceThreshold}
                onInput={(e) =>
                  updateYoloConfig({
                    confidenceThreshold: parseFloat((e.target as HTMLInputElement).value),
                  })
                }
                max={1.0}
                min={0.1}
                step={0.05}
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label>Detected Objects & Tracking</Label>
              {Object.keys(trackedObjects).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No objects discovered yet. The app will learn as it sees things.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.values(trackedObjects).map((obj) => (
                    <div
                      key={obj.className}
                      className="flex items-center justify-between p-2 rounded-md border bg-card"
                    >
                      <Label className="capitalize">{obj.className}</Label>
                      <Switch
                        checked={obj.isTracking}
                        onCheckedChange={(c) => toggleTrackedObject(obj.className, c)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between">
            <Label>Polling Interval</Label>
            <span className="text-xs text-muted-foreground">{intervalMs}ms</span>
          </div>
          <Input
            type="range"
            value={intervalMs}
            onInput={(e) => setIntervalMs(parseInt((e.target as HTMLInputElement).value, 10))}
            max={2000}
            min={100}
            step={50}
          />
        </div>
      </CardContent>
    </Card>
  );
}
