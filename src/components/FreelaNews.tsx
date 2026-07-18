import { useState } from "react";
import { ChevronLeft, ChevronRight, Newspaper, Calendar } from "lucide-react";

type NewsItem = {
  id: string;
  category: string;
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  body: string[];
  gradient: string;
};

const NEWS: NewsItem[] = [
  {
    id: "lei-lotacao-fracionada",
    category: "Regulação",
    title: "Nova lei redefine regras para frete lotação e frete fracionado no Brasil",
    date: "18 de julho de 2026",
    readTime: "4 min de leitura",
    excerpt:
      "Publicada no Diário Oficial, a atualização normativa da ANTT amplia a proteção ao caminhoneiro autônomo e traz obrigações claras para embarcadores em cargas lotação e fracionadas.",
    body: [
      "A ANTT publicou nesta semana a atualização da resolução que rege o transporte rodoviário de cargas, com impacto direto nas operações de frete lotação (FTL) e frete fracionado (LTL). O texto reforça o piso mínimo por eixo, exige emissão obrigatória de CT-e e MDF-e antes do início da viagem e determina rastreabilidade em tempo real para cargas acima de 3 toneladas.",
      "Para o frete lotação, a norma consolida o CIOT como documento obrigatório e amplia a fiscalização sobre pagamentos abaixo do piso, com multas que podem chegar a 150% do valor não pago ao transportador.",
      "No frete fracionado, a novidade é a obrigatoriedade de averbação individual por volume acima de R$ 5.000 e a padronização de etiquetas com QR Code de rastreio. Embarcadores terão 90 dias para adequar seus processos.",
      "Na Freela Fretes, o motor de precificação já aplica automaticamente o piso ANTT por número de eixos e emite os documentos fiscais simulados a cada etapa da viagem — mantendo você e seus parceiros dentro da lei sem esforço.",
    ],
    gradient: "from-primary to-primary-hover",
  },
  {
    id: "frete-fracionado",
    category: "Operações",
    title: "Frete fracionado: como consolidar cargas menores e ganhar escala",
    date: "15 de julho de 2026",
    readTime: "3 min de leitura",
    excerpt:
      "Ideal para volumes de até 3 toneladas, o frete fracionado divide o espaço do caminhão entre vários embarcadores, reduzindo custos e aumentando a ocupação da frota.",
    body: [
      "O frete fracionado (LTL — Less Than Truckload) é a modalidade em que uma mesma viagem transporta cargas de diferentes clientes, cada um pagando apenas pelo espaço que ocupa. Para pequenas e médias empresas, é a forma mais econômica de despachar mercadorias sem esperar acumular volume para uma carga cheia.",
      "Os principais ganhos são três: custo por quilo até 40% menor, prazos mais previsíveis por já existirem rotas regulares e menor imobilização de estoque. O desafio está na logística de consolidação — cross-docking, roteirização e etiquetagem precisam ser impecáveis.",
      "Pela Freela Fretes, ao publicar um frete abaixo de 3 toneladas ou com ocupação inferior a 70% do veículo, o classificador automático marca a carga como FRACIONADO e sugere motoristas com rotas compatíveis já em andamento — otimizando a ocupação e reduzindo o valor final.",
    ],
    gradient: "from-accent to-accent-hover",
  },
  {
    id: "frete-retorno",
    category: "Motoristas",
    title: "Frete de retorno: como transformar viagem vazia em faturamento",
    date: "12 de julho de 2026",
    readTime: "3 min de leitura",
    excerpt:
      "Dados do setor mostram que caminhões rodam vazios em até 40% do tempo. O frete de retorno é a solução para o caminhoneiro autônomo aumentar a rentabilidade por viagem.",
    body: [
      "Chamado no mercado de \"frete de volta\", o frete de retorno é aquele contratado para preencher a carga do caminhão no trajeto de regresso à cidade-base. Historicamente, essas viagens eram feitas vazias — queimando diesel, pneus e tempo do motorista sem receita.",
      "Com a digitalização do setor, plataformas conectam em minutos motoristas prestes a descarregar com embarcadores que precisam de coleta na mesma região. O resultado é frete até 30% mais barato para quem contrata e faturamento adicional garantido para o motorista.",
      "Na Freela Fretes, o radar geográfico do motorista mostra automaticamente cargas compatíveis num raio configurável (padrão 300 km) da cidade de destino da viagem atual. Basta um toque para se candidatar e voltar para casa com o caminhão cheio.",
    ],
    gradient: "from-accent-hover to-primary",
  },
];

export function FreelaNews() {
  const [idx, setIdx] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const total = NEWS.length;
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);
  const current = NEWS[idx];
  const opened = NEWS.find((n) => n.id === openId);

  return (
    <section id="news" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Newspaper className="h-3.5 w-3.5" /> Freela News
          </span>
          <h2 className="mt-2 font-display text-3xl md:text-4xl text-foreground">
            Notícias do mundo da logística
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            O que está mudando no transporte rodoviário de cargas — direto da Freela.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            aria-label="Notícia anterior"
            className="h-10 w-10 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Próxima notícia"
            className="h-10 w-10 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {NEWS.map((n) => (
            <article key={n.id} className="w-full shrink-0 grid md:grid-cols-[1.1fr_1.4fr]">
              <div className={`bg-gradient-to-br ${n.gradient} p-8 md:p-10 flex flex-col justify-between min-h-[260px] text-primary-foreground`}>
                <div>
                  <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                    {n.category}
                  </span>
                  <p className="mt-6 font-display text-2xl md:text-3xl leading-tight">{n.title}</p>
                </div>
                <div className="mt-6 flex items-center gap-4 text-xs font-medium opacity-90">
                  <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {n.date}</span>
                  <span>·</span>
                  <span>{n.readTime}</span>
                </div>
              </div>
              <div className="p-8 md:p-10 flex flex-col">
                <p className="text-base text-foreground/80 leading-relaxed">{n.excerpt}</p>
                <button
                  onClick={() => setOpenId(n.id)}
                  className="mt-6 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover transition"
                >
                  Ler matéria completa
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 pb-5">
          {NEWS.map((n, i) => (
            <button
              key={n.id}
              onClick={() => setIdx(i)}
              aria-label={`Ir para notícia ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-primary" : "w-2 bg-border"}`}
            />
          ))}
        </div>
      </div>

      {/* screen-reader announcement of current slide */}
      <p className="sr-only" aria-live="polite">Notícia {idx + 1} de {total}: {current.title}</p>

      {/* Modal artigo completo */}
      {opened && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-3xl bg-card shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-br ${opened.gradient} p-8 text-primary-foreground rounded-t-3xl`}>
              <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                {opened.category}
              </span>
              <h3 className="mt-4 font-display text-2xl md:text-3xl leading-tight">{opened.title}</h3>
              <div className="mt-4 flex items-center gap-3 text-xs font-medium opacity-90">
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {opened.date}</span>
                <span>·</span>
                <span>{opened.readTime}</span>
              </div>
            </div>
            <div className="p-8 space-y-4">
              {opened.body.map((p, i) => (
                <p key={i} className="text-sm md:text-base text-foreground/85 leading-relaxed">{p}</p>
              ))}
              <button
                onClick={() => setOpenId(null)}
                className="mt-4 w-full py-3 rounded-full border border-border font-semibold text-sm hover:bg-secondary transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
