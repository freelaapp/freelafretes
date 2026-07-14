import type { ReactNode } from "react";
import logoAsset from "@/assets/freela-fretes-logo.png.asset.json";

interface Props {
  title: string;
  right?: ReactNode;
  subtitle?: string;
}

export function AppHeader({ title, right, subtitle }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground px-4 pt-4 pb-3 shadow-elevated">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logoAsset.url} alt="" className="h-8 w-8 object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-xl leading-none tracking-wide truncate">{title}</h1>
            {subtitle && <p className="text-xs opacity-80 mt-1">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

