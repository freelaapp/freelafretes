import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createContractorProfile } from "@/lib/api.functions";
import { Field, SelectField, ButtonPrimary, Stepper } from "@/components/ui-kit";
import { isValidCNPJ, isValidCPF, maskCPF, maskCNPJ, maskPhone, isStrongPassword, friendlyAuthError } from "@/lib/format";
import { SEGMENTS, MONTHLY_VOLUMES } from "@/lib/constants";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/cadastro/empresa")({
  head: () => ({ meta: [{ title: "Cadastro de Empresa — Freela Fretes" }] }),
  component: CompanySignup,
});

function CompanySignup() {
  const [step, setStep] = useState(1);
  const [company_name, setCompanyName] = useState("");
  const [corporate_reason, setCr] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cpf, setCpf] = useState("");
  const [contact_name, setCn] = useState("");
  const [contact_email, setCe] = useState("");
  const [contact_phone, setCp] = useState("");
  const [is_company_partner, setPartner] = useState(false);
  const [segment, setSegment] = useState("");
  const [monthly_freight_volume, setVol] = useState("");
  const [accept, setAccept] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const nav = useNavigate();
  const create = useServerFn(createContractorProfile);

  async function submit() {
    if (!isValidCNPJ(cnpj)) return toast.error("CNPJ inválido");
    if (!isValidCPF(cpf)) return toast.error("CPF do responsável inválido");
    if (!accept) return toast.error("Aceite os termos");
    if (!isStrongPassword(password)) {
      return toast.error("Senha fraca: use no mínimo 8 caracteres, misturando letras e números.");
    }
    setLoading(true);
    try {
      const { data: signUp, error: sErr } = await supabase.auth.signUp({
        email: contact_email, password,
        options: { data: { role: "contractor" }, emailRedirectTo: window.location.origin },
      });
      if (sErr) throw sErr;
      if (!signUp.session) {
        const { error: liErr } = await supabase.auth.signInWithPassword({ email: contact_email, password });
        if (liErr) throw liErr;
      }
      await create({ data: {
        company_name, corporate_reason,
        cnpj: cnpj.replace(/\D/g,""),
        cpf: cpf.replace(/\D/g,""),
        contact_name, contact_email, contact_phone,
        is_company_partner, segment, monthly_freight_volume,
      } });
      setDone(true);
      setStep(2);
    } catch (e) {
      toast.error(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh pb-10">
      <header className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Link to="/" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
        <p className="font-bold">Cadastro de empresa</p>
      </header>
      <Stepper current={step} total={2} labels={["Dados Cadastrais", "Validação"]} />

      <div className="px-5 mt-5 space-y-3">
        {step === 1 && (
          <>
            <Field label="Razão social" value={corporate_reason} onChange={setCr} />
            <Field label="Nome fantasia" value={company_name} onChange={setCompanyName} />
            <Field label="CNPJ" value={cnpj} onChange={(v) => setCnpj(maskCNPJ(v))} placeholder="00.000.000/0000-00" />
            <SelectField label="Ramo de atuação" value={segment} onChange={setSegment} options={SEGMENTS} />
            <SelectField label="Volume mensal de fretes" value={monthly_freight_volume} onChange={setVol} options={MONTHLY_VOLUMES} />

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-semibold mb-2">Responsável</p>
              <Field label="Nome do responsável" value={contact_name} onChange={setCn} />
              <div className="h-3" />
              <Field label="E-mail corporativo" type="email" value={contact_email} onChange={setCe} />
              <div className="h-3" />
              <Field label="CPF" value={cpf} onChange={(v) => setCpf(maskCPF(v))} placeholder="000.000.000-00" />
              <div className="h-3" />
              <Field label="Celular" value={contact_phone} onChange={(v) => setCp(maskPhone(v))} placeholder="(00) 00000-0000" />
              <label className="flex items-center gap-2 mt-3">
                <input type="checkbox" checked={is_company_partner} onChange={(e) => setPartner(e.target.checked)} className="h-4 w-4" />
                <span className="text-sm">Sou sócio da empresa</span>
              </label>
              <Field label="Senha" type="password" value={password} onChange={setPassword} />
              <label className="flex items-start gap-2 mt-3">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="h-4 w-4 mt-0.5" />
                <span className="text-xs">Li e aceito os <span className="underline">Termos de Uso</span> e <span className="underline">Política de Privacidade</span>.</span>
              </label>
            </div>

            <ButtonPrimary onClick={submit} disabled={loading}>{loading ? "Enviando..." : "Criar conta"}</ButtonPrimary>
          </>
        )}

        {step === 2 && done && (
          <div className="mt-4 rounded-2xl bg-card border border-border p-6 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-warning/20 grid place-items-center">
              <CheckCircle2 className="h-8 w-8 text-warning" />
            </div>
            <h2 className="mt-3 font-bold text-lg">Seus dados estão em análise</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Você já pode usar o app normalmente. Enquanto validamos sua empresa, um selo <span className="font-semibold">Em validação</span> aparecerá nos seus fretes.
            </p>
            <div className="mt-5">
              <ButtonPrimary onClick={() => nav({ to: "/embarcador/fretes" })}>Ir para meus fretes</ButtonPrimary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
