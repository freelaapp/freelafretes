import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createProviderProfile } from "@/lib/api.functions";
import { Field, SelectField, ButtonPrimary, Stepper } from "@/components/ui-kit";
import { isValidCPF, maskCPF, maskPhone, maskPlate, isValidPlate } from "@/lib/format";
import { VEHICLE_TYPES, BODY_TYPES, CNH_CATEGORIES, UF_LIST, BANK_OPTIONS, PIX_KEY_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import { ArrowLeft, Upload, CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/cadastro/motorista")({
  head: () => ({ meta: [{ title: "Cadastro de Motorista — Freela Fretes" }] }),
  component: DriverSignup,
});

type FileSlot = "cnh_document_url" | "cnh_back_url" | "address_proof_url";

const STEP_LABELS = ["CPF", "Dados", "CNH", "Veículo", "Documentos", "Bancário"];

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

  // documentos
  const [docs, setDocs] = useState<Record<FileSlot, string>>({
    cnh_document_url: "",
    cnh_back_url: "",
    address_proof_url: "",
  });
  const [uploading, setUploading] = useState<FileSlot | null>(null);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);

  // bancário
  const [bank_code, setBankCode] = useState("");
  const [bank_agency, setAgency] = useState("");
  const [bank_account, setAccount] = useState("");
  const [pix_key, setPixKey] = useState("");
  const [pix_key_type, setPixType] = useState<"cpf" | "email" | "phone" | "random">("cpf");

  const [loading, setLoading] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [done, setDone] = useState(false);
  const nav = useNavigate();
  const createProfile = useServerFn(createProviderProfile);

  async function ensureAuth(): Promise<string | null> {
    if (authedUserId) return authedUserId;
    setSigningUp(true);
    try {
      const { data: signUp, error: sErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { role: "provider" }, emailRedirectTo: window.location.origin },
      });
      if (sErr) throw sErr;
      let uid = signUp.user?.id ?? null;
      if (!signUp.session) {
        const { data: li, error: liErr } = await supabase.auth.signInWithPassword({ email, password });
        if (liErr) throw liErr;
        uid = li.user?.id ?? uid;
      }
      if (!uid) throw new Error("Falha ao autenticar");
      setAuthedUserId(uid);
      return uid;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao autenticar");
      return null;
    } finally { setSigningUp(false); }
  }

  async function uploadFile(slot: FileSlot, file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo excede 10MB");
    const uid = await ensureAuth();
    if (!uid) return;
    setUploading(slot);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${uid}/${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
      if (error) throw error;
      setDocs((d) => ({ ...d, [slot]: path }));
      toast.success("Arquivo enviado ✓");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro no upload"); }
    finally { setUploading(null); }
  }

  async function submit() {
    if (!bank_code) return toast.error("Selecione o banco");
    if (!bank_agency || !bank_account) return toast.error("Preencha agência e conta");
    if (!pix_key) return toast.error("Informe a chave PIX");
    if (!docs.cnh_document_url || !docs.cnh_back_url || !docs.address_proof_url) return toast.error("Envie todos os documentos");

    setLoading(true);
    try {
      await ensureAuth();
      await createProfile({ data: {
        full_name, email, phone, cpf: cpf.replace(/\D/g,""), birthdate,
        cnh_number, cnh_category, cnh_expires_at, city, uf,
        vehicle: { vehicle_type, body_type, plate: plate.toUpperCase(), capacity_kg },
        cnh_document_url: docs.cnh_document_url,
        cnh_back_url: docs.cnh_back_url,
        address_proof_url: docs.address_proof_url,
        selfie_url: null,
        bank_code, bank_agency, bank_account, pix_key, pix_key_type,
      } });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto h-20 w-20 rounded-full bg-success/15 grid place-items-center">
            <ShieldCheck className="h-10 w-10 text-success" />
          </div>
          <h2 className="font-display text-2xl">Você finalizou o cadastro!</h2>
          <p className="text-sm text-muted-foreground">
            Dentro de instantes enviaremos a aprovação da sua conta.
          </p>
          <ButtonPrimary onClick={() => nav({ to: "/motorista/buscar" })}>Ir para o app</ButtonPrimary>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-10">
      <header className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Link to="/" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
        <p className="font-bold">Cadastro de motorista</p>
      </header>
      <Stepper current={step} total={6} labels={STEP_LABELS} />

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
            <ButtonPrimary onClick={() => {
              if (!cnh_number || !cnh_expires_at) return toast.error("Preencha os dados da CNH");
              setStep(4);
            }}>Continuar</ButtonPrimary>
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
            <ButtonPrimary onClick={() => {
              if (!isValidPlate(plate)) return toast.error("Placa inválida");
              if (capacity_kg <= 0) return toast.error("Informe a capacidade");
              if (!city || !uf) return toast.error("Informe cidade e UF");
              setStep(5);
            }}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 5 && (
          <>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-sm font-semibold text-primary">Dicas importantes</p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                <li>Documentos legíveis, sem reflexo ou corte.</li>
                <li>CNH dentro da validade.</li>
                <li>Comprovante de residência com no máximo 90 dias.</li>
              </ul>
            </div>
            {signingUp && <p className="text-xs text-muted-foreground text-center">Preparando sua conta…</p>}
            <FileUploader label="CNH — Frente" slot="cnh_document_url" onFile={uploadFile} uploading={uploading} url={docs.cnh_document_url} />
            <FileUploader label="CNH — Verso" slot="cnh_back_url" onFile={uploadFile} uploading={uploading} url={docs.cnh_back_url} />
            <FileUploader label="Comprovante de residência" slot="address_proof_url" onFile={uploadFile} uploading={uploading} url={docs.address_proof_url} />
            <ButtonPrimary onClick={() => {
              if (!docs.cnh_document_url || !docs.cnh_back_url || !docs.address_proof_url) return toast.error("Envie os 3 documentos");
              setStep(6);
            }}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 6 && (
          <>
            <p className="text-xs text-muted-foreground">É nessa conta que você recebe seus fretes.</p>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Banco</span>
              <select value={bank_code} onChange={(e) => setBankCode(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
                <option value="">Selecione</option>
                {BANK_OPTIONS.map((b) => <option key={b.code} value={b.code}>{b.code} · {b.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Agência" value={bank_agency} onChange={setAgency} />
              <Field label="Conta c/ dígito" value={bank_account} onChange={setAccount} />
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Tipo da chave PIX</span>
              <select value={pix_key_type} onChange={(e) => setPixType(e.target.value as "cpf" | "email" | "phone" | "random")} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
                {PIX_KEY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <Field label="Chave PIX" value={pix_key} onChange={setPixKey} />
            <ButtonPrimary onClick={submit} disabled={loading}>{loading ? "Enviando..." : "Concluir cadastro"}</ButtonPrimary>
          </>
        )}
      </div>
    </div>
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
          <p className="text-[11px] text-muted-foreground truncate">{done ? "Enviado ✓" : busy ? "Enviando…" : "PNG, JPG ou PDF · até 10MB"}</p>
        </div>
      </div>
      <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(slot, f); }} />
    </label>
  );
}
