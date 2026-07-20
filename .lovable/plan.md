## Conversão para modelo Transportadora (ETC) — Blocos 0, 1 e 2

Antes de codar, quero confirmar o escopo desta rodada. Você disse "envie um bloco por mensagem", mas mandou 0, 1 e 2 juntos. Vou tratar os três como uma única entrega desta mensagem (são interdependentes: schema do 0 alimenta contratos do 1 e o publicar do 2). Se preferir fatiar, me avise.

---

### BLOCO 0 — Modelo comercial "frete cheio + repasse"

**Migração**
- `freights`: adicionar `freight_value_cents`, `driver_payout_cents`, `platform_margin_cents`, `nfe_key text`, `nfe_summary jsonb`. Backfill: `freight_value_cents = base_amount_in_cents`, `driver_payout_cents = round(base_amount * (1 - margem_default))`, `platform_margin_cents = diff`.
- Nova tabela `platform_settings` (linha única) com `carrier_margin_percent numeric` (default 0.20), editável pelo admin. GRANTs + RLS (só admin escreve, authenticated lê).
- Manter `base_amount_in_cents` como coluna legada (não remover) para não quebrar telas antigas — próximos blocos migram consumidores.

**Pricing (`src/lib/pricing.ts`)**
- Nova função `applyCarrierSplit(freteCents, margem)` que devolve `{ freightValueCents, driverPayoutCents, platformMarginCents }`. Motor puro atual permanece intacto.
- ANTT: `validateAnttFloor` passa a comparar contra `driverPayoutCents` (apenas Lotação).

**Server functions**
- `publishFreight` e `simulatePricing`: gravar/retornar os três valores; validar piso ANTT sobre o repasse.
- `simulatePaymentPaid` (escrow): continua liberando pelo `freight_value_cents`; o pagamento ao motorista usa `driver_payout_cents`.

**UI**
- Embarcador (publicar, meus fretes, detalhe do frete, pagamento, viagem): mostrar SÓ `freight_value_cents` com o rótulo "Valor do frete — tudo incluso". Remover linhas de "taxa de serviço".
- Motorista (buscar, propostas, detalhe do frete, viagem): mostrar SÓ `driver_payout_cents` como "Você recebe R$ X".
- Admin (freights, jobs, payments, dashboard): três colunas — Cobrado / Repasse / Margem. KPI de GMV separa receita bruta e margem.

---

### BLOCO 1 — Identidade da transportadora + contratos digitais

**Migração**
- `carrier_profile` (linha única, seed "FREELA FRETES TRANSPORTES LTDA — DADOS DE HOMOLOGAÇÃO"): `cnpj`, `razao_social`, `ie`, `rntrc`, `endereco jsonb`, `certificado_apelido`. RLS: leitura authenticated, escrita só admin.
- `contract_acceptances`: `user_id`, `contract_type` (CHECK `EMBARCADOR_TRANSPORTE` | `TAC_SUBCONTRATACAO`), `version`, `accepted_at`, `ip`. RLS: usuário lê/insere os próprios, admin lê todos.

**Server + UI**
- Nova rota admin `/admin/transportadora` (form simples editando `carrier_profile`).
- Server fn `acceptContract({ type, version })` capturando IP via `getRequestHeader('x-forwarded-for')`.
- Fluxo embarcador: no primeiro clique de "Publicar frete", se não houver aceite `EMBARCADOR_TRANSPORTE` da versão atual, abrir modal com scroll + checkbox + botão "Aceitar e continuar". Texto placeholder jurídico em constante `CONTRACT_SHIPPER_V1`.
- Fluxo motorista: aceite `TAC_SUBCONTRATACAO` como último passo do wizard de onboarding, ANTES de habilitar candidaturas. Bloqueio em `applyCandidacy` server-side (verifica aceite).
- Rodapé dos documentos (`TripDocumentsCard`) e da tela de pagamento passa a exibir `carrier_profile` (CNPJ, RNTRC, razão social).

---

### BLOCO 2 — Publicação em 3 passos

Refazer `src/routes/embarcador.publicar.tsx` como wizard de 3 passos:

1. **Carga**
   - Campo "Chave da NF-e" (44 dígitos, máscara `9999 9999 9999 …`, validação de módulo 11 do DV).
   - Toggle "Não tenho a chave — preencher manual".
   - Se chave válida → chama nova server fn `lookupNfeMock(key)` (Bloco 5, stub agora: retorna peso/volume/valor pseudoaleatórios determinísticos a partir da chave + salva em `nfe_summary`). Campos preenchidos e editáveis.
2. **Rota e janela**: origem, destino (com CEP/ViaCEP e coordenadas já existentes), data/hora de carregamento.
3. **Revisão**: `ClassifierCard` roda automaticamente com peso/volume/veículo sugerido; `SimulatorCard` server-side calcula e mostra **um único valor** com selo "Tudo incluso — documentação fiscal, seguro RCTR-C, CIOT e pagamento do motorista por nossa conta". Botão "Publicar frete" só habilita após aceite de contrato (Bloco 1).

Depois de publicar: tela de sucesso reforça "Seu trabalho acabou por aqui — avisaremos quando o motorista for atribuído e no dia do carregamento".

---

### Detalhes técnicos

- Zero breaking changes em candidaturas, check-in, `trip_events`, feedbacks e documentos fiscais existentes (blocos anteriores) — apenas leem novos campos.
- `lookupNfeMock`: server fn pura, sem dependência externa; determinística via hash da chave (`crypto.createHash('sha256')`). Contrato pronto para trocar por integração real depois.
- Validação de chave NF-e: 44 dígitos + DV módulo 11 (função `isValidNfeKey` em `src/lib/format.ts`).
- Textos jurídicos placeholder em `src/lib/contracts.ts` (constantes `CONTRACT_SHIPPER_V1`, `CONTRACT_DRIVER_V1`, cada uma com `version: "1.0.0"`).
- Migração única cobrindo Blocos 0 e 1 (aprovação sua obrigatória antes de rodar).

---

### Ordem de execução

1. Migração SQL (schema + seed `carrier_profile` + `platform_settings`).
2. Após aprovação: `pricing.ts`, server fns, `format.ts` (validação NF-e), `contracts.ts`.
3. UI: publicar (wizard novo), embarcador, motorista, admin (nova página `/admin/transportadora` + colunas cobrado/repasse/margem + KPI).
4. Modais de aceite de contrato.
5. Typecheck + verificação visual das telas principais.

Confirma que posso ir em frente com os três blocos juntos? Se quiser fatiar (ex.: só Bloco 0 agora), me avise.