import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMe } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel Admin — Freela Fretes" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <div className="min-h-screen w-full bg-muted/30 text-foreground"><Outlet /></div>;
  }
  return <AdminGuard />;
}

function AdminGuard() {
  const auth = useAuth();
  const nav = useNavigate();
  const me = useServerFn(adminMe);

  const meQ = useQuery({
    enabled: !!auth.user,
    queryKey: ["admin-me", auth.user?.id],
    queryFn: () => me(),
  });

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) { nav({ to: "/admin/login" }); return; }
    if (meQ.isSuccess && !meQ.data) nav({ to: "/admin/login" });
  }, [auth.loading, auth.user, meQ.isSuccess, meQ.data, nav]);

  if (auth.loading || !auth.user || meQ.isLoading || !meQ.data) {
    return <div className="min-h-screen w-full grid place-items-center bg-muted/30"><p className="text-sm text-muted-foreground">Carregando painel...</p></div>;
  }

  return <AdminShell><Outlet /></AdminShell>;
}
