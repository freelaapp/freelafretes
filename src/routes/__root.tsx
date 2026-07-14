import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="app-shell flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <p className="mt-2 text-lg font-semibold">Página não encontrada</p>
        <a href="/" className="mt-6 inline-flex px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium">
          Ir para o início
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="app-shell flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-lg font-semibold">Ops, algo deu errado</p>
        <p className="mt-1 text-sm text-muted-foreground">Tente novamente ou volte ao início.</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button onClick={() => { router.invalidate(); reset(); }} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium">
            Tentar novamente
          </button>
          <a href="/" className="px-4 py-2 rounded-full border border-border text-sm font-medium">Início</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Freela Fretes — Marketplace de fretes para caminhoneiros e embarcadores" },
      { name: "description", content: "Conectamos empresas com carga a motoristas autônomos. Publique seu frete ou encontre a próxima viagem." },
      { name: "author", content: "Freela Fretes" },
      { property: "og:title", content: "Freela Fretes" },
      { property: "og:description", content: "Sua carga tem pressa. Seu caminhão tem destino." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#1E3A8A" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") {
        router.invalidate();
        if (e !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-shell">
        <Outlet />
      </div>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
