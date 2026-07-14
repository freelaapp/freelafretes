import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export function useRequireAuth(requireRole?: AppRole) {
  const auth = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) { nav({ to: "/auth" }); return; }
    if (requireRole && auth.role && auth.role !== requireRole) {
      if (auth.role === "contractor") nav({ to: "/embarcador/fretes" });
      else if (auth.role === "provider") nav({ to: "/motorista/buscar" });
    }
  }, [auth.loading, auth.user, auth.role, requireRole, nav]);
  return auth;
}
