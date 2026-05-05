import { HelpCircle, Home, ListOrdered, Sliders, Video, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type Page } from '@/store/useAppStore';

type Tab =
  | { id: Page; label: string; icon: LucideIcon; kind: 'page' }
  | { id: 'video'; label: string; icon: LucideIcon; kind: 'action' };

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: Home, kind: 'page' },
  { id: 'setup', label: 'Setup', icon: Sliders, kind: 'page' },
  { id: 'protocols', label: 'Protocols', icon: ListOrdered, kind: 'page' },
  { id: 'help', label: 'Help', icon: HelpCircle, kind: 'page' },
  { id: 'video', label: 'Video', icon: Video, kind: 'action' },
];

export function BottomNav() {
  const page = useAppStore((s) => s.ui.page);
  const setUi = useAppStore((s) => s.setUi);

  return (
    <nav
      aria-label="Primary"
      className="h-16 shrink-0 flex items-stretch bg-black/40 backdrop-blur-md border-t border-white/10"
    >
      {TABS.map((tab) => {
        const active = tab.kind === 'page' && page === tab.id;
        const Icon = tab.icon;
        const handle = () => {
          if (tab.kind === 'video') setUi({ videoOpen: true });
          else setUi({ page: tab.id });
        };
        return (
          <button
            key={tab.id}
            type="button"
            onClick={handle}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1',
              'text-[11px] leading-none transition active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-inset',
              active ? 'text-emerald-300' : 'text-white/60 hover:text-white/90',
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
