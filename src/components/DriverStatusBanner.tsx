import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resendProviderDocuments } from "@/lib/api.functions";
import { ButtonPrimary, ButtonOutline } from "@/components/ui-kit";
import { Clock, AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

type FileSlot = "cnh_document_url" | "cnh_back_url" | "address_proof_url";

export function DriverStatusBanner() {
  const auth = useAuth();
  const qc = useQueryClient();
  const resend = useServerFn(resendProviderDocuments);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState<FileSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState<Record<FileSlot, string>>({
    cnh_document_url: "",
    cnh_back_url: "",
    address_proof_url: "",
  });

  const { data: p } = useQuery({
    enabled: !!auth.user,
    queryKey: ["provider-status", auth.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("providers")
        .select("id,user_id,validation_status,validation_notes,full_name")
        .eq("user_id", auth.user!.id).maybeSingle();
      return data;
    },
  });

  if (!p) return null;
  const status = p.validation_status as "PENDING_VALIDATION" | "APPROVED" | "REJECTED";

  async function uploadFile(slot: FileSlot, file: File) {
    if (!auth.user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo excede 10MB");
    setUploading(slot);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${auth.user.id}/${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
      if (error) throw error;
      setUrls((u) => ({ ...u, [slot]: path }));
      toast.success("Arquivo enviado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setUploading(null); }
  }

  async function onResend() {
    if (!urls.cnh_document_url || !urls.cnh_back_url || !urls.address_proof_url) {
      return toast.error("Envie os 3 documentos");
    }
    setSaving(true);
    try {
      await resend({ data: urls });
      toast.success("Documentos reenviados! Aguarde a análise.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["provider-status", auth.user!.id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  if (status === "APPROVED") {
    return (
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-success/10 border border-success/30 px-3 py-2 text-xs text-success font-semibold">
        <CheckCircle2 className="h-4 w-4" />
        <span>Status: aprovado ✓</span>
      </div>
    );
  }

  if (status === "PENDING_VALIDATION") {
    return (
      <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/40 px-3 py-2.5 text-xs text-warning-foreground">
        <Clock className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Conta em análise</p>
          <p className="opacity-80">Você poderá enviar propostas após a aprovação.</p>
        </div>
      </div>
    );
  }

  // REJECTED
  return (
    <>
      <div className="mx-4 mt-3 rounded-xl bg-destructive/10 border border-destructive/40 px-3 py-3 text-xs">
        <div className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Cadastro recusado</p>
            {p.validation_notes && <p className="mt-1 text-foreground/80 italic">"{p.validation_notes}"</p>}
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="mt-3 w-full rounded-full bg-destructive text-destructive-foreground py-2 font-semibold">
          Corrigir e reenviar
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            <p className="font-bold">Reenviar documentos</p>
            <p className="text-xs text-muted-foreground">Envie os 3 documentos legíveis, sem reflexo, com CNH na validade.</p>
            <FileUploader label="CNH — Frente" slot="cnh_document_url" uploading={uploading} onFile={uploadFile} url={urls.cnh_document_url} />
            <FileUploader label="CNH — Verso" slot="cnh_back_url" uploading={uploading} onFile={uploadFile} url={urls.cnh_back_url} />
            <FileUploader label="Comprovante de residência (máx. 90 dias)" slot="address_proof_url" uploading={uploading} onFile={uploadFile} url={urls.address_proof_url} />
            <ButtonPrimary onClick={onResend} disabled={saving}>{saving ? "Enviando..." : "Reenviar para análise"}</ButtonPrimary>
            <ButtonOutline onClick={() => setOpen(false)}>Cancelar</ButtonOutline>
          </div>
        </div>
      )}
    </>
  );
}

function FileUploader({ label, slot, uploading, onFile, url }: {
  label: string; slot: FileSlot; uploading: FileSlot | null;
  onFile: (slot: FileSlot, f: File) => void; url: string;
}) {
  const busy = uploading === slot;
  const done = !!url;
  return (
    <label className={`block rounded-xl border-2 border-dashed p-3 cursor-pointer ${done ? "border-success bg-success/5" : "border-border"}`}>
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{done ? "Enviado ✓" : busy ? "Enviando..." : "PNG, JPG ou PDF · até 10MB"}</p>
        </div>
      </div>
      <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(slot, f); }} />
    </label>
  );
}
