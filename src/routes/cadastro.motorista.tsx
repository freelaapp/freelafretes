import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createProviderProfile } from "@/lib/api.functions";
import { Field } from "../auth";
import { isValidCPF, maskCPF, maskPhone, maskPlate, isValidPlate } from "@/lib/format";
import { VEHICLE_TYPES, BODY_TYPES, CNH_CATEGORIES, UF_LIST } from "@/lib/constants";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/cadastro/motorista")({
  head: () => ({ meta: [{ title: "Cadastro de Motorista — Freela Fretes" }] }),
  component: DriverSignup,
});

function DriverSignup() {
  const [step, setStep] = useState(1);
  const [cpf, setCpf] = useState("");
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [password, setPassword] = useState("");
  const [cnh_number, setCnh] = useState("");
  const [cnh_category, setCat] = useState<"C" | "D" | "E">("C");
  const [cnh_expires_at, setExp] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [vehicle_type, setVt] = useState<string>("Truck");
  const [body_type, setBt] = useState<string>("Baú");
  const [plate, setPlate] = useState("");
  const [capacity_kg, setCap] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const createProfile = useServerFn(createProviderProfile);

  async function submit() {
    if (!isValidCPF(cpf)) return toast.error("CPF inválido");
    if (!isValidPlate(plate)) return toast.error("Placa inválida (padrão ABC1D23)");
    setLoading(true);
    try {
      const { data: signUp, error: sErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { role: "provider" } },
      });
      if (sErr) throw sErr;
      // se precisa confirmar email, tenta login imediato
      if (!signUp.session) {
        const { error: liErr } = await supabase.auth.signInWithPassword({ email, password });
        if (liErr) throw liErr;
      }
      await createProfile({ data: {
        full_name, email, phone, cpf: cpf.replace(/\D/g,""), birthdate,
        cnh_number, cnh_category, cnh_expires_at, city, uf,
        vehicle: { vehicle_type, body_type, plate: plate.toUpperCase(), capacity_kg },
      } });
      toast.success("Cadastro concluído!");
      nav({ to: "/motorista/buscar" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh pb-10">
      <header className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Link to="/" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
        <p className="font-bold">Cadastro de motorista</p>
      </header>
      <Stepper current={step} total={4} labels={["CPF", "Dados", "CNH", "Veículo"]} />

      <div className="px-5 mt-5 space-y-3">
        {step === 1 && (
          <>
            <Field label="CPF" value={cpf} onChange={(v) => setCpf(maskCPF(v))} placeholder="000.000.000-00" />
            <ButtonPrimary onClick={() => { if (!isValidCPF(cpf)) return toast.error("CPF inválido"); setStep(2); }}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Nome completo" value={full_name} onChange={setFullName} />
            <Field label="E-mail" type="email" value={email} onChange={setEmail} />
            <Field label="Celular" value={phone} onChange={(v) => setPhone(maskPhone(v))} placeholder="(00) 00000-0000" />
            <Field label="Data de nascimento" type="date" value={birthdate} onChange={setBirthdate} />
            <Field label="Senha" type="password" value={password} onChange={setPassword} />
            <ButtonPrimary onClick={() => setStep(3)}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 3 && (
          <>
            <Field label="Número da CNH" value={cnh_number} onChange={setCnh} />
            <SelectField label="Categoria" value={cnh_category} onChange={(v) => setCat(v as any)} options={CNH_CATEGORIES as unknown as string[]} />
            <Field label="Validade" type="date" value={cnh_expires_at} onChange={setExp} />
            <ButtonPrimary onClick={() => setStep(4)}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 4 && (
          <>
            <SelectField label="Tipo do veículo" value={vehicle_type} onChange={setVt} options={VEHICLE_TYPES as unknown as string[]} />
            <SelectField label="Carroceria" value={body_type} onChange={setBt} options={BODY_TYPES as unknown as string[]} />
            <Field label="Placa (ABC1D23)" value={plate} onChange={(v) => setPlate(maskPlate(v))} />
            <Field label="Capacidade (kg)" type="number" value={String(capacity_kg || "")} onChange={(v) => setCap(parseInt(v) || 0)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade" value={city} onChange={setCity} />
              <SelectField label="UF" value={uf} onChange={setUf} options={UF_LIST as unknown as string[]} />
            </div>
            <ButtonPrimary onClick={submit} disabled={loading}>{loading ? "Enviando..." : "Concluir cadastro"}</ButtonPrimary>
          </>
        )}
      </div>
    </div>
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

export function ButtonPrimary({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60 shadow-elevated">
      {children}
    </button>
  );
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
        <option value="">-</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
