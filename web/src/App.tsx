import { ChevronDown, ChevronUp } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
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
  // Mobile-only collapse: hide the controls panel to give the 3D scene the
  // full viewport. Re-opens automatically when the user navigates pages.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const page = useAppStore((s) => s.ui.page);
  useEffect(() => {
    setSidebarOpen(true);
  }, [page]);

  return (
    <div className="dark w-screen h-screen bg-black text-white flex flex-col">
      <TopBar />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <aside
          className={cn(
            'overflow-auto bg-black/40 backdrop-blur-md',
            'md:w-96 md:shrink-0 md:max-h-none md:border-r md:border-b-0 border-b border-white/10',
            sidebarOpen ? 'max-h-[42vh]' : 'hidden md:block',
          )}
        >
          <PageRouter />
        </aside>
        <main className="flex-1 relative min-h-0 min-w-0">
          <Suspense fallback={<SceneFallback />}>
            <Scene />
          </Suspense>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Hide controls' : 'Show controls'}
            aria-expanded={sidebarOpen}
            className={cn(
              'md:hidden absolute left-1/2 -translate-x-1/2 z-10',
              'inline-flex items-center gap-1 rounded-full',
              'bg-black/70 backdrop-blur-md border border-white/15 shadow-lg',
              'px-3 py-1 text-[11px] text-white/85 active:scale-95 transition',
              sidebarOpen ? 'top-2' : 'top-2',
            )}
          >
            {sidebarOpen ? (
              <>
                <ChevronUp className="size-3.5" />
                Hide controls
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                Show controls
              </>
            )}
          </button>
        </main>
      </div>
      <BottomNav />
      <VideoDialog />
    </div>
  );
}
