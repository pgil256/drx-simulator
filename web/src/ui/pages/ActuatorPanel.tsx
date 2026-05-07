import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { LIMITS } from '@/sim/types';
import { simDevice } from '@/sim/useSimTick';
import { useAppStore } from '@/store/useAppStore';

type Actuator = 'axial' | 'horizontal' | 'lateral';

const CONFIG: Record<
  Actuator,
  {
    units: string;
    stepNormal: number;
    stepFast: number;
    command: (v: number) => string;
    format: (v: number) => string;
  }
> = {
  axial: {
    units: 'in',
    stepNormal: 0.5,
    stepFast: 1.0,
    command: (v) => `A12 ${v.toFixed(2)}`,
    format: (v) => v.toFixed(1),
  },
  horizontal: {
    units: 'deg',
    stepNormal: 5,
    stepFast: 10,
    command: (v) => `B${Math.round(v)}`,
    format: (v) => `${Math.round(v)}`,
  },
  lateral: {
    units: 'deg',
    stepNormal: 5,
    stepFast: 10,
    command: (v) => `K ${Math.round(v)}`,
    format: (v) => `${Math.round(v)}`,
  },
};

export function ActuatorPanel({ actuator }: { actuator: Actuator }) {
  const cfg = CONFIG[actuator];
  const limits = LIMITS[actuator];
  const state = useAppStore((s) => s.device[actuator]);

  const nudge = (delta: number) => {
    // Read live target from the store so a burst of clicks within a single
    // React render frame still accumulates instead of all reading the same
    // pre-render snapshot.
    const current = useAppStore.getState().device[actuator].target;
    const next = Math.max(limits.min, Math.min(limits.max, current + delta));
    simDevice.send(cfg.command(next));
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-white/60">Position</div>
        <div className="text-2xl font-mono">
          {cfg.format(state.pos)} {cfg.units}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => nudge(-cfg.stepNormal)}>
          Reverse
        </Button>
        <Button variant="secondary" onClick={() => nudge(cfg.stepNormal)}>
          Forward
        </Button>
        <Button variant="secondary" onClick={() => nudge(-cfg.stepFast)}>
          Fast Reverse
        </Button>
        <Button variant="secondary" onClick={() => nudge(cfg.stepFast)}>
          Fast Forward
        </Button>
        <Button variant="outline" onClick={() => simDevice.send(cfg.command(0))}>
          Reset
        </Button>
      </div>
      <div>
        <div className="text-sm text-white/60 mb-2">
          Target: {cfg.format(state.target)} {cfg.units}
        </div>
        <Slider
          min={limits.min}
          max={limits.max}
          step={actuator === 'axial' ? 0.1 : 1}
          value={[state.target]}
          onValueChange={([v]) => simDevice.send(cfg.command(v))}
        />
      </div>
    </div>
  );
}
