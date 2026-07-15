import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
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
      { title: "Freela Fretes — Intermediador nacional de fretes" },
      { name: "description", content: "Conectamos embarcadores a caminhoneiros autônomos em todo o Brasil. Publique cargas, encontre fretes e feche negócio com pagamento protegido." },
      { name: "author", content: "Freela Fretes" },
      { property: "og:title", content: "Freela Fretes — Intermediador nacional de fretes" },
      { property: "og:description", content: "Conectamos embarcadores a caminhoneiros autônomos em todo o Brasil. Publique cargas, encontre fretes e feche negócio com pagamento protegido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#EA580C" },
      { name: "twitter:title", content: "Freela Fretes — Intermediador nacional de fretes" },
      { name: "twitter:description", content: "Conectamos embarcadores a caminhoneiros autônomos em todo o Brasil. Publique cargas, encontre fretes e feche negócio com pagamento protegido." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/z2DQmZzzmSf6TerOjyc436N6Ln72/social-images/social-1784149921172-WhatsApp_Image_2026-07-15_at_17.34.59.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/z2DQmZzzmSf6TerOjyc436N6Ln72/social-images/social-1784149921172-WhatsApp_Image_2026-07-15_at_17.34.59.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600&display=swap" },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const isLanding = pathname === "/";
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
      {isAdmin || isLanding ? <Outlet /> : <div className="app-shell"><Outlet /></div>}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
