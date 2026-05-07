import { HelpCircle, Home, ListOrdered, Sliders, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type Page } from '@/store/useAppStore';

type Tab = { id: Page; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'setup', label: 'Setup', icon: Sliders },
  { id: 'protocols', label: 'Protocols', icon: ListOrdered },
  { id: 'help', label: 'Help', icon: HelpCircle },
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
        const active = page === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setUi({ page: tab.id })}
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
