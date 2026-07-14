import type { ReactNode } from "react";

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
};
export function Field({ label, value, onChange, ...rest }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        {...rest}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
};
export function TextArea({ label, value, onChange, ...rest }: TextAreaProps) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <textarea
        {...rest}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
      />
    </label>
  );
}

export function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
        <option value="">{placeholder ?? "-"}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function ButtonPrimary({ children, onClick, disabled, type }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className="w-full rounded-full bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60 shadow-elevated active:scale-[.99] transition">
      {children}
    </button>
  );
}

export function ButtonAccent({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full bg-accent text-accent-foreground py-3 font-semibold disabled:opacity-60 shadow-elevated">
      {children}
    </button>
  );
}

export function ButtonOutline({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full border border-border bg-card py-3 font-semibold disabled:opacity-60">
      {children}
    </button>
  );
}

export function Stepper({ current, total, labels }: { current: number; total: number; labels?: string[] }) {
  return (
    <div className="px-5 mt-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < current ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
      {labels && <p className="mt-1.5 text-xs font-medium text-muted-foreground">Etapa {current} de {total}: {labels[current - 1]}</p>}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "primary" | "accent" | "success" | "warning" | "danger" | "muted" }) {
  const map: Record<string, string> = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary text-primary-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-destructive text-destructive-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>{children}</span>;
}
