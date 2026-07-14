import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AppHeader } from "@/components/AppHeader";
import { ContractorNav } from "@/components/RoleNav";
import { Badge, ButtonOutline } from "@/components/ui-kit";
import { toast } from "sonner";

export const Route = createFileRoute("/embarcador/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Freela Fretes" }] }),
  component: ContractorProfile,
});

function ContractorProfile() {
  useRequireAuth("contractor");
  const auth = useAuth();
  const nav = useNavigate();
  const { data: c } = useQuery({
    enabled: !!auth.user,
    queryKey: ["me-contractor", auth.user?.id],
    queryFn: async () => (await supabase.from("contractors").select("*").eq("user_id", auth.user!.id).maybeSingle()).data,
  });

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    nav({ to: "/" });
  }

  return (
    <div className="pb-24">
      <AppHeader title="Meu perfil" />
      <div className="px-4 pt-4 space-y-3">
        {c && (
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-black text-lg">
                {c.company_name?.charAt(0) ?? "E"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{c.company_name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.corporate_reason}</p>
                <div className="mt-1">
                  {c.validation_status === "APPROVED"
                    ? <Badge tone="primary">Empresa verificada ✓</Badge>
                    : <Badge tone="warning">Em validação</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs">
              <p><span className="text-muted-foreground">CNPJ:</span> {c.cnpj}</p>
              <p><span className="text-muted-foreground">Segmento:</span> {c.segment}</p>
              <p><span className="text-muted-foreground">Volume/mês:</span> {c.monthly_freight_volume}</p>
              <p><span className="text-muted-foreground">Contato:</span> {c.contact_name} · {c.contact_email}</p>
            </div>
          </div>
        )}
        <ButtonOutline onClick={logout}>Sair da conta</ButtonOutline>
      </div>
      <ContractorNav />
    </div>
  );
}
