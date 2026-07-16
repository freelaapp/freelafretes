import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { simulatePricing } from "@/lib/pricing.functions";
import { VEHICLE_TYPES, CARGO_TYPES, UF_LIST } from "@/lib/constants";
import type { PricingResult } from "@/lib/pricing";
import { ChevronDown, ChevronUp, ArrowRight, TruckIcon } from "lucide-react";

const SIMULATION_STORAGE_KEY = "freela.simulacao";

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtMoneySigned(cents: number) {
  const s = cents < 0 ? "-" : "";
  return `${s}${fmtMoney(Math.abs(cents))}`;
}

export type SimulatorFormState = {
  originCep: string; originCity: string; originUf: string;
  destCep: string; destCity: string; destUf: string;
  distanceKm: string;
  vehicleType: string; cargoType: string;
  pesoKg: string; volumeM3: string; valorCarga: string;
  temPedagio: boolean; coletaNoturna: boolean;
  ajudantes: boolean; cargaDescarga: boolean;
  dataColeta: string;
};

const emptyForm: SimulatorFormState = {
  originCep: "", originCity: "", originUf: "",
  destCep: "", destCity: "", destUf: "",
  distanceKm: "", vehicleType: "", cargoType: "",
  pesoKg: "", volumeM3: "", valorCarga: "",
  temPedagio: false, coletaNoturna: false,
  ajudantes: false, cargaDescarga: false,
  dataColeta: "",
};

type CepLookupState = { loading: boolean; error?: string };

function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

async function fetchViaCep(cep: string): Promise<{ localidade: string; uf: string } | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return { localidade: data.localidade as string, uf: data.uf as string };
  } catch {
    return null;
  }
}

export function SimulatorCard({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState<SimulatorFormState>(emptyForm);
  const [originCepState, setOriginCepState] = useState<CepLookupState>({ loading: false });
  const [destCepState, setDestCepState] = useState<CepLookupState>({ loading: false });
  const [expandBreakdown, setExpandBreakdown] = useState(true);
  const simulate = useServerFn(simulatePricing);

  const mut = useMutation({
    mutationFn: async () => simulate({ data: buildInput(form) }),
  });

  const canSubmit = form.originUf && form.destUf && form.distanceKm && form.vehicleType && form.cargoType && form.pesoKg;

  function set<K extends keyof SimulatorFormState>(k: K, v: SimulatorFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCepChange(kind: "origin" | "dest", raw: string) {
    const masked = maskCep(raw);
    if (kind === "origin") set("originCep", masked);
    else set("destCep", masked);
    const clean = masked.replace(/\D/g, "");
    const setState = kind === "origin" ? setOriginCepState : setDestCepState;
    if (clean.length !== 8) {
      setState({ loading: false });
      return;
    }
    setState({ loading: true });
    const found = await fetchViaCep(clean);
    if (!found) {
      setState({ loading: false, error: "CEP não encontrado" });
      return;
    }
    setState({ loading: false });
    setForm((f) => kind === "origin"
      ? { ...f, originCity: found.localidade, originUf: found.uf }
      : { ...f, destCity: found.localidade, destUf: found.uf });
  }

  function saveAndGoPublish() {
    try {
      localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify({ form, result: mut.data }));
    } catch { /* ignore */ }
  }

  return (
    <div className="rounded-2xl bg-card text-foreground p-5 md:p-6 shadow-card space-y-4">
      <div className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        <TextInput label="Cidade origem" value={form.originCity} onChange={(v) => set("originCity", v)} placeholder="Sorriso" />
        <SelectInput label="UF origem" value={form.originUf} onChange={(v) => set("originUf", v)} options={UF_LIST} />
        <TextInput label="Cidade destino" value={form.destCity} onChange={(v) => set("destCity", v)} placeholder="Santos" />
        <SelectInput label="UF destino" value={form.destUf} onChange={(v) => set("destUf", v)} options={UF_LIST} />
        <NumberInput label="Distância (km)" value={form.distanceKm} onChange={(v) => set("distanceKm", v)} placeholder="1980" hint="consulte no seu app de mapas — em breve calcularemos para você" />
        <SelectInput label="Veículo" value={form.vehicleType} onChange={(v) => set("vehicleType", v)} options={VEHICLE_TYPES} />
        <SelectInput label="Tipo de carga" value={form.cargoType} onChange={(v) => set("cargoType", v)} options={CARGO_TYPES} />
        <NumberInput label="Peso (kg)" value={form.pesoKg} onChange={(v) => set("pesoKg", v)} placeholder="32000" />
        <NumberInput label="Volume (m³) — opcional" value={form.volumeM3} onChange={(v) => set("volumeM3", v)} />
        <NumberInput label="Valor da carga (R$) — opcional" value={form.valorCarga} onChange={(v) => set("valorCarga", v)} placeholder="150000" />
        <div className="md:col-span-1">
          <label className="block text-xs font-semibold text-foreground/80 mb-1.5">Data da coleta</label>
          <input type="datetime-local" value={form.dataColeta} onChange={(e) => set("dataColeta", e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Toggle label="Rota com pedágio" checked={form.temPedagio} onChange={(v) => set("temPedagio", v)} />
        <Toggle label="Coleta noturna (20h–6h)" checked={form.coletaNoturna} onChange={(v) => set("coletaNoturna", v)} />
        <Toggle label="Preciso de ajudante" checked={form.ajudantes} onChange={(v) => set("ajudantes", v)} />
        <Toggle label="Carga/descarga" checked={form.cargaDescarga} onChange={(v) => set("cargaDescarga", v)} />
      </div>

      <button
        onClick={() => mut.mutate()}
        disabled={!canSubmit || mut.isPending}
        className="w-full md:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-2"
      >
        <TruckIcon className="h-4 w-4" />
        {mut.isPending ? "Calculando…" : "Simular valor do frete"}
      </button>

      {mut.isError && (
        <p className="text-sm text-destructive">Não foi possível calcular. Verifique os campos e tente novamente.</p>
      )}

      {mut.data && (
        <ResultPanel
          result={mut.data}
          expanded={expandBreakdown}
          onToggle={() => setExpandBreakdown((v) => !v)}
          onPublish={saveAndGoPublish}
        />
      )}
    </div>
  );
}

// ---------- Result ----------
function ResultPanel({ result, expanded, onToggle, onPublish }: {
  result: PricingResult; expanded: boolean; onToggle: () => void; onPublish: () => void;
}) {
  return (
    <div className="mt-2 p-4 md:p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Valor sugerido do frete</p>
      <p className="font-display font-mono text-4xl md:text-5xl text-accent leading-none">
        {fmtMoney(result.freteCents)}
      </p>
      <p className="text-sm text-muted-foreground">
        Faixa de mercado entre <b className="text-foreground">{fmtMoney(result.faixaMinCents)}</b> e{" "}
        <b className="text-foreground">{fmtMoney(result.faixaMaxCents)}</b>.
      </p>
      <div className="text-sm bg-card rounded-lg px-3 py-2 border border-border flex flex-wrap gap-x-4 gap-y-1">
        <span>Taxa da plataforma (10%): <b>{fmtMoney(result.taxaPlataformaCents)}</b></span>
        <span className="text-muted-foreground">·</span>
        <span>Total para o embarcador: <b>{fmtMoney(result.totalEmbarcadorCents)}</b></span>
      </div>

      <button onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-foreground border-t border-border pt-3 mt-2">
        <span>Como chegamos neste valor?</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <ul className="space-y-1.5 text-sm">
          {result.breakdown.map((line) => (
            <li key={line.label} className="flex items-start justify-between gap-4 py-1">
              <div>
                <p className="text-foreground">{line.label}</p>
                {line.hint && <p className="text-xs text-muted-foreground">{line.hint}</p>}
              </div>
              <span className={
                line.valor === 0 ? "text-muted-foreground" :
                line.valor < 0 ? "text-emerald-600 font-semibold tabular-nums" :
                "text-sky-700 font-semibold tabular-nums"
              }>
                {line.valor === 0 ? "—" : fmtMoneySigned(line.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Estimativa. O valor final é definido na negociação com o motorista.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Link to="/cadastro/empresa" onClick={onPublish}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-hover">
          Publicar este frete <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/cadastro/motorista"
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border font-semibold hover:bg-secondary">
          Sou motorista, quero fretes assim
        </Link>
      </div>
    </div>
  );
}

// ---------- helpers ----------
export function buildInput(form: SimulatorFormState) {
  const num = (s: string) => {
    const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : 0;
  };
  return {
    origemCidade: form.originCity || undefined,
    origemUf: form.originUf || undefined,
    destinoCidade: form.destCity || undefined,
    destinoUf: form.destUf || undefined,
    distanciaKm: num(form.distanceKm),
    vehicleType: form.vehicleType,
    pesoKg: num(form.pesoKg),
    volumeM3: form.volumeM3 ? num(form.volumeM3) : undefined,
    cargoType: form.cargoType,
    valorCargaDeclarado: form.valorCarga ? num(form.valorCarga) : undefined,
    temPedagio: form.temPedagio,
    coletaNoturna: form.coletaNoturna,
    ajudantes: form.ajudantes ? 1 : 0,
    precisaCargaDescarga: form.cargaDescarga,
    dataColeta: form.dataColeta || undefined,
  };
}

export function readSavedSimulation(): { form: SimulatorFormState; result?: PricingResult } | null {
  try {
    const raw = localStorage.getItem(SIMULATION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
export function clearSavedSimulation() {
  try { localStorage.removeItem(SIMULATION_STORAGE_KEY); } catch { /* */ }
}

// ---------- primitive inputs ----------
function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground/80 mb-1.5">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
    </label>
  );
}
function NumberInput({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground/80 mb-1.5">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} placeholder={placeholder}
        className="w-full px-3 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </label>
  );
}
function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground/80 mb-1.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
        <option value="">Selecione</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`px-3 py-2 rounded-full text-xs font-semibold border transition ${checked ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-secondary"}`}>
      {label}
    </button>
  );
}
