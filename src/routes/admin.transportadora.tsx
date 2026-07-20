import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCarrierProfile, updateCarrierProfile, getPlatformSettings, updatePlatformMargin } from "@/lib/carrier.functions";

export const Route = createFileRoute("/admin/transportadora")({
  head: () => ({ meta: [{ title: "Transportadora — Admin Freela Fretes" }] }),
  component: TransportadoraAdmin,
});

function TransportadoraAdmin() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getCarrierProfile);
  const updProfile = useServerFn(updateCarrierProfile);
  const getSettings = useServerFn(getPlatformSettings);
  const updMargin = useServerFn(updatePlatformMargin);

  const profileQ = useQuery({ queryKey: ["carrier-profile"], queryFn: () => getProfile() });
  const settingsQ = useQuery({ queryKey: ["platform-settings"], queryFn: () => getSettings() });

  const [form, setForm] = useState({
    razao_social: "", cnpj: "", ie: "", rntrc: "",
    logradouro: "", bairro: "", cidade: "", uf: "", cep: "",
    certificado_apelido: "",
  });
  const [margin, setMargin] = useState(20);

  useEffect(() => {
    const p = profileQ.data as any;
    if (p) {
      setForm({
        razao_social: p.razao_social ?? "",
        cnpj: p.cnpj ?? "",
        ie: p.ie ?? "",
        rntrc: p.rntrc ?? "",
        logradouro: p.endereco?.logradouro ?? "",
        bairro: p.endereco?.bairro ?? "",
        cidade: p.endereco?.cidade ?? "",
        uf: p.endereco?.uf ?? "",
        cep: p.endereco?.cep ?? "",
        certificado_apelido: p.certificado_apelido ?? "",
      });
    }
  }, [profileQ.data]);

  useEffect(() => {
    if (settingsQ.data) setMargin(Math.round(Number((settingsQ.data as any).carrier_margin_percent) * 100));
  }, [settingsQ.data]);

  const saveProfile = useMutation({
    mutationFn: () => updProfile({ data: {
      razao_social: form.razao_social,
      cnpj: form.cnpj,
      ie: form.ie || null,
      rntrc: form.rntrc || null,
      endereco: {
        logradouro: form.logradouro, bairro: form.bairro,
        cidade: form.cidade, uf: form.uf, cep: form.cep,
      },
      certificado_apelido: form.certificado_apelido || null,
    } }),
    onSuccess: () => { toast.success("Perfil atualizado"); qc.invalidateQueries({ queryKey: ["carrier-profile"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const saveMargin = useMutation({
    mutationFn: () => updMargin({ data: { carrier_margin_percent: margin / 100 } }),
    onSuccess: () => { toast.success("Margem atualizada"); qc.invalidateQueries({ queryKey: ["platform-settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <AdminShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Transportadora</h1>
          <p className="text-sm text-muted-foreground">Dados da ETC emissora dos documentos fiscais e margem comercial.</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-bold">Identidade fiscal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Field label="Razão social" value={form.razao_social} onChange={(v) => setForm({ ...form, razao_social: v })} />
            <Field label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
            <Field label="Inscrição estadual" value={form.ie} onChange={(v) => setForm({ ...form, ie: v })} />
            <Field label="RNTRC" value={form.rntrc} onChange={(v) => setForm({ ...form, rntrc: v })} />
            <Field label="Logradouro" value={form.logradouro} onChange={(v) => setForm({ ...form, logradouro: v })} />
            <Field label="Bairro" value={form.bairro} onChange={(v) => setForm({ ...form, bairro: v })} />
            <Field label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
            <Field label="UF" value={form.uf} onChange={(v) => setForm({ ...form, uf: v.toUpperCase().slice(0, 2) })} />
            <Field label="CEP" value={form.cep} onChange={(v) => setForm({ ...form, cep: v })} />
            <Field label="Certificado digital (apelido)" value={form.certificado_apelido} onChange={(v) => setForm({ ...form, certificado_apelido: v })} />
          </div>
          <button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {saveProfile.isPending ? "Salvando…" : "Salvar perfil"}
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-bold">Margem comercial da plataforma</h2>
          <p className="text-xs text-muted-foreground">
            Percentual retido pela FREELA sobre cada frete. O motorista recebe o restante como repasse (TAC).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number" min={0} max={90} step={1} value={margin}
              onChange={(e) => setMargin(Math.max(0, Math.min(90, Number(e.target.value))))}
              className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <button onClick={() => saveMargin.mutate()} disabled={saveMargin.isPending}
              className="ml-auto rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {saveMargin.isPending ? "Salvando…" : "Salvar margem"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ex.: margem 20% em frete de R$ 10.000 → motorista recebe R$ 8.000 e FREELA retém R$ 2.000.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5" />
    </label>
  );
}
