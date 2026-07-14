# Freela Fretes — Plano de Implementação

App mobile-first em pt-BR conectando embarcadores e motoristas, com Supabase (Lovable Cloud) para auth e dados.

## Etapa 1 — Fundação
- Ativar Lovable Cloud (Supabase) para auth + banco + RLS.
- Design system em `src/styles.css`: primária azul `#1E3A8A`, acento laranja `#F97316`, tokens em oklch, cards arredondados, tipografia legível mobile.
- Layout mobile-first com bottom navigation reutilizável.
- Utilitários: formatação R$ pt-BR (centavos), máscaras (CPF, CNPJ, placa Mercosul, CEP, telefone), validação de dígitos CPF/CNPJ, gerador de código 6 chars sem 0/O/1/I.

## Etapa 2 — Banco de dados (migração)
Tabelas exatamente com os campos especificados: `contractors`, `providers`, `vehicles`, `freights`, `candidacies`, `jobs`, `check_ins`, `check_outs`, `payments`, `feedbacks`.

Enums: `user_role` (contractor|provider), `validation_status`, `freight_status`, `candidacy_status`, `job_status`, `payment_status`, `feedback_role`.

RLS + GRANTS por tabela:
- `freights` OPEN legíveis por qualquer autenticado; view pública `freights_public` (sem `payment`, `base_amount_in_cents`, `agreed_amount_in_cents`) com SELECT `TO anon`.
- Embarcador CRUD só nos próprios fretes; leitura de candidacies apenas nos seus fretes.
- Motorista CRUD próprios veículos e candidacies; leitura de fretes OPEN.
- `jobs`/`check_ins`/`check_outs`/`payments` visíveis apenas às partes da viagem.
- `feedbacks` legível por partes da viagem; unicidade `(job_id, author_id, role)`.

Trigger `on_auth_user_created` cria linha em `contractors` ou `providers` conforme `raw_user_meta_data.role`.

Seed via migração: 2 embarcadores, 3 motoristas com veículos, 8 fretes em rotas reais (Sorriso/MT→Santos/SP etc.), valores R$ 2k–15k.

## Etapa 3 — Landing pública
- `/` header + hero + CTAs bifurcados.
- Vitrine pública lendo `freights_public` com filtros (origem UF/cidade, destino UF/cidade, tipo carga, tipo veículo). Valor exibido como `R$ ●●●●●` com cadeado + CTA de cadastro. Rodapé "+ de X fretes publicados".

## Etapa 4 — Auth e cadastro bifurcado
- `/auth` login + escolha "Sou Empresa" / "Sou Motorista".
- `/cadastro/motorista` wizard 4 passos (CPF→dados→CNH→veículo).
- `/cadastro/empresa` stepper 2 etapas (dados cadastrais → tela de análise), acesso liberado imediato com badge "Em validação".
- Redirecionamento pós-login por papel para `/app/...`.

## Etapa 5 — Área do embarcador (`_authenticated/contractor/...`)
- Bottom nav: Meus Fretes | Publicar | Viagens | Perfil.
- Publicar frete: wizard 4 passos com validações (data futura, entrega > coleta, valor > 0).
- Meus Fretes: lista com badges + contador de propostas.
- Detalhe do frete + propostas: badges de "Aceita seu valor" vs "Contraproposta" com diferença.
- Aceitar proposta (server fn transacional): fecha frete, WITHDRAWN nas demais, cria `job` SCHEDULED, cria `payment` PENDING, redireciona para pagamento.
- Pagamento PIX: QR placeholder + copia-e-cola + botão simulação "✓ Já paguei" (comentário sobre webhook real).
- Viagens: gerar códigos de coleta/entrega, avaliar motorista, cancelar antes da coleta.

## Etapa 6 — Área do motorista (`_authenticated/provider/...`)
- Bottom nav: Buscar Fretes | Minhas Propostas | Viagens | Perfil.
- Buscar Fretes: feed com valor + R$/km, filtros iguais à vitrine.
- Enviar proposta: modal com seleção de veículo compatível (validar tipo/carroceria), aceitar valor ou contraproposta, mensagem 500 chars, uma proposta por frete.
- Minhas Propostas: badges + retirar/desistir.
- Viagens: input código coleta → IN_PROGRESS; código entrega → COMPLETED; avaliar embarcador.

## Etapa 7 — Regras de negócio (server functions)
Server fns com `requireSupabaseAuth`:
- `publishFreight`, `submitCandidacy`, `withdrawCandidacy`
- `acceptCandidacy` (transacional)
- `simulatePaymentPaid`
- `generatePickupCode`, `generateDeliveryCode`
- `confirmPickup(code)`, `confirmDelivery(code)` (marca `payments.COMPLETED` liberação simbólica)
- `cancelFreight`, `driverWithdrawFromJob` (reabre frete)
- `submitFeedback`

Todas aplicam as regras: valor oculto público, unicidade proposta, códigos seguros, transições de status válidas.

## Detalhes técnicos
- TanStack Router file-based; rotas protegidas em `src/routes/_authenticated/`.
- TanStack Query para leitura (loader + `useSuspenseQuery`).
- `head()` por rota com título/descrição pt-BR.
- Valores em centavos internamente; helper `formatBRL(cents)` para UI.
- Sem edge functions; toda lógica em `createServerFn`.
- Componentes shadcn customizados via variants com tokens do design system (sem cores hardcoded).

Depois de aprovado, começo pela Etapa 1 (Cloud + design system) e sigo em sequência.