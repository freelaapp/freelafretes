import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyInvoice } from "@/lib/finance.functions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { ArrowLeft, Printer, TrendingUp } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/embarcador/fatura/$id")({
  head: () => ({ meta: [{ title: "Fatura — Freela Fretes" }] }),
  component: FaturaPage,
});

function FaturaPage() {
  useRequireAuth("contractor");
  const { id } = Route.useParams();
  const fn = useServerFn(getMyInvoice);
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => fn({ data: { id } }) });
  const d = q.data as any;

  if (q.isLoading || !d) return <div className="p-6 text-sm text-muted-foreground">Carregando fatura...</div>;
  const inv = d.invoice;
  const job = inv.jobs;
  const f = job?.freights;
  const prov = job?.providers;
  const vehicle = prov?.vehicles?.[0];
  const shipper = d.shipper;
  const documents = d.documents ?? [];
  const numero = `FRL-${inv.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <Link to="/embarcador/faturas" className="inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-6 print:p-0">
        <div className="bg-white text-black rounded-2xl shadow-lg print:shadow-none print:rounded-none p-8">
          <div className="flex items-start justify-between border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <Logo size={44} showWordmark={false} />
              <div>
                <p className="font-black text-lg">Freela Fretes Transportes LTDA</p>
                <p className="text-[11px] text-gray-600">Transportadora digital nacional — ETC (Lei 11.442/2007)</p>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="font-semibold">Fatura {numero}</p>
              <p className="text-gray-600">Emitida em {formatDateBR(inv.issued_at)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4 text-xs">
            <div>
              <p className="uppercase text-[10px] text-gray-500 font-semibold">Tomador</p>
              <p className="font-semibold text-sm">{shipper.company_name}</p>
              <p>CNPJ: {shipper.cnpj}</p>
              {shipper.address && <p>{shipper.address}</p>}
              {(shipper.city || shipper.uf) && <p>{shipper.city}/{shipper.uf}</p>}
            </div>
            <div>
              <p className="uppercase text-[10px] text-gray-500 font-semibold">Prestador</p>
              <p className="font-semibold text-sm">Freela Fretes Transportes LTDA</p>
              <p className="text-gray-600">A Freela Fretes transporta para você — subcontratação TAC nos termos da Lei 11.442/2007.</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <p className="uppercase text-[10px] text-gray-500 font-semibold">Serviço prestado</p>
            <p className="font-semibold text-sm mt-1">{f?.title ?? "Transporte rodoviário de cargas"}</p>
            <p className="text-xs text-gray-700">
              Origem: {f?.origin_city}/{f?.origin_uf} · Destino: {f?.destination_city}/{f?.destination_uf}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
              {f?.cargo_type && <p>Carga: {f.cargo_type}</p>}
              {f?.weight_kg && <p>Peso: {f.weight_kg} kg</p>}
              {f?.freight_mode && <p>Modalidade: {f.freight_mode === "LOTACAO" ? "Lotação" : "Fracionado"}</p>}
              {prov?.full_name && <p>Motorista subcontratado: {prov.full_name}</p>}
              {vehicle?.plate && <p>Veículo: {vehicle.plate} ({vehicle.vehicle_type})</p>}
              {job?.started_at && <p>Coleta: {formatDateBR(job.started_at)}</p>}
              {job?.ended_at && <p>Entrega: {formatDateBR(job.ended_at)}</p>}
            </div>
          </div>

          <div className="mt-5">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2">Valor total do transporte</td>
                  <td className="py-2 text-right font-semibold">{formatBRL(inv.amount_cents)}</td>
                </tr>
                <tr className="border-b border-gray-200 text-green-700">
                  <td className="py-2">ICMS destacado (crédito recuperável)</td>
                  <td className="py-2 text-right font-semibold">{formatBRL(inv.icms_cents)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold">Total a pagar</td>
                  <td className="py-2 text-right font-black text-lg">{formatBRL(inv.amount_cents)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 flex items-start gap-2">
              <TrendingUp className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-semibold">Crédito de ICMS para sua empresa: {formatBRL(inv.icms_cents)}</p>
                <p>Valor destacado nos CT-e emitidos pela Freela Fretes, aproveitável na sua apuração fiscal.</p>
              </div>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="mt-6">
              <p className="uppercase text-[10px] text-gray-500 font-semibold mb-2">Documentos fiscais da viagem</p>
              <ul className="text-[11px] space-y-1">
                {documents.map((doc: any) => (
                  <li key={doc.id} className="flex items-start justify-between border-b border-gray-100 py-1">
                    <span className="font-semibold">
                      {doc.doc_type}{doc.event_type === "COMPLEMENTAR" ? " (Complementar)" : ""}
                      {doc.doc_number ? ` · Nº ${doc.doc_number}` : ""}
                    </span>
                    <span className="font-mono text-gray-600 break-all ml-2 text-right">{doc.access_key ?? ""}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-gray-500">
                Documentos emitidos automaticamente pela Freela Fretes Transportes — você não precisa fazer nada.
              </p>
            </div>
          )}

          <div className="mt-6 pt-3 border-t border-gray-200 text-[10px] text-gray-500 text-center">
            Documento fiscal simulado para fins de demonstração da plataforma. Freela Fretes Transportes LTDA.
          </div>
        </div>
      </div>
    </div>
  );
}
