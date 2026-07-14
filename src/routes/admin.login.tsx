import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminMe, bootstrapFirstAdmin } from "@/lib/admin.functions";
import logoAsset from "@/assets/freela-fretes-logo.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Entrar — Painel Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const nav = useNavigate();
  const me = useServerFn(adminMe);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const admin = await me();
      if (!admin) { await supabase.auth.signOut(); throw new Error("Este usuário não tem acesso ao painel."); }
      toast.success(`Bem-vindo, ${admin.name}`);
      nav({ to: "/admin" });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao entrar");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-elevated space-y-4">
        <div className="flex items-center gap-3">
          <img src={logoAsset.url} alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-display text-xl tracking-wide">Freela Fretes</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Painel administrativo</p>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">E-mail</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Senha</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
        <button disabled={loading} type="submit" className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-semibold disabled:opacity-60">
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">Área restrita à equipe operacional Freela Fretes.</p>
      </form>
    </div>
  );
}
