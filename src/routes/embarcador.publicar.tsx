import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publishFreight } from "@/lib/api.functions";
import { simulatePricing } from "@/lib/pricing.functions";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { ContractorNav } from "@/components/RoleNav";
import { Field, SelectField, TextArea, ButtonPrimary, Stepper } from "@/components/ui-kit";
import { CARGO_TYPES, VEHICLE_TYPES, BODY_TYPES, UF_LIST } from "@/lib/constants";
import { maskCEP } from "@/lib/format";
import { readSavedSimulation, clearSavedSimulation, type SimulatorFormState } from "@/components/SimulatorCard";
import type { PricingResult } from "@/lib/pricing";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/embarcador/publicar")({
  head: () => ({ meta: [{ title: "Publicar Frete — Freela Fretes" }] }),
  component: PublishPage,
});

function PublishPage() {
  useRequireAuth("contractor");
  const nav = useNavigate();
  const publish = useServerFn(publishFreight);
  const simulateFn = useServerFn(simulatePricing);
  const [step, setStep] = useState(1);

  // Carga
  const [title, setTitle] = useState("");
  const [cargo_type, setCargoType] = useState("");
  const [cargo_weight_kg, setWeight] = useState(0);
  const [description, setDescription] = useState("");
  // Rota
  const [origin_cep, setOCep] = useState("");
  const [origin_address, setOAddr] = useState("");
  const [origin_city, setOCity] = useState("");
  const [origin_uf, setOUf] = useState("");
  const [destination_cep, setDCep] = useState("");
  const [destination_address, setDAddr] = useState("");
  const [destination_city, setDCity] = useState("");
  const [destination_uf, setDUf] = useState("");
  const [distance_km, setDist] = useState(0);
  const [toll_included, setToll] = useState(false);
  // Requisitos
  const [vehicle_types, setVts] = useState<string[]>([]);
  const [body_types, setBts] = useState<string[]>([]);
  // Datas + valor
  const [pickup_at, setPickup] = useState("");
  const [delivery_expected_at, setDelivery] = useState("");
  const [payment, setPayment] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<PricingResult | null>(null);

  // Restaura simulação salva no localStorage (vinda do simulador público)
  useEffect(() => {
    const saved = readSavedSimulation();
    if (!saved) return;
    const f: SimulatorFormState = saved.form;
    if (f.originCity) setOCity(f.originCity);
    if (f.originUf) setOUf(f.originUf);
    if (f.destCity) setDCity(f.destCity);
    if (f.destUf) setDUf(f.destUf);
    if (f.distanceKm) setDist(parseInt(f.distanceKm) || 0);
    if (f.cargoType) setCargoType(f.cargoType);
    if (f.pesoKg) setWeight(parseInt(f.pesoKg) || 0);
    if (f.vehicleType) setVts([f.vehicleType]);
    if (f.temPedagio) setToll(true);
    if (f.dataColeta) setPickup(f.dataColeta);
    if (saved.result?.freteCents) setPayment(Math.round(saved.result.freteCents / 100));
    clearSavedSimulation();
    toast.success("Dados da simulação carregados");
  }, []);

  // Auto-sugestão no step 4
  const vehicleTypeForCalc = vehicle_types[0] ?? "";
  const suggestKey = useMemo(
    () => `${distance_km}|${vehicleTypeForCalc}|${cargo_type}|${cargo_weight_kg}|${origin_uf}|${toll_included}|${pickup_at}`,
    [distance_km, vehicleTypeForCalc, cargo_type, cargo_weight_kg, origin_uf, toll_included, pickup_at],
  );
  const suggestMut = useMutation({
    mutationFn: async () => simulateFn({ data: {
      origemUf: origin_uf, destinoUf: destination_uf,
      distanciaKm: distance_km, vehicleType: vehicleTypeForCalc || "Truck",
      pesoKg: cargo_weight_kg, cargoType: cargo_type,
      temPedagio: toll_included, dataColeta: pickup_at || undefined,
    } }),
    onSuccess: (r) => setSuggestion(r),
  });
  useEffect(() => {
    if (step !== 4) return;
    if (!distance_km || !vehicleTypeForCalc || !cargo_type || !cargo_weight_kg) return;
    suggestMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, suggestKey]);

  async function submit() {
    if (payment <= 0) return toast.error("Informe o valor");
    if (!pickup_at) return toast.error("Data de coleta obrigatória");
    setLoading(true);
    try {
      await publish({ data: {
        title, description: description || null, cargo_type,
        cargo_weight_kg, vehicle_types, body_types,
        origin_city, origin_uf, origin_address: origin_address || null, origin_cep: origin_cep || null,
        destination_city, destination_uf, destination_address: destination_address || null, destination_cep: destination_cep || null,
        distance_km, pickup_at: new Date(pickup_at).toISOString(),
        delivery_expected_at: delivery_expected_at ? new Date(delivery_expected_at).toISOString() : null,
        toll_included, payment_reais: payment,
        suggested_amount_in_cents: suggestion?.freteCents ?? null,
        pricing_breakdown: suggestion?.breakdown ?? null,
        pricing_factors: suggestion?.fatores ?? null,
      } });
      toast.success("Frete publicado!");
      nav({ to: "/embarcador/fretes" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setLoading(false); }
  }

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const belowMin = suggestion && payment > 0 && payment * 100 < suggestion.faixaMinCents * 0.8;
  const aboveMax = suggestion && payment > 0 && payment * 100 > suggestion.faixaMaxCents * 1.2;



  return (
    <div className="pb-32">
      <AppHeader title="Publicar frete" subtitle={`Etapa ${step} de 4`} />
      <Stepper current={step} total={4} labels={["Carga", "Rota", "Requisitos", "Datas e Valor"]} />
      <div className="px-4 mt-4 space-y-3">
        {step === 1 && (
          <>
            <Field label="Título do frete" value={title} onChange={setTitle} placeholder="Ex.: Soja Sorriso → Santos" />
            <SelectField label="Tipo de carga" value={cargo_type} onChange={setCargoType} options={CARGO_TYPES} />
            <Field label="Peso (kg)" type="number" value={String(cargo_weight_kg || "")} onChange={(v) => setWeight(parseInt(v) || 0)} />
            <TextArea label="Descrição (opcional)" value={description} onChange={setDescription} />
            <ButtonPrimary onClick={() => {
              if (!title || !cargo_type || !cargo_weight_kg) return toast.error("Preencha os campos");
              setStep(2);
            }}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-sm font-semibold mt-2">Origem</p>
            <Field label="CEP" value={origin_cep} onChange={(v) => setOCep(maskCEP(v))} />
            <Field label="Endereço" value={origin_address} onChange={setOAddr} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade" value={origin_city} onChange={setOCity} />
              <SelectField label="UF" value={origin_uf} onChange={setOUf} options={UF_LIST} />
            </div>
            <p className="text-sm font-semibold mt-4">Destino</p>
            <Field label="CEP" value={destination_cep} onChange={(v) => setDCep(maskCEP(v))} />
            <Field label="Endereço" value={destination_address} onChange={setDAddr} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade" value={destination_city} onChange={setDCity} />
              <SelectField label="UF" value={destination_uf} onChange={setDUf} options={UF_LIST} />
            </div>
            <Field label="Distância (km)" type="number" value={String(distance_km || "")} onChange={(v) => setDist(parseInt(v) || 0)} />
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={toll_included} onChange={(e) => setToll(e.target.checked)} className="h-4 w-4" />
              <span className="text-sm">Pedágio incluso no valor</span>
            </label>
            <ButtonPrimary onClick={() => {
              if (!origin_city || !origin_uf || !destination_city || !destination_uf || !distance_km) return toast.error("Preencha origem, destino e distância");
              setStep(3);
            }}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-xs text-muted-foreground">Deixe em branco para aceitar qualquer.</p>
            <p className="text-sm font-semibold mt-2">Tipos de veículo</p>
            <Chips options={VEHICLE_TYPES} selected={vehicle_types} onToggle={(v) => setVts(toggle(vehicle_types, v))} />
            <p className="text-sm font-semibold mt-4">Carrocerias</p>
            <Chips options={BODY_TYPES} selected={body_types} onToggle={(v) => setBts(toggle(body_types, v))} />
            <ButtonPrimary onClick={() => setStep(4)}>Continuar</ButtonPrimary>
          </>
        )}
        {step === 4 && (
          <>
            <Field label="Data e hora da coleta" type="datetime-local" value={pickup_at} onChange={setPickup} />
            <Field label="Previsão de entrega (opcional)" type="datetime-local" value={delivery_expected_at} onChange={setDelivery} />

            {suggestMut.isPending && (
              <div className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Calculando valor sugerido…</div>
            )}
            {suggestion && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Valor sugerido pelo motor</p>
                <p className="font-mono text-3xl text-accent leading-none">
                  R$ {(suggestion.freteCents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Faixa de mercado: R$ {(suggestion.faixaMinCents / 100).toLocaleString("pt-BR")} — R$ {(suggestion.faixaMaxCents / 100).toLocaleString("pt-BR")}
                </p>
                <button type="button" onClick={() => setPayment(Math.round(suggestion.freteCents / 100))}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover">
                  Usar valor sugerido
                </button>
                <button type="button" onClick={() => setBreakdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-foreground border-t border-primary/20 pt-2">
                  Como chegamos neste valor? {breakdownOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {breakdownOpen && (
                  <ul className="space-y-1 text-xs">
                    {suggestion.breakdown.map((b) => (
                      <li key={b.label} className="flex items-start justify-between gap-3 py-0.5">
                        <div>
                          <p>{b.label}</p>
                          {b.hint && <p className="text-[10px] text-muted-foreground">{b.hint}</p>}
                        </div>
                        <span className={b.valor === 0 ? "text-muted-foreground" : b.valor < 0 ? "text-emerald-600 font-semibold" : "text-sky-700 font-semibold"}>
                          {b.valor === 0 ? "—" : `${b.valor < 0 ? "-" : ""}R$ ${Math.abs(b.valor / 100).toLocaleString("pt-BR")}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Field label="Valor oferecido (R$)" type="number" value={String(payment || "")} onChange={(v) => setPayment(parseFloat(v) || 0)} />
            {belowMin && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Valor abaixo do mercado — seu frete pode demorar a receber propostas.
              </p>
            )}
            {aboveMax && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Valor acima do mercado — você pode conseguir o mesmo frete por menos.
              </p>
            )}
            <p className="text-xs text-muted-foreground">Motoristas poderão aceitar este valor ou enviar contraproposta.</p>

            <div className="mt-4 rounded-xl bg-secondary p-4 text-sm">
              <p className="font-semibold">Revisão</p>
              <p className="mt-1"><b>{title}</b> · {cargo_type} · {cargo_weight_kg} kg</p>
              <p>{origin_city}/{origin_uf} → {destination_city}/{destination_uf} · {distance_km} km</p>
              <p className="mt-1 text-primary font-bold">R$ {payment.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <ButtonPrimary onClick={submit} disabled={loading}>{loading ? "Publicando..." : "Publicar frete"}</ButtonPrimary>
          </>
        )}
      </div>
      <ContractorNav />
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
