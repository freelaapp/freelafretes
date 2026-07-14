# Painel Administrativo — Freela Fretes

Área interna em `/admin`, desktop-first, com sidebar fixa colapsável. Mesma identidade visual (laranja Freela + acento escuro), porém densa: tabelas, filtros e KPIs. Login separado em `/admin/login`; nenhum acesso sem registro ativo em `admins`.

## 1. Banco de dados (migração)

Novas tabelas:
- **admins** — `id, user_id (uniq, FK auth.users), name, email, role ('ADMIN'|'SUPER_ADMIN'), is_active, created_at`.
- **admin_audit_logs** — `id, admin_id, action, entity_type, entity_id, details jsonb, created_at`.
- **admin_freight_cancellations** — `id, freight_id, admin_id, reason, refund_type ('FULL'|'PARTIAL'|'NONE'), refund_amount_cents, created_at`.

Alterações:
- `contractors`: já tem `validation_status`, `validation_notes`, `validated_at`, `is_active` (confirmar; adicionar o que faltar).
- `providers`: adicionar `is_banned boolean default false`, `ban_reason text` (mantém `is_active`).
- `jobs`: adicionar `disputed boolean default false`, `dispute_notes text`, `force_completed_by uuid`, `force_completed_reason text`.
- `payments`: adicionar status `RELEASED` (enum ou check) + `released_at timestamptz`, `refund_reason text`, `refunded_at`.
- `feedbacks`: adicionar `hidden boolean default false`, `hidden_reason text`.

Função `public.is_admin(_uid uuid)` SECURITY DEFINER (retorna true se existe admin ativo). Função `public.is_super_admin(_uid)`. RLS: admins ativos podem SELECT em todas as tabelas de dados e INSERT/UPDATE nas ações do painel. `admins` só SUPER_ADMIN gerencia; próprio admin lê seu registro. `admin_audit_logs` só admins leem/inserem. GRANT completos.

Seed: cria admin SUPER_ADMIN para `admin@freelafretes.com.br` (linkado por email ao user, ou inserido quando o user existir via trigger de conveniência descrita no rodapé da migração).

## 2. Server functions (`src/lib/admin.functions.ts`)

Todas com `.middleware([requireSupabaseAuth])` e checagem `is_admin(userId)` (ou super) antes de qualquer escrita; toda escrita grava em `admin_audit_logs`.

- `adminMe` — retorna registro do admin logado ou null.
- `adminDashboard` — KPIs + séries (fretes/dia 30d, viagens concluídas/canceladas por semana 12s) + ações pendentes.
- `listContractorsAdmin(filters, page)`, `getContractorAdmin(id)`, `setContractorActive`, `updateContractor`.
- `listValidationQueue(tab)`, `approveContractor(id)`, `rejectContractor(id, reason)`.
- `listProvidersAdmin(filters, page)`, `getProviderAdmin(id)`, `setProviderActive`, `banProvider(id, reason)` — retira propostas PENDING.
- `listFreightsAdmin(tab, filters, page)`, `getFreightAdmin(id)`, `adminCancelFreight(id, reason, refundType, refundAmount)`, `reopenFreight(id)`.
- `listJobsAdmin(tab, filters, page)`, `getJobAdmin(id)`, `forceCompleteJob(id, reason)`, `cancelJobAdmin(id, reason, refund…)`, `toggleJobDispute(id, notes)`.
- `listPaymentsAdmin(filters, page)`, `paymentsSummary()`, `releasePayment(id)`, `refundPayment(id, reason)`.
- `listFeedbacksAdmin(filters, page)`, `hideFeedback(id, reason)`, `unhideFeedback(id)`.
- `listAuditLogs(filters, page)`.
- `listAdmins()`, `createAdmin({email,name,role})`, `setAdminActive(id, active)` — SUPER_ADMIN only.

## 3. Rotas (todas em `src/routes/admin.*`)

Layout `admin.tsx` (pathless-style parent com Outlet) que:
- Busca `adminMe` via loader/query; se null → redirect `/admin/login`.
- Renderiza `<AdminSidebar/>` + área principal com `Outlet`. Sidebar mostra contador de fila de validação e item "Equipe" só para SUPER_ADMIN.

Arquivos:
- `admin.login.tsx` — email+senha, checa `adminMe` pós-login.
- `admin.index.tsx` — Dashboard (KPIs, gráficos com Recharts já disponível, tabela ações pendentes).
- `admin.validation.tsx` — Abas Pendentes/Aprovadas/Recusadas, modal aprovar/recusar.
- `admin.contractors.tsx` + `admin.contractors.$id.tsx` — lista e detalhe.
- `admin.providers.tsx` + `admin.providers.$id.tsx`.
- `admin.freights.tsx` + `admin.freights.$id.tsx`.
- `admin.jobs.tsx` + `admin.jobs.$id.tsx`.
- `admin.payments.tsx`.
- `admin.feedbacks.tsx`.
- `admin.audit.tsx`.
- `admin.team.tsx` (SUPER_ADMIN).

## 4. Componentes admin (`src/components/admin/`)

`AdminSidebar`, `AdminShell` (topbar com nome/logout), `KpiCard`, `DataTable` (paginação/ordenação genérica), `ConfirmModal` (com "digite X para confirmar" opcional), `StatusBadge`, `Timeline` (para viagem).

## 5. Ajustes no app do usuário

- Banner em `embarcador.*` quando `contractors.validation_status = REJECTED` mostrando `validation_notes` + botão "Corrigir e reenviar" (reabre form e volta para PENDING_VALIDATION).
- Selo "Empresa verificada ✓" quando APPROVED (já existe? adicionar onde aparecem dados da empresa: detalhe do frete e perfil).
- Filtro em queries de feedbacks públicos: `hidden = false`.
- Guard de motorista: se `providers.is_banned` (ou `is_active=false`), tela cheia "Conta suspensa — fale com o suporte" antes de renderizar rotas `/motorista/*`.

## 6. Regras técnicas

- Valores sempre em centavos; formatador `formatBRL` já existe.
- Paginação 20/página; ordenação server-side simples.
- Toda escrita passa por `ConfirmModal` e grava audit log.
- Estados vazios amigáveis em toda tabela.
- Recharts é usado nos gráficos do dashboard (biblioteca já presente).

## 7. Ordem de execução

1. Migração (tabelas, colunas, funções, RLS, seed).
2. Server functions admin.
3. Layout + sidebar + login + guard.
4. Dashboard.
5. Validação, Empresas, Motoristas, Fretes, Viagens, Pagamentos, Avaliações, Auditoria, Equipe.
6. Ajustes no app do usuário (banner rejeição, selo, filtro hidden, guard de banido).
7. Verificar build.
