import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotifyRow = { user_id: string; title: string; body?: string | null; link?: string | null };

export async function notify(user_id: string | null | undefined, title: string, body?: string | null, link?: string | null) {
  if (!user_id) return;
  try {
    await supabaseAdmin.from("notifications").insert({ user_id, title, body: body ?? null, link: link ?? null });
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function notifyMany(rows: NotifyRow[]) {
  if (!rows.length) return;
  try {
    await supabaseAdmin.from("notifications").insert(
      rows.map((r) => ({ user_id: r.user_id, title: r.title, body: r.body ?? null, link: r.link ?? null })),
    );
  } catch (e) {
    console.error("notifyMany failed", e);
  }
}
