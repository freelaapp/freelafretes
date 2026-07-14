import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function useRequireAuth(requireRole?: AppRole) {
  const auth = useAuth();
  const nav = useNavigate();

  const banned = useQuery({
    enabled: !!auth.user && requireRole === "provider",
    queryKey: ["provider-status", auth.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("providers").select("is_active,is_banned,ban_reason").eq("user_id", auth.user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) { nav({ to: "/auth" }); return; }
    if (requireRole && auth.role && auth.role !== requireRole) {
      if (auth.role === "contractor") nav({ to: "/embarcador/fretes" });
      else if (auth.role === "provider") nav({ to: "/motorista/buscar" });
    }
    if (requireRole === "provider" && banned.data && (banned.data.is_banned || banned.data.is_active === false)) {
      nav({ to: "/motorista/suspenso" });
    }
  }, [auth.loading, auth.user, auth.role, requireRole, nav, banned.data]);

  return { ...auth, providerBanned: banned.data?.is_banned || banned.data?.is_active === false, banReason: banned.data?.ban_reason };
}
