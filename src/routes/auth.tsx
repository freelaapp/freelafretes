import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Building2, Truck } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Freela Fretes" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"choose" | "login">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      if (role === "contractor") nav({ to: "/embarcador/fretes" });
      else if (role === "provider") nav({ to: "/motorista/buscar" });
      else nav({ to: "/onboarding" });
    }
  }, [user, role, authLoading, nav]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 pt-5 pb-3">
        <Link to="/" className="inline-flex">
          <Logo size={40} />
        </Link>
      </header>


      <div className="flex-1 px-5 pt-4">
        {mode === "choose" ? (
          <>
            <h1 className="text-2xl font-black">Entrar</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse sua conta ou cadastre-se.</p>

            <form onSubmit={handleLogin} className="mt-6 space-y-3">
              <Field label="E-mail" type="email" value={email} onChange={setEmail} required />
              <Field label="Senha" type="password" value={password} onChange={setPassword} required />
              <button disabled={loading} className="w-full rounded-full bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60">
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="mt-8 border-t border-border pt-6">
              <p className="text-sm font-semibold text-center mb-3">Novo por aqui? O que você deseja fazer?</p>
              <div className="space-y-2">
                <Link to="/cadastro/empresa" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Sou Empresa — quero enviar cargas</span>
                </Link>
                <Link to="/cadastro/motorista" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <Truck className="h-5 w-5 text-accent" />
                  <span className="font-semibold text-sm">Sou Motorista — quero transportar</span>
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
};
export function Field({ label, value, onChange, ...rest }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        {...rest}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}
