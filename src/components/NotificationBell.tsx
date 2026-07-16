import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTimeBR } from "@/lib/format";

type Notif = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export function NotificationBell({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,link,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (alive) setItems((data ?? []) as Notif[]);
    }
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;
  const unread = items.filter((i) => !i.read_at).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read_at: new Date().toISOString() } : x)));
  }
  async function markAllRead() {
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at ?? now })));
  }

  const btnCls = tone === "light" ? "text-foreground" : "text-primary-foreground";

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
        className={`relative h-9 w-9 grid place-items-center rounded-full hover:bg-black/10 ${btnCls}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[92vw] bg-card border border-border rounded-xl shadow-elevated z-50 overflow-hidden text-foreground">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary font-semibold">
                Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-xs text-muted-foreground">Nenhuma notificação.</p>}
            {items.map((n) => {
              const body = (
                <div className={`px-3 py-2 border-b border-border/60 ${!n.read_at ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDateTimeBR(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
              return (
                <button
                  key={n.id}
                  onClick={async () => {
                    await markRead(n.id);
                    setOpen(false);
                    if (n.link) router.navigate({ to: n.link as string });
                  }}
                  className="block w-full text-left hover:bg-muted/60"
                >
                  {body}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
