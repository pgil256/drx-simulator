import { Button } from '@/components/ui/button';
import { CAMERA_PRESETS } from '@/scene/cameraPresets';
import { useAppStore } from '@/store/useAppStore';
import { simDevice } from '@/sim/useSimTick';

export function TopBar() {
  const eStop = useAppStore((s) => s.device.eStop);
  const preset = useAppStore((s) => s.ui.cameraPreset);
  const setUi = useAppStore((s) => s.setUi);

  return (
    <div className="h-14 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-6 bg-black/40 backdrop-blur-md border-b border-white/10">
      <div className="text-white font-medium tracking-wide truncate">
        <span className="hidden sm:inline">DRX Simulator</span>
        <span className="sm:hidden">DRX</span>
      </div>
      <div className="flex items-center gap-1 rounded-md bg-white/5 p-1 border border-white/10">
        {CAMERA_PRESETS.map((p) => {
          const Icon = p.icon;
          return (
            <Button
              key={p.id}
              size="sm"
              variant={preset === p.id ? 'default' : 'ghost'}
              onClick={() => setUi({ cameraPreset: p.id })}
              aria-label={p.label}
              title={p.label}
            >
              <Icon className="size-4" />
              <span className="hidden md:inline">{p.label}</span>
            </Button>
          );
        })}
      </div>
      {eStop ? (
        <Button variant="destructive" size="sm" onClick={() => simDevice.resetEStop()}>
          <span className="hidden sm:inline">Reset E-Stop</span>
          <span className="sm:hidden">Reset</span>
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => simDevice.send('X')}>
          E-STOP
        </Button>
      )}
    </div>
  );
}
