import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BannedScreen } from "@/components/BannedScreen";

export const Route = createFileRoute("/motorista/suspenso")({
  head: () => ({ meta: [{ title: "Conta suspensa — Freela Fretes" }, { name: "robots", content: "noindex" }] }),
  component: Suspended,
});

function Suspended() {
  const auth = useAuth();
  const { data } = useQuery({
    enabled: !!auth.user,
    queryKey: ["provider-ban", auth.user?.id],
    queryFn: async () => (await supabase.from("providers").select("ban_reason").eq("user_id", auth.user!.id).maybeSingle()).data,
  });
  return <BannedScreen reason={data?.ban_reason} />;
}
