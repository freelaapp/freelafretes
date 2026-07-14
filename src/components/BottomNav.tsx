import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface BottomNavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-card border-t border-border z-40">
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`h-6 w-6 flex items-center justify-center ${active ? "text-primary" : ""}`}>
                  {it.icon}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
