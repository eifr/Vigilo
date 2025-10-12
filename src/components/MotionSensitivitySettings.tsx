import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOTION_SENSITIVITY_RANGES } from "../lib/constants";

interface MotionSensitivitySettingsProps {
  diffThreshold: number;
  setDiffThreshold: (value: number) => void;
  motionPixelRatio: number;
  setMotionPixelRatio: (value: number) => void;
  intervalMs: number;
  setIntervalMs: (value: number) => void;
}

export function MotionSensitivitySettings({
  diffThreshold,
  setDiffThreshold,
  motionPixelRatio,
  setMotionPixelRatio,
  intervalMs,
  setIntervalMs,
}: MotionSensitivitySettingsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Motion Sensitivity</h3>
      <div className="space-y-2">
        <Label htmlFor="diff-threshold">
          Difference Threshold ({MOTION_SENSITIVITY_RANGES.DIFF_THRESHOLD.MIN}-{MOTION_SENSITIVITY_RANGES.DIFF_THRESHOLD.MAX})
        </Label>
        <Input
          id="diff-threshold"
          type="number"
          min={MOTION_SENSITIVITY_RANGES.DIFF_THRESHOLD.MIN}
          max={MOTION_SENSITIVITY_RANGES.DIFF_THRESHOLD.MAX}
          value={diffThreshold}
          onInput={(e) => setDiffThreshold(parseInt((e.target as HTMLInputElement).value, 10))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pixel-ratio">
          Motion Pixel Ratio ({MOTION_SENSITIVITY_RANGES.PIXEL_RATIO.MIN}-{MOTION_SENSITIVITY_RANGES.PIXEL_RATIO.MAX})
        </Label>
        <Input
          id="pixel-ratio"
          type="number"
          step="0.001"
          min={MOTION_SENSITIVITY_RANGES.PIXEL_RATIO.MIN}
          max={MOTION_SENSITIVITY_RANGES.PIXEL_RATIO.MAX}
          value={motionPixelRatio}
          onInput={(e) => setMotionPixelRatio(parseFloat((e.target as HTMLInputElement).value))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interval">
          Detection Interval (ms, {MOTION_SENSITIVITY_RANGES.INTERVAL.MIN}-{MOTION_SENSITIVITY_RANGES.INTERVAL.MAX})
        </Label>
        <Input
          id="interval"
          type="number"
          min={MOTION_SENSITIVITY_RANGES.INTERVAL.MIN}
          max={MOTION_SENSITIVITY_RANGES.INTERVAL.MAX}
          value={intervalMs}
          onInput={(e) => setIntervalMs(parseInt((e.target as HTMLInputElement).value, 10))}
        />
      </div>
    </div>
  );
}