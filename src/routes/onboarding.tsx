import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Truck } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Complete seu cadastro — Freela Fretes" }] }),
  component: Onboarding,
});

function Onboarding() {
  return (
    <div className="min-h-dvh px-5 pt-8">
      <h1 className="text-2xl font-black">Complete seu cadastro</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha como você quer usar o Freela Fretes.</p>
      <div className="mt-6 space-y-3">
        <Link to="/cadastro/empresa" className="flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground px-4 py-4 shadow-elevated">
          <Building2 className="h-6 w-6" />
          <div>
            <p className="font-bold">Sou Empresa</p>
            <p className="text-xs opacity-80">Quero enviar cargas</p>
          </div>
        </Link>
        <Link to="/cadastro/motorista" className="flex items-center gap-3 rounded-2xl bg-accent text-accent-foreground px-4 py-4 shadow-elevated">
          <Truck className="h-6 w-6" />
          <div>
            <p className="font-bold">Sou Motorista</p>
            <p className="text-xs opacity-90">Quero transportar</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
