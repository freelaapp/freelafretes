import type { ReactNode } from "react";

interface Props {
  title: string;
  right?: ReactNode;
  subtitle?: string;
}

export function AppHeader({ title, right, subtitle }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground px-4 pt-4 pb-3 shadow-elevated">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
