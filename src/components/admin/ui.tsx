import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

export function KpiCard({ label, value, tone = "default", hint }: { label: string; value: ReactNode; tone?: "default" | "warning" | "success" | "primary"; hint?: string }) {
  const border = tone === "warning" ? "border-primary/50 bg-primary/5" : "border-border bg-card";
  return (
    <div className={`rounded-xl ${border} border p-4 shadow-sm`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "warning" | "danger" | "primary" | "accent" | "info" }) {
  const map: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/15 text-destructive",
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent text-accent-foreground",
    info: "bg-blue-100 text-blue-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>{children}</span>;
}

export function DataTable<T>({ columns, rows, empty }: {
  columns: { key: string; header: string; render: (row: T) => ReactNode; width?: string }[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>{columns.map((c) => <th key={c.key} className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground" style={{ width: c.width }}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="py-12 text-center text-muted-foreground text-sm">{empty ?? "Nenhum registro encontrado."}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/30">
              {columns.map((c) => <td key={c.key} className="px-3 py-2.5 align-middle">{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-muted-foreground">{total} registro{total !== 1 ? "s" : ""} · Página {page} de {pages}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40">Anterior</button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40">Próxima</button>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, title, description, confirmLabel = "Confirmar", tone = "primary", requireText, onConfirm, children }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  confirmLabel?: string; tone?: "primary" | "danger"; requireText?: string;
  onConfirm: () => Promise<void> | void; children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  const canConfirm = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  const btnCls = tone === "danger" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground";
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex gap-3">
            {tone === "danger" && <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            <div>
              <h2 className="font-semibold">{title}</h2>
              {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
            </div>
          </div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {children}
          {requireText && (
            <label className="block">
              <span className="text-xs text-muted-foreground">Digite <b>{requireText}</b> para confirmar</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
            </label>
          )}
        </div>
        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm border border-border">Cancelar</button>
          <button disabled={!canConfirm || loading}
            onClick={async () => { setLoading(true); try { await onConfirm(); onClose(); } finally { setLoading(false); } }}
            className={`px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50 ${btnCls}`}>
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${value === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          {t.label}{t.count != null && <span className="ml-1.5 text-xs opacity-70">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl tracking-wide">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
