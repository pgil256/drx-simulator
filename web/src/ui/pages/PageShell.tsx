import { type ReactNode } from 'react';

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-5 text-white">
      <h2 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">{title}</h2>
      {children}
    </div>
  );
}
