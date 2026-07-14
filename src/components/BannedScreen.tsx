import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export function BannedScreen({ reason }: { reason?: string | null }) {
  const nav = useNavigate();
  async function logout() { await supabase.auth.signOut(); nav({ to: "/" }); }
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-background">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 grid place-items-center mb-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="font-display text-2xl">Conta suspensa</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua conta de motorista foi suspensa. Fale com o nosso suporte para mais informações.</p>
        {reason && <p className="mt-3 text-xs bg-muted p-3 rounded-lg text-muted-foreground italic">Motivo: {reason}</p>}
        <button onClick={logout} className="mt-6 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold">Sair da conta</button>
      </div>
    </div>
  );
}

export function ProviderGate({ banned, reason, children }: { banned?: boolean; reason?: string | null; children: ReactNode }) {
  if (banned) return <BannedScreen reason={reason} />;
  return <>{children}</>;
}
