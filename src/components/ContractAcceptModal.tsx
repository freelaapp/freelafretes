import { useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";

export function ContractAcceptModal({
  open,
  onClose,
  onAccept,
  title,
  body,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  title: string;
  body: string;
  loading?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

  useEffect(() => {
    if (!open) { setChecked(false); setScrolledEnd(false); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-elevated flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="font-bold text-sm">{title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledEnd(true);
          }}
          className="flex-1 overflow-y-auto px-4 py-4 text-xs whitespace-pre-wrap leading-relaxed text-foreground/90"
        >
          {body}
        </div>
        <div className="border-t border-border p-4 space-y-3">
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              disabled={!scrolledEnd}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Li e concordo com os termos deste contrato.
              {!scrolledEnd && <span className="block text-muted-foreground mt-0.5">Role até o fim para habilitar.</span>}
            </span>
          </label>
          <button
            disabled={!checked || loading}
            onClick={onAccept}
            className="w-full rounded-full bg-primary text-primary-foreground py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Registrando aceite…" : "Aceitar e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
