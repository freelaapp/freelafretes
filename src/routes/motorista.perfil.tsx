import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { addVehicle } from "@/lib/api.functions";
import { listCitiesByUf, updateDriverBase } from "@/lib/geo.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { DriverStatusBanner } from "@/components/DriverStatusBanner";
import { ProviderNav } from "@/components/RoleNav";
import { Field, SelectField, ButtonPrimary, ButtonOutline } from "@/components/ui-kit";
import { UF_LIST, VEHICLE_TYPES, BODY_TYPES } from "@/lib/constants";
import { maskPlate, isValidPlate } from "@/lib/format";
import { toast } from "sonner";
import { Truck, Plus, MapPin } from "lucide-react";

export const Route = createFileRoute("/motorista/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Freela Fretes" }] }),
  component: DriverProfile,
});

function DriverProfile() {
  useRequireAuth("provider");
  const auth = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const add = useServerFn(addVehicle);
  const listCities = useServerFn(listCitiesByUf);
  const setBase = useServerFn(updateDriverBase);

  const { data: p } = useQuery({
    enabled: !!auth.user,
    queryKey: ["me-provider", auth.user?.id],
    queryFn: async () => (await supabase.from("providers").select("*").eq("user_id", auth.user!.id).maybeSingle()).data,
  });
  const { data: vehicles = [] } = useQuery({
    enabled: !!p,
    queryKey: ["me-vehicles", p?.id],
    queryFn: async () => (await supabase.from("vehicles").select("*").eq("provider_id", p!.id)).data ?? [],
  });

  const [showAdd, setShowAdd] = useState(false);
  const [vt, setVt] = useState("Truck");
  const [bt, setBt] = useState("Baú");
  const [plate, setPlate] = useState("");
  const [cap, setCap] = useState(0);

  const [baseUf, setBaseUf] = useState("");
  const [baseCity, setBaseCity] = useState("");
  const [radius, setRadius] = useState(300);
  const [cityOpts, setCityOpts] = useState<string[]>([]);

  useEffect(() => {
    if (p) { setBaseUf(p.uf ?? ""); setBaseCity(p.city ?? ""); setRadius(p.search_radius_km ?? 300); }
  }, [p]);

  useEffect(() => {
    if (!baseUf) { setCityOpts([]); return; }
    listCities({ data: { uf: baseUf } }).then((rows) => {
      setCityOpts((rows as { city: string }[]).map((r) => r.city));
    }).catch(() => setCityOpts([]));
  }, [baseUf, listCities]);

  async function saveBase() {
    if (!baseUf || !baseCity) return toast.error("Selecione UF e cidade");
    try {
      await setBase({ data: { city: baseCity, uf: baseUf, search_radius_km: radius } });
      toast.success("Cidade-base atualizada ✓");
      qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }


  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  async function saveVehicle() {
    if (!isValidPlate(plate)) return toast.error("Placa inválida");
    if (cap <= 0) return toast.error("Capacidade inválida");
    try {
      await add({ data: { vehicle_type: vt, body_type: bt, plate, capacity_kg: cap } });
      toast.success("Veículo adicionado");
      setShowAdd(false); setPlate(""); setCap(0);
      qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="pb-24">
      <AppHeader title="Meu perfil" />
      <DriverStatusBanner />
      <div className="px-4 pt-4 space-y-3">
        {p && (
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-accent text-accent-foreground grid place-items-center font-black text-lg">
                {p.full_name?.charAt(0) ?? "M"}
              </div>
              <div>
                <p className="font-bold">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.city}/{p.uf}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs">
              <p><span className="text-muted-foreground">CNH:</span> {p.cnh_number} · Cat {p.cnh_category}</p>
              <p><span className="text-muted-foreground">Contato:</span> {p.email} · {p.phone}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <p className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Cidade-base e raio</p>
          <p className="text-xs text-muted-foreground mt-1">Usamos para ordenar os fretes mais próximos e te avisar quando algo publicar perto de você.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SelectField label="UF" value={baseUf} onChange={(v) => { setBaseUf(v); setBaseCity(""); }} options={UF_LIST} placeholder="UF" />
            <SelectField label="Cidade" value={baseCity} onChange={setBaseCity} options={cityOpts} placeholder="Selecione" />
          </div>
          <div className="mt-2">
            <label className="text-xs text-muted-foreground">Raio de atuação: <strong className="text-foreground">{radius} km</strong></label>
            <input type="range" min={50} max={2000} step={50} value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="w-full accent-primary" />
          </div>
          <div className="mt-3"><ButtonPrimary onClick={saveBase}>Salvar cidade-base</ButtonPrimary></div>
        </div>



        <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Meus veículos</p>
            <button onClick={() => setShowAdd((s) => !s)} className="text-primary text-xs font-semibold inline-flex items-center gap-1">
              <Plus className="h-4 w-4" />{showAdd ? "Cancelar" : "Adicionar"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-2 border border-border rounded-xl p-3">
                <Truck className="h-4 w-4 text-primary" />
                <div className="text-sm">
                  <p className="font-semibold">{v.plate}</p>
                  <p className="text-xs text-muted-foreground">{v.vehicle_type} · {v.body_type} · {v.capacity_kg} kg</p>
                </div>
              </div>
            ))}
            {vehicles.length === 0 && <p className="text-xs text-muted-foreground">Nenhum veículo cadastrado.</p>}
          </div>
          {showAdd && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <SelectField label="Tipo" value={vt} onChange={setVt} options={VEHICLE_TYPES} />
              <SelectField label="Carroceria" value={bt} onChange={setBt} options={BODY_TYPES} />
              <Field label="Placa" value={plate} onChange={(v) => setPlate(maskPlate(v))} />
              <Field label="Capacidade (kg)" type="number" value={String(cap || "")} onChange={(v) => setCap(parseInt(v) || 0)} />
              <ButtonPrimary onClick={saveVehicle}>Salvar</ButtonPrimary>
            </div>
          )}
        </div>

        <ButtonOutline onClick={logout}>Sair da conta</ButtonOutline>
      </div>
      <ProviderNav />
    </div>
  );
}
