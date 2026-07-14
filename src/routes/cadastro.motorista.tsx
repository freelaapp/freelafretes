import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createProviderProfile } from "@/lib/api.functions";
import { Field, SelectField, ButtonPrimary, Stepper } from "@/components/ui-kit";
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
    if (!capacity_kg || capacity_kg <= 0) return toast.error("Informe a capacidade");
    setLoading(true);
    try {
      const { data: signUp, error: sErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { role: "provider" }, emailRedirectTo: window.location.origin },
      });
      if (sErr) throw sErr;
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
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
            <ButtonPrimary onClick={() => {
              if (!full_name || !email || !phone || !birthdate || password.length < 6) return toast.error("Preencha todos os campos (senha 6+)");
              setStep(3);
            }}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 3 && (
          <>
            <Field label="Número da CNH" value={cnh_number} onChange={setCnh} />
            <SelectField label="Categoria" value={cnh_category} onChange={(v) => setCat(v as "C" | "D" | "E")} options={CNH_CATEGORIES} />
            <Field label="Validade" type="date" value={cnh_expires_at} onChange={setExp} />
            <ButtonPrimary onClick={() => setStep(4)}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 4 && (
          <>
            <SelectField label="Tipo do veículo" value={vehicle_type} onChange={setVt} options={VEHICLE_TYPES} />
            <SelectField label="Carroceria" value={body_type} onChange={setBt} options={BODY_TYPES} />
            <Field label="Placa (ABC1D23)" value={plate} onChange={(v) => setPlate(maskPlate(v))} />
            <Field label="Capacidade (kg)" type="number" value={String(capacity_kg || "")} onChange={(v) => setCap(parseInt(v) || 0)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade" value={city} onChange={setCity} />
              <SelectField label="UF" value={uf} onChange={setUf} options={UF_LIST} />
            </div>
            <ButtonPrimary onClick={submit} disabled={loading}>{loading ? "Enviando..." : "Concluir cadastro"}</ButtonPrimary>
          </>
        )}
      </div>
    </div>
  );
}
