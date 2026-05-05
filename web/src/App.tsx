import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cn } from './lib/utils';
import { useSimTick } from './sim/useSimTick';
import { useAppStore } from './store/useAppStore';
import { BottomNav } from './ui/BottomNav';
import { PageRouter } from './ui/pages/PageRouter';
import { TopBar } from './ui/TopBar';
import { VideoDialog } from './ui/VideoDialog';

const Scene = lazy(() => import('./scene/Scene').then((m) => ({ default: m.Scene })));

if (typeof window !== 'undefined') {
  (window as unknown as { store: typeof useAppStore }).store = useAppStore;
}

function SceneFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
      Loading 3D model…
    </div>
  );
}

export default function App() {
  useSimTick();

  // On phones the controls live in a bottom sheet that overlays the scene
  // so the 3D model can take the full viewport by default. On md+ screens
  // the same <aside> renders as a fixed left sidebar (no sheet behavior).
  const [sheetOpen, setSheetOpen] = useState(false);
  const page = useAppStore((s) => s.ui.page);
  const prevPageRef = useRef(page);
  useEffect(() => {
    // Tapping a different tab is a "show me this page" intent, so expand.
    // The ref-based guard skips the initial render (and Strict-Mode double-
    // invoke), only firing when the page actually changes.
    if (prevPageRef.current === page) return;
    prevPageRef.current = page;
    setSheetOpen(true);
  }, [page]);

  return (
    <div className="dark w-screen h-screen bg-black text-white flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 relative min-h-0 min-w-0">
          <Suspense fallback={<SceneFallback />}>
            <Scene />
          </Suspense>
        </main>

        {sheetOpen && (
          <button
            type="button"
            aria-label="Close controls"
            onClick={() => setSheetOpen(false)}
            className="md:hidden absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] transition-opacity"
          />
        )}

        <aside
          className={cn(
            // Mobile: bottom sheet overlay
            'absolute left-0 right-0 bottom-0 z-20 flex flex-col',
            'bg-black/85 backdrop-blur-md border-t border-white/15',
            'rounded-t-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.5)]',
            'transition-[height] duration-300 ease-out',
            sheetOpen ? 'h-[72vh]' : 'h-10',
            // Desktop: static side panel — reset all the sheet styling
            'md:static md:order-first md:flex md:flex-col',
            'md:w-96 md:shrink-0 md:h-auto md:max-h-none',
            'md:rounded-none md:shadow-none md:border-t-0 md:border-r md:bg-black/40',
          )}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? 'Hide controls' : 'Show controls'}
            className={cn(
              'md:hidden shrink-0 h-10 w-full flex flex-col items-center justify-center gap-1',
              'active:bg-white/5',
            )}
          >
            <span className="block w-10 h-1 rounded-full bg-white/40" aria-hidden />
            {!sheetOpen && (
              <span className="text-[10px] uppercase tracking-wider text-white/50 leading-none">
                Controls
              </span>
            )}
          </button>
          <div className="flex-1 min-h-0 overflow-auto">
            <PageRouter />
          </div>
        </aside>
      </div>
      <BottomNav />
      <VideoDialog />
    </div>
  );
}
