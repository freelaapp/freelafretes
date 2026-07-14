import { createFileRoute, Link } from "@tanstack/react-router";
import { SimulatorCard } from "@/components/SimulatorCard";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Simulador de Frete — Freela Fretes" },
      { name: "description", content: "Simule o valor do seu frete em segundos. Cálculo transparente considerando distância, veículo, carga, pedágios, seguro e mercado." },
      { property: "og:title", content: "Simulador de Frete — Freela Fretes" },
      { property: "og:description", content: "Descubra em segundos o valor justo do seu frete rodoviário no Brasil." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SimuladorPage,
});

function SimuladorPage() {
  return (
    <div className="min-h-dvh bg-secondary/40">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-5xl px-5 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <Link to="/"><Logo size={36} /></Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/cadastro/empresa" className="px-3 py-2 rounded-lg font-semibold text-foreground hover:bg-secondary">Tenho carga</Link>
            <Link to="/cadastro/motorista" className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary-hover">Sou motorista</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 md:px-8 py-8 md:py-12 space-y-6">
        <div>
          <h1 className="font-display text-3xl md:text-5xl text-foreground">Simulador de frete</h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl">
            Preencha os dados da sua carga e receba na hora o valor sugerido, a faixa de mercado e o detalhamento completo do cálculo — transparência total.
          </p>
        </div>
        <SimulatorCard />
      </main>
    </div>
  );
}
