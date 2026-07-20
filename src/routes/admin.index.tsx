import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminDashboard } from "@/lib/admin.functions";
import { KpiCard, PageHeader, DataTable, StatusBadge } from "@/components/admin/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(adminDashboard);
  const q = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });
  const d = q.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão geral da operação Freela Fretes Transportes" />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard label="Fretes abertos" value={d?.kpis.openFreights ?? "—"} />
        <KpiCard label="Viagens em andamento" value={d?.kpis.inProgress ?? "—"} />
        <KpiCard label="Empresas p/ validar" value={d?.kpis.pendingValidation ?? "—"} tone={(d?.kpis.pendingValidation ?? 0) > 0 ? "warning" : "default"} />
        <KpiCard label="GMV do mês" value={formatBRL(d?.kpis.gmvMonthCents ?? 0)} />
        <KpiCard label="Margem Freela (mês)" value={formatBRL(d?.kpis.marginMonthCents ?? 0)} tone="success" />
        <KpiCard label="ICMS destacado (mês)" value={formatBRL(d?.kpis.icmsMonthCents ?? 0)} />
        <KpiCard label="Retenções TAC (mês)" value={formatBRL(d?.kpis.withholdingsMonthCents ?? 0)} hint={`INSS ${formatBRL(d?.kpis.inssMonthCents ?? 0)} · SEST/SENAT ${formatBRL(d?.kpis.sestSenatMonthCents ?? 0)}`} />
        <KpiCard label="Em custódia" value={formatBRL(d?.kpis.escrowCents ?? 0)} />
        <KpiCard
          label="Documentos emitidos (mês)"
          value={d?.kpis.docsIssuedMonth ?? "—"}
          hint={d?.kpis.docsByType ? Object.entries(d.kpis.docsByType).map(([k, v]) => `${k}: ${v}`).join(" · ") : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold text-sm mb-3">Fretes publicados (últimos 30 dias)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={d?.freightsPerDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#ECA826" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold text-sm mb-3">Viagens concluídas x canceladas (12 semanas)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={d?.jobsPerWeek ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="completed" name="Concluídas" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="cancelled" name="Canceladas" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Ações pendentes</h3>
        <DataTable
          rows={buildPendingRows(d)}
          empty="Sem pendências. Tudo em dia! ✨"
          columns={[
            { key: "type", header: "Tipo", render: (r) => <StatusBadge tone={r.tone}>{r.type}</StatusBadge> },
            { key: "desc", header: "Descrição", render: (r) => <span className="text-sm">{r.desc}</span> },
            { key: "date", header: "Desde", render: (r) => <span className="text-xs text-muted-foreground">{r.date}</span> },
            { key: "link", header: "", render: (r) => <Link to={r.link} className="text-primary text-xs font-semibold">Resolver →</Link>, width: "100px" },
          ]}
        />
      </div>
    </div>
  );
}

function buildPendingRows(d: any) {
  const out: any[] = [];
  if ((d?.pending.contractorsPending ?? 0) > 0)
    out.push({ type: "Validação", tone: "warning", desc: `${d.pending.contractorsPending} empresa(s) aguardando aprovação`, date: "-", link: "/admin/validation" });
  for (const j of d?.pending.stuckJobs ?? [])
    out.push({ type: "Viagem travada", tone: "danger", desc: `Viagem ${j.id.slice(0, 8)} em andamento há mais de 7 dias`, date: formatDateBR(j.started_at), link: `/admin/jobs/${j.id}` });
  for (const p of d?.pending.latePayments ?? [])
    out.push({ type: "Pagamento", tone: "warning", desc: `Pagamento pendente há mais de 48h`, date: formatDateBR(p.created_at), link: "/admin/payments" });
  return out;
}
