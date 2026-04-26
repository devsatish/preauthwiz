Here's the regenerated BRIEF.md with v6 baked in throughout.

---

```markdown
# PreAuthWiz — Build Brief for Claude Code

## Context

I'm building a take-home for a Vercel Solutions Architect / Forward Deployed Engineer interview. The interview emphasizes:
- Small and deep beats large and murky
- Production thinking (security, observability, failure modes)
- Architectural judgment with explicit, defensible trade-offs
- Connecting technical choices to business outcomes
- Lightweight evaluation is REQUIRED by the rubric
- Must use Vercel AI SDK

The product is **PreAuthWiz** — an agentic prior authorization assistant for a fictional regional health system called **Meridian Health**. The user is **Jamie Alvarez, Intake Admin**. The product helps Jamie process prior auth requests faster and with higher first-pass approval rates by orchestrating five specialist subagents that verify eligibility, research payer policy, abstract chart evidence, score approval probability, and draft the medical justification letter.

The demo centerpiece is the **Auto-Pilot** flow on a single canonical case: **J0585 OnabotulinumtoxinA (Botox) for Chronic Migraine**, patient **Aaliyah Johnson**, payer **Aetna Open Access Select PPO**.

Deployment target: **Vercel** (Next.js + Neon Postgres with pgvector via Vercel Marketplace integration).

## CRITICAL: Read v6 docs before writing any code

The AI SDK v6 docs are pre-fetched into `docs/ai-sdk-v6/`. **Read them all before starting Phase 1**:
- `docs/ai-sdk-v6/agents-overview.md`
- `docs/ai-sdk-v6/building-agents.md`
- `docs/ai-sdk-v6/subagents.md`
- `docs/ai-sdk-v6/migration-v6.md`

Your training data likely leans toward AI SDK v5 patterns. v6 introduced first-class `Agent` abstractions, `ToolLoopAgent`, and subagent primitives that have meaningfully different patterns than v5's raw `generateText`/`streamText` calls. **Use v6 patterns throughout**. If you find yourself writing v5-style code (e.g., raw `generateText` calls in subagent definitions, manually managing tool execution loops), stop and re-read the docs.

When in doubt about an API surface, prefer the docs in `docs/ai-sdk-v6/` over training data. If something is unclear after reading, ask before guessing.

## Architecture (non-negotiable decisions)

These are decided. Do not relitigate them:

1. **Framework**: Next.js 15 App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui components.

2. **AI inference**: Vercel AI SDK **v6** (`ai@^6`, `@ai-sdk/anthropic`, `@ai-sdk/openai`). Claude Sonnet 4.5 as primary reasoning model, Claude Haiku 4.5 for cheap classification stages. OpenAI's `text-embedding-3-small` for embeddings. `ANTHROPIC_API_KEY` is already in environment.

3. **Subagent pattern — v6 `Agent` abstraction for LLM units, explicit TypeScript orchestration on top**: Each of the five subagents is a v6 `Agent` instance (defined in `lib/agents/<name>.ts`) with its own model, instructions, and tools. The orchestrator (`lib/agents/orchestrator.ts`) is deterministic TypeScript that calls each agent in the correct order, parallelizing where independent. **This is the key architectural defense**: v6's `Agent` abstraction handles LLM-shaped concerns (streaming, tool calls, structured outputs, type safety); the orchestrator handles workflow-shaped concerns (control flow, parallelization, observability emission). Free-running agent loops are wrong for a workflow with known stages — we want LLM reasoning *within* stages, not LLM-decided control flow *between* stages.

4. **Storage**: **Neon Postgres** with **pgvector** extension, accessed via **Drizzle ORM** and **`@neondatabase/serverless`** HTTP driver. One database for everything: synthetic data, embeddings, eval results, traces.

5. **Tool I/O**: Every tool input and output is validated by Zod schemas. No untyped tool calls anywhere. Every Agent definition uses Zod for structured output.

6. **Structured outputs**: v6 Agent's structured output support (via Zod schemas) for any stage producing structured data. Streaming text only for the final justification letter (so it streams to UI).

7. **No LLM math**: The approval-probability score is computed deterministically from criteria-evidence matches in TypeScript. The LLM only writes the *narrative explanation* of the score. Senior insight to defend in the interview.

8. **Human-in-the-loop**: The agent never submits anything. It drafts, presents, and waits for explicit human approval. Visible in UI as a "Send for clinician review" button that opens a confirmation modal — the modal is a stub, no real submission anywhere.

9. **Streaming to UI**: The Auto-Pilot run streams subagent events to the UI via Server-Sent Events. The user sees each subagent fire in real time with inputs, outputs, latency, model, and tokens.

10. **Driver choice**: `@neondatabase/serverless` (HTTP, not TCP). This is the correct driver for Vercel serverless functions — connection pooling is the wrong model for serverless and the HTTP driver eliminates cold-start pool warmup. Document this choice in code comments.

## Subagent specifications

Each subagent is a v6 `Agent` instance. The orchestrator runs them in this order: stages 1 and 2 in parallel after intake; stages 3-5 sequential.

### 1. `eligibilitySpecialist` (Haiku 4.5)
- **Model**: `claude-haiku-4-5` via `@ai-sdk/anthropic`
- **Tools**: `check_eligibility(patient_id, payer_id, cpt_code) -> EligibilityResult` (mocked)
- **Output schema** (Zod):
  ```ts
  {
    covered: boolean,
    plan_name: string,
    plan_type: "HMO" | "PPO" | "POS" | "EPO" | "Medicare Advantage" | "Medicaid",
    requires_prior_auth: boolean,
    network_status: "in_network" | "out_of_network" | "unknown",
    notes: string
  }
  ```
- **Instructions**: minimal — given eligibility tool result, produce structured assessment.

### 2. `policyResearcher` (Sonnet 4.5)
- **Model**: `claude-sonnet-4-5`
- **Tools**: `lookup_medical_policy(payer_id, cpt_code, query) -> PolicyChunk[]` — **real RAG against Neon pgvector** (Phase 3).
- **Output schema**:
  ```ts
  {
    policy_id: string,
    policy_name: string,
    payer: string,
    last_updated: string,
    criteria: Array<{
      id: string,                  // e.g. "C1", "C2"
      text: string,                // criterion as written in policy
      type: "required" | "alternative" | "exclusion",
      source_excerpt: string,      // verbatim quote, used for groundedness eval
      source_chunk_id: string,     // pgvector row id for traceability
      source_page: number
    }>,
    excluded_indications: string[]
  }
  ```
- **Instructions**: extract medical necessity criteria from retrieved policy text. Every criterion must include verbatim source excerpt for groundedness verification.

### 3. `chartAbstractor` (Sonnet 4.5)
- **Model**: `claude-sonnet-4-5`
- **Tools**: `search_patient_chart(patient_id, query) -> ChartEvidence[]` — queries SMART Health IT public FHIR sandbox (Phase 3) with curated synthetic Bundle for the canonical case.
- **Output schema**:
  ```ts
  {
    evidence_by_criterion: Array<{
      criterion_id: string,
      met: "yes" | "no" | "partial" | "unknown",
      evidence: Array<{
        source_type: "Observation" | "Condition" | "MedicationStatement" | "Procedure" | "DiagnosticReport" | "ClinicalNote",
        source_id: string,
        date: string,
        excerpt: string,
        relevance_score: number    // 0-1
      }>,
      reasoning: string
    }>
  }
  ```
- **Instructions**: for each criterion, search chart for relevant evidence and assess whether met. Cite exact source IDs and verbatim excerpts. Do not infer evidence not present in chart.

### 4. `riskScorer` (deterministic + Haiku 4.5 narrative)
- **Model**: `claude-haiku-4-5` for narrative only
- **No tools**. Mostly deterministic.
- **Logic** (deterministic TypeScript, computed BEFORE invoking the Agent):
  - Score: `met_required / total_required` weighted, with `partial` = 0.5, `unknown` = 0.
  - Exclusion check: any matched exclusion → score 0, verdict `recommend_deny`.
  - Verdict mapping: `≥0.9 → auto_approve_eligible`, `0.6-0.9 → escalate_for_review`, `<0.6 → recommend_deny`.
- **LLM role**: Haiku Agent receives the deterministic score + verdict + evidence summary, writes 1-2 sentence narrative explanation. The score itself is deterministic — the Agent only writes prose.
- **Output schema**:
  ```ts
  {
    score: number,                  // 0-1, deterministic (passed in, not generated)
    verdict: "auto_approve_eligible" | "escalate_for_review" | "recommend_deny",
    confidence: number,
    narrative: string,              // LLM-generated
    blocking_issues: string[]
  }
  ```

### 5. `justificationDrafter` (Sonnet 4.5)
- **Model**: `claude-sonnet-4-5`
- **No tools**. Pure generation.
- **Streaming**: streams output text to UI as it generates.
- **Constraint**: every claim must cite specific criterion ID + evidence source ID inline as `[C2 / chart:obs-12]` so UI can render hover tooltips.
- **Output**: streamed markdown letter with inline citations.

## Project structure

```
preauthwiz/
├── BRIEF.md
├── README.md                              # generated last
├── docs/
│   └── ai-sdk-v6/                         # PRE-FETCHED v6 docs — read first
├── app/
│   ├── layout.tsx
│   ├── page.tsx                           # dashboard
│   ├── auth-queue/page.tsx
│   ├── autopilot/page.tsx                 # demo centerpiece
│   ├── autopilot/trace/[runId]/page.tsx
│   ├── assistant/page.tsx
│   ├── evals/page.tsx
│   ├── patients/page.tsx
│   ├── providers/page.tsx
│   └── api/
│       ├── autopilot/route.ts             # SSE stream
│       ├── assistant/route.ts             # AI SDK chat endpoint
│       └── evals/run/route.ts
├── lib/
│   ├── agents/
│   │   ├── orchestrator.ts                # deterministic TS — calls Agents
│   │   ├── eligibility-specialist.ts      # v6 Agent
│   │   ├── policy-researcher.ts           # v6 Agent
│   │   ├── chart-abstractor.ts            # v6 Agent
│   │   ├── risk-scorer.ts                 # v6 Agent (narrative only)
│   │   └── justification-drafter.ts       # v6 Agent (streaming)
│   ├── tools/
│   │   ├── check-eligibility.ts
│   │   ├── lookup-medical-policy.ts        # Neon pgvector RAG (Phase 3)
│   │   ├── search-patient-chart.ts         # FHIR sandbox (Phase 3)
│   │   └── index.ts
│   ├── schemas/
│   │   ├── patient.ts
│   │   ├── policy.ts
│   │   ├── eligibility.ts
│   │   ├── evidence.ts
│   │   ├── verdict.ts
│   │   └── trace.ts
│   ├── db/
│   │   ├── client.ts                       # Neon HTTP client + Drizzle
│   │   ├── schema.ts                       # Drizzle schema with vector column
│   │   └── migrations/                     # drizzle-kit generated
│   ├── data/
│   │   ├── patients.ts                     # synthetic roster (seeded into DB)
│   │   ├── prior-auths.ts
│   │   ├── providers.ts
│   │   ├── policies/                       # downloaded HTML + parsed text (Phase 3)
│   │   │   ├── aetna-cpb-0113-botulinum-toxin.html
│   │   │   ├── aetna-cpb-0113-botulinum-toxin.txt
│   │   │   ├── aetna-cpb-0462-headaches-nonsurgical.html
│   │   │   └── aetna-cpb-0462-headaches-nonsurgical.txt
│   │   └── charts/
│   │       └── aaliyah-johnson.json        # canonical FHIR Bundle
│   ├── eval/
│   │   ├── cases.ts                        # 18-case golden set
│   │   ├── runner.ts
│   │   ├── checks.ts
│   │   └── report.ts
│   ├── observability/
│   │   ├── trace.ts                        # AsyncLocalStorage trace context
│   │   └── logger.ts
│   └── ai/
│       ├── models.ts                       # model client config
│       ├── pricing.ts                      # per-million-token rates
│       └── prompts/                        # Agent instruction templates
├── components/
│   ├── ui/                                 # shadcn primitives
│   ├── dashboard/
│   ├── autopilot/
│   │   ├── topology.tsx
│   │   ├── live-activity.tsx
│   │   ├── final-report.tsx
│   │   └── trace-view.tsx
│   ├── assistant/
│   └── evals/
├── scripts/
│   ├── ingest-policies.ts                  # HTML → chunks → embeddings → Neon
│   ├── seed-data.ts                        # synthetic patients, auths, providers
│   └── eval.ts                             # `pnpm eval` CLI
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── .env.local.example
```

## Phase plan — execute in order, stop and confirm between phases

### Phase 0 — Read v6 docs

Before any code:
1. Read every file in `docs/ai-sdk-v6/`.
2. Confirm understanding of the v6 `Agent` abstraction, how `Agent` instances are defined with model + instructions + tools, how subagents are invoked, how structured outputs work via Zod schemas, and how streaming text works in v6.
3. If after reading anything is unclear about how to define an Agent or invoke it from another TypeScript function, ask before proceeding.

**Stop. Confirm**: state in 3-5 sentences your understanding of how v6 Agents differ from v5's raw `generateText` calls and how you'll structure the five subagents.

### Phase 1 — Project skeleton, Neon setup, synthetic data

**Setup**:
- Initialize Next.js 15 + TypeScript strict + Tailwind + shadcn (components: button, card, badge, dialog, sheet, tabs, table, separator, skeleton, scroll-area, tooltip, hover-card).
- Install dependencies:
  ```
  pnpm add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/react zod
  pnpm add @neondatabase/serverless drizzle-orm
  pnpm add cheerio
  pnpm add -D drizzle-kit dotenv tsx @types/node
  ```
- Verify `pnpm list ai` shows `6.x.x`. If it shows 5.x or 7.x beta, fix before proceeding.
- Create `.env.local.example` with placeholders for `DATABASE_URL`, `OPENAI_API_KEY`. Note `ANTHROPIC_API_KEY` is already in environment.
- Set up Drizzle config (`drizzle.config.ts`) using `DATABASE_URL`.
- Set up Neon client (`lib/db/client.ts`) using `@neondatabase/serverless` with Drizzle's `neon-http` driver. Code comment explaining HTTP-driver choice.

**Database schema** (`lib/db/schema.ts`):
- `patients` — id, mrn, first/last, dob, sex, plan_id, dx_codes (text array), phone
- `providers` — id, npi, name, specialty, organization
- `prior_auths` — id, patient_id, provider_id, cpt_code, dx_codes, status, payer_id, plan_name, created_at
- `policies` — id, payer_id, name, cpb_number, last_updated, source_url
- `policy_chunks` — id (uuid), policy_id (fk), page_number/section_number, text, embedding (`vector(1536)`), metadata (jsonb), cpt_codes (text array for filtering), created_at
- `auth_runs` — id, prior_auth_id, status, verdict, confidence, started_at, completed_at, total_tokens, total_cost_cents
- `auth_run_events` — id, run_id (fk), subagent (text), status (text), input (jsonb), output (jsonb), model (text), latency_ms (int), input_tokens (int), output_tokens (int), timestamp
- `eval_runs` — id, started_at, completed_at, summary (jsonb)
- `eval_results` — id, eval_run_id (fk), case_id (text), expected_verdict, actual_verdict, correct (boolean), groundedness_score (numeric), draft_score (numeric), calibration_bucket (text), details (jsonb)

**Migrations**:
- Run `pnpm drizzle-kit generate` to generate SQL.
- Add a manual SQL migration `lib/db/migrations/0000_enable_pgvector.sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
  Run this manually against the Neon DB before applying generated migrations.
- After tables are created, add HNSW index manually:
  ```sql
  CREATE INDEX IF NOT EXISTS policy_chunks_embedding_idx
    ON policy_chunks USING hnsw (embedding vector_cosine_ops);
  ```
- Run `pnpm drizzle-kit push` to apply schema.

**Synthetic data** (`scripts/seed-data.ts`):

8 patients matching existing UI:
- Margaret Thompson (68F, MRN-0458821, DOB Mar 13 1958, Aetna Open Access Select PPO, [M17.11, E11.9, I10], 2 auths, (512) 555-0142)
- David Nguyen (53M, MRN-0492173, DOB Nov 7 1972, UHC Choice Plus, [I25.10, E78.5], 1 auth, (512) 555-0198)
- **Aaliyah Johnson (36F, MRN-0517904, DOB Jun 26 1989, Aetna Open Access Select PPO, [G43.709, F41.1], 3 auths, (512) 555-0167)** — canonical demo patient
- Robert Fischer (60M, MRN-0523891, DOB Sep 1 1965, Cigna Open Access Plus, [C61, N40.1], 1 auth, (512) 555-0178)
- Priya Sharma (31F, MRN-0538162, DOB Dec 18 1994, Humana ChoiceCare PPO, [K50.00, D50.9], 1 auth, (512) 555-0123)
- George Washington (75M, MRN-0541287, DOB Feb 21 1951, Medicare Part B, [I48.91, I50.22], 2 auths, (512) 555-0184)
- Sophia Martinez (44F, MRN-0549834, DOB Apr 29 1981, Anthem PPO Standard, [M54.16, M51.26], 1 auth, (512) 555-0191)
- Liam O'Brien (13M, MRN-0556291, DOB Aug 14 2012, BCBS Blue Essentials, [J45.40], 1 auth, (512) 555-0156)

6 providers matching existing UI:
- Dr. Elena Ramirez, MD — Orthopedic Surgery, Meridian Orthopedic Associates, NPI 1548293761
- Dr. Marcus Chen, MD — Cardiology, Meridian Heart Center, NPI 1927384561
- Dr. Aisha Patel, MD — Neurology, Meridian Neuroscience Institute, NPI 1364728193
- Dr. James Okonkwo, MD — Oncology, Meridian Cancer Center, NPI 1836492758
- Dr. Sarah Klein, DO — Pain Management, Meridian Pain & Spine, NPI 1729384756
- Dr. Raj Gupta, MD — Gastroenterology, Meridian GI Associates, NPI 1648293751

12 active prior auths across these patients with varied statuses (`pending`, `needs_info`, `approved`, `denied`, `p2p_required`).

**Canonical demo case**: Aaliyah Johnson, J0585 OnabotulinumtoxinA (Botox) for Chronic Migraine, ordered by Dr. Aisha Patel, Aetna Open Access Select PPO. Set up so Phase 3's RAG + chart pipeline produces an `auto_approve_eligible` verdict.

Run with `pnpm tsx scripts/seed-data.ts`. Idempotent — clears tables before reseeding.

**Routes** (stub for now, except patients and providers):
- `/` dashboard — placeholder
- `/auth-queue` — placeholder
- `/autopilot` — placeholder
- `/assistant` — placeholder
- `/evals` — placeholder
- `/patients` — fully implemented from DB, matching screenshot UI (avatars with initials, plan name, dx code chips, auth count, phone)
- `/providers` — fully implemented from DB, matching screenshot UI (avatars, specialty, organization, NPI, auth count)

**Stop. Confirm**:
- `pnpm dev` runs cleanly
- All routes load without error
- `/patients` and `/providers` render real data from Neon matching the screenshot layouts
- pgvector extension is enabled
- HNSW index exists on `policy_chunks.embedding`

### Phase 2 — Subagents and orchestrator with mocked tools

**Subagent definitions** (v6 `Agent` instances):

Define each subagent in `lib/agents/<name>.ts` as a v6 `Agent` instance per the v6 docs. Each file exports a configured Agent ready to be invoked.

Rules:
- Each Agent has its own model, instructions, and Zod-typed structured output schema.
- `policyResearcher`, `chartAbstractor` use tools (defined in `lib/tools/` and imported into the Agent).
- `riskScorer` receives deterministically-computed score as input context, generates only narrative.
- `justificationDrafter` uses the streaming variant — emits text chunks the orchestrator pipes to SSE.
- Instructions live in `lib/ai/prompts/<name>.ts` as exported template functions, not inline strings.

**Mocked tools** (`lib/tools/`):
- `check_eligibility` — returns realistic plan info for the canonical case and reasonable defaults for others.
- `lookup_medical_policy` — Phase 2 returns realistic Aetna-style criteria as if from Phase 3's RAG. Phase 3 replaces with real pgvector lookups.
- `search_patient_chart` — Phase 2 returns realistic FHIR Bundle resources for Aaliyah Johnson. Phase 3 wires real FHIR.

**Orchestrator** (`lib/agents/orchestrator.ts`):

```typescript
// Pseudocode for shape — actual API per v6 docs
async function runOrchestrator(priorAuthId: string, onEvent: (e: TraceEvent) => void) {
  const intake = await loadPriorAuth(priorAuthId)
  
  // Stages 1 & 2 in parallel
  const [eligibility, policy] = await Promise.all([
    runAgent(eligibilitySpecialist, intake, onEvent),
    runAgent(policyResearcher, intake, onEvent),
  ])
  
  // Stage 3 depends on policy criteria
  const evidence = await runAgent(chartAbstractor, { intake, criteria: policy.criteria }, onEvent)
  
  // Stage 4 — deterministic scoring + Agent narrative
  const deterministicScore = computeScore(policy.criteria, evidence.evidence_by_criterion)
  const scored = await runAgent(riskScorer, { ...deterministicScore, policy, evidence }, onEvent)
  
  // Stage 5 — streaming letter
  const letter = await runStreamingAgent(justificationDrafter, { intake, eligibility, policy, evidence, scored }, onEvent)
  
  return { eligibility, policy, evidence, scored, letter }
}
```

The orchestrator emits structured events at each subagent boundary: `{ type: "agent_started" | "agent_completed" | "tool_called" | "tool_result" | "text_chunk", subagent, model, input?, output?, latency_ms?, tokens?, timestamp }`.

**API route** (`app/api/autopilot/route.ts`):
- POST endpoint accepts `{ priorAuthId }`.
- Returns Server-Sent Events stream emitting orchestrator events as JSON.
- Configures `maxDuration` to 60 seconds (or Pro tier limit) to handle multi-stage pipeline.
- Persists `auth_runs` and `auth_run_events` rows during execution.

**Auto-Pilot UI** (`/autopilot`):

Match the screenshot layout:
- Header: tags ("Agentic", "Claude Agent SDK" → change to "AI SDK v6", "MCP tools" → change to "Agent + Tool primitives"), title, description.
- Prior Auth selector dropdown (default to canonical Aaliyah Johnson Botox case).
- "Run Auto-Pilot" button.
- **Topology view**: orchestrator card centered top, downward arrow, 5 subagent cards in a row below. Each subagent card shows name, role description, tool name with icon, call count. Cards animate state as events arrive (idle → running → complete with checkmark).
- **Live activity panel**: scrolling event log. Each entry shows subagent name, status, model, latency, tokens. Click to expand input/output JSON.
- **Final report card** (right side or below activity): streams justification letter as `streamText` produces it. Inline citations like `[C2 / chart:obs-12]` rendered as hover-tooltipped pills (HoverCard from shadcn) showing the exact policy excerpt and chart evidence on hover.
- **HIL footer**: "Send for clinician review" button. Opens dialog: "This will route to Dr. Patel for final review and submission. PreAuthWiz never submits autonomously." Confirm button is a stub.
- Empty state matches screenshot ("Final report will appear here").

**Dashboard** (`/`):
- Header: "Good afternoon, Jamie" with subtitle "Meridian Health · [today's date] · N auths need your attention today" (auths count from DB).
- "AI caught N issues this morning" callout (static N=4 for now; wired to real eval output in Phase 4).
- Auto-Pilot teaser card.
- 4 KPI cards (Active auths, First-pass approval %, Median time to decision, AI-assisted submissions %).
- Submission volume area chart (recharts, last 7 days).
- Status mix donut chart.

**Stop. Confirm**:
- Auto-Pilot run on Botox case streams cleanly end-to-end
- All 5 subagent cards in topology animate visibly as events arrive
- Final letter streams in with inline citations rendering as hover pills
- HIL dialog appears when clicking "Send for clinician review" — no real submission
- Each agent invocation persists rows to `auth_runs` and `auth_run_events`

### Phase 3 — Real RAG via Neon pgvector + real FHIR

**Policy ingestion** (`scripts/ingest-policies.ts`):

Two Aetna policies to ingest:

1. **Aetna CPB 0113 — Botulinum Toxin** (covers J0585 for chronic migraine — primary policy for canonical demo)
   - Source URL: `https://www.aetna.com/cpb/medical/data/100_199/0113.html`
   - HTML, not PDF. Fetch with `fetch()`, parse with `cheerio`, extract policy body div, strip nav/footer/ads.
   - Save raw HTML to `lib/data/policies/aetna-cpb-0113-botulinum-toxin.html` and cleaned text to `.txt`.
   - Persist `source_url`, `payer_id="AETNA"`, `cpb_number="0113"`, `name="Botulinum Toxin"`, `last_updated` (parse from page) to `policies` table.

2. **Aetna CPB 0462 — Headaches: Nonsurgical Management** (companion policy — covers CGRP antibodies, nerve blocks, related migraine therapies; useful for cross-policy eval cases)
   - Source URL: `https://www.aetna.com/cpb/medical/data/400_499/0462.html`
   - Same approach.

**Ingestion pipeline**:
- Fetch HTML, extract policy body with `cheerio`.
- Chunk strategy: chunk by `<h2>`/`<h3>` section heading where possible; if a section exceeds ~1000 tokens, sub-chunk with ~800-token windows and ~100-token overlap. Use `tiktoken` for accurate token counts.
- For each chunk, embed with `text-embedding-3-small` via AI SDK's `embed()` function.
- Insert into `policy_chunks` with metadata: `policy_id`, `section_number`, `cpt_codes` array (`["J0585", "J0586", "J0587", "J0588"]` for CPB 0113; CGRP-relevant codes for CPB 0462), `text`, `embedding`.
- Run with `pnpm tsx scripts/ingest-policies.ts`. Idempotent — clears existing chunks for each policy before reinserting.

After ingestion, sanity-check by querying for "chronic migraine criteria" and confirming retrieved chunks contain expected language about ≥15 headache days, prior preventive medication trials, dosing limits.

**`lookup_medical_policy` tool** (`lib/tools/lookup-medical-policy.ts`):
- Inputs: `payer_id`, `cpt_code`, `query`.
- Embeds query with `text-embedding-3-small`.
- Drizzle query against `policy_chunks` filtered by `payer_id` and array-contains `cpt_code`, ordered by cosine distance using pgvector's `<=>` operator, limit 8.
- Returns chunks with `id`, `text`, `section_number`, `policy_id`, `similarity` (computed as `1 - cosine_distance`).
- Code comment documenting `@neondatabase/serverless` HTTP driver choice.

**`search_patient_chart` tool** (`lib/tools/search-patient-chart.ts`):

For canonical Aaliyah Johnson case: curated synthetic FHIR Bundle committed as `lib/data/charts/aaliyah-johnson.json` containing:
- `Condition` G43.709 (Migraine, unspecified, not intractable, without status migrainosus) — diagnosed 18 months ago by Dr. Patel
- 3 `Observation` resources: monthly headache diary entries showing 18, 22, 19 headache days/month over last 3 months, with mean duration ≥4 hours
- 2 `MedicationStatement` resources: topiramate 100mg daily ×4 months (insufficient response, headache days reduced from 22 to 19), propranolol 80mg ×6 weeks (discontinued — bradycardia)
- `DiagnosticReport`: neurology consult note from Dr. Patel confirming chronic migraine diagnosis, recommending Botox per PREEMPT protocol
- `Procedure`: prior CGRP antibody trial (erenumab) ×3 months, insufficient response

For other patients: query SMART Health IT public sandbox at `https://launch.smarthealthit.org/v/r4/fhir`. Pick one synthetic patient and map. If sandbox is slow or down, fall back gracefully to "no chart data available" — do not crash.

Tool returns `ChartEvidence[]` mapped from FHIR resources with `source_type`, `source_id` (FHIR resource id), `date`, `excerpt` (verbatim FHIR field value), `relevance_score`.

**Update Agents to use real tools**:
- `policyResearcher` Agent now invokes real `lookup_medical_policy` tool. Every criterion's `source_excerpt` must be a verbatim substring of a retrieved chunk's `text`. Include `source_chunk_id` (the pgvector row id) on each criterion for traceability.
- `chartAbstractor` Agent uses real FHIR data. Every evidence `source_id` must match a real FHIR resource id from the Bundle.

**Stop. Confirm**:
- Both Aetna policies ingested into Neon. Run `SELECT count(*) FROM policy_chunks GROUP BY policy_id;` to confirm chunks > 0 for both.
- `lookup_medical_policy("AETNA", "J0585", "chronic migraine criteria for Botox approval")` returns relevant chunks with similarity scores.
- Auto-Pilot run on Botox case now uses real policy text and real chart data.
- Citations in final letter trace to real `policy_chunks.id` and real FHIR resource IDs.
- Hover tooltips on citations show the actual retrieved text from Neon and actual FHIR field values.

### Phase 4 — Eval harness

**Test set** (`lib/eval/cases.ts`): 18 cases stratified as:

5 clean approvals — chronic migraine cases meeting all criteria, plus a few from CPB 0462 (CGRP-related) meeting criteria.

5 clean denials:
- Episodic migraine (<15 days/month) — fails fundamental criterion
- No prior preventive medication trial
- Wrong indication (e.g., tension headache without chronic migraine)
- Exceeds dosing limit (>400 units in 84 days)
- Provider specialty mismatch (no neurologist/headache specialist involvement)

5 ambiguous middle cases:
- 14-15 headache days/month (borderline numeric)
- Only one prior preventive failed (some payers want two)
- Recent diagnosis (<3 months chronic migraine documented)
- Partial response to prior preventive (better than baseline but still ≥15 days)
- Dosing slightly over standard 155 units but within 84-day cumulative limit

3 adversarial edges:
- Missing chart data: chart silent on headache frequency
- Stale evidence: criteria met 3 years ago, no recent documentation
- Contradictory evidence: chart note says "responding well to topiramate" but headache log shows no improvement

Each case has:
- Synthetic patient + chart (full FHIR Bundle JSON)
- Payer + plan + CPT/dx codes
- Golden disposition label: `auto_approve_eligible | escalate_for_review | recommend_deny`
- Plain-English rationale (for human review of the test set)
- For groundedness: `expected_criteria_cited: string[]`, `expected_evidence_cited: string[]`

**Runner** (`lib/eval/runner.ts`):
- Iterates test cases, runs orchestrator for each, captures full output + trace.
- Persists results to `eval_runs` and `eval_results` tables.

**Checks** (`lib/eval/checks.ts`):

1. **Disposition correctness**: `actual_verdict` vs `expected_verdict`. Confusion matrix. **Headline metric**: count of `expected=recommend_deny, actual=auto_approve_eligible` cases — must be 0. Display prominently.

2. **Groundedness** (programmatic, not LLM-judged):
   - Parse all citations of form `[C\d+ / <source_type>:<source_id>]` from the justification letter.
   - For each citation, verify:
     - The cited criterion ID exists in policy research output.
     - The cited evidence source_id exists in chart abstraction output.
     - If a quoted excerpt is included, it is a verbatim substring of the source.
   - Output: `groundedness_rate` (citations passing all checks / total citations), and binary `had_hallucination` per case.

3. **Draft quality** (LLM-as-judge using Claude Haiku 4.5 — different model than Sonnet generator). Structured 5-dimension rubric scored 1-5:
   - Cites all relevant policy criteria
   - Maps each criterion to specific chart evidence
   - Uses appropriate clinical/medical language
   - Structurally complete (intro, criteria-by-criteria analysis, conclusion)
   - Free of unsupported claims

4. **Calibration**: bucket by reported confidence (>0.9, 0.7-0.9, <0.7), measure verdict accuracy per bucket. Output as table.

**CLI runner** (`scripts/eval.ts`): `pnpm eval` runs all 18 cases, prints formatted report:

```
PreAuthWiz Eval Suite — 18 cases

Disposition correctness:
  ✓ 17/18 verdicts correct
  ✓ 0 false approvals  ← headline metric
  Confusion matrix:
                    actual: approve  escalate  deny
    expected: approve     5        0         0
    expected: escalate    1        4         0
    expected: deny        0        0         5

Groundedness:
  ✓ 142/142 citations grounded
  ✓ 0 hallucinations detected across all cases

Draft quality (Haiku-judged):
  Avg score: 4.3/5 across 12 letter-drafting cases
  Per-dimension: criteria-citing 4.6, evidence-mapping 4.4,
                 language 4.2, structure 4.5, no-unsupported 4.0

Calibration:
  >0.9 confidence: 8 cases, 8/8 correct (100%)
  0.7-0.9:        7 cases, 6/7 correct (86%)
  <0.7:           3 cases, all correctly escalated

Runtime: 47s | Tokens: 142,300 | Est cost: $0.84
```

**`/evals` page**: shows last run summary cards (4 dimensions), table of per-case results (clickable to trace view), "Run evals" button that triggers `/api/evals/run` and updates live.

**Wire dashboard hero metric**: "AI caught N issues this morning" reads from latest `eval_runs.summary.flagged_issues_count`. The number on the dashboard is real eval output, not static copy.

**Stop. Confirm**:
- `pnpm eval` runs locally and produces formatted report
- `/evals` page renders results
- "Run evals" button triggers a live run that updates the page
- Dashboard "AI caught N issues" reflects real eval data from Neon

### Phase 5 — Observability

**Trace context** (`lib/observability/trace.ts`):
- `AsyncLocalStorage`-based trace context with `traceId`, `spanId`, hierarchical spans.
- Wraps every agent invocation and tool call.
- Records to `auth_run_events`: subagent, model, latency, input/output tokens, cost, tool calls, errors.

**Pricing** (`lib/ai/pricing.ts`):
- Per-million-token rates for Sonnet 4.5 and Haiku 4.5 (input and output separately).
- **Verify current Anthropic pricing before hardcoding** — fetch from the Anthropic pricing page if needed.
- Function `computeCost(model, inputTokens, outputTokens) -> cents` used by trace recorder.

**Trace view** (`/autopilot/trace/[runId]/page.tsx`):
- Timeline UI showing every subagent event chronologically.
- Each event row: subagent badge, model badge, status icon, latency, tokens, expandable input/output JSON.
- Tool calls nested under their parent agent invocation.
- Summary footer: total latency, total tokens, total cost.
- Make it visually polished — this view is a senior-engineering signal in the demo.

**Run summary on final report**:
- After Auto-Pilot completes, footer of final report card shows: `"Run used Sonnet 4.5 for 3 stages, Haiku 4.5 for 2, $0.04 total, 14.2s end-to-end"` linked to full trace view.

**v6 DevTools integration**:
- v6 has expanded telemetry support and a DevTools integration. Check `docs/ai-sdk-v6/` for current telemetry/devtools APIs.
- If v6 DevTools provides telemetry in a useful shape, integrate it as a complement to (not replacement for) the AsyncLocalStorage trace context — DevTools for dev-time debugging, our trace context for production-shaped persistence.
- If integration is non-trivial in current AI SDK, defer and note in README's "what's next."

**AI Gateway** (only if straightforward — verify in `docs/ai-sdk-v6/`):
- v6's `Agent` abstraction routes through the configured provider. Adding AI Gateway is a provider-level config, not per-Agent.
- If AI Gateway integration is a one-config-line change, do it and add a feature-flag toggle.
- If it's a larger lift, skip for the demo and note in "what's next."
- The model-routing-per-subagent story (Sonnet for reasoning, Haiku for classification) is more important for the interview than the gateway specifically. The gateway adds: failover, observability, unified billing.

**Stop. Confirm**:
- Trace view renders for any Auto-Pilot run with full per-subagent detail
- Cost and latency visible on final report
- Pricing computed from real per-million-token rates

### Phase 6 — AI Assistant and polish

**AI Assistant** (`/assistant`):
- Standard chat using AI SDK's `useChat` (per v6 docs — verify exact import).
- Define a v6 `Agent` for the assistant with tools: `get_active_auths` (queries `prior_auths` for current user), `lookup_medical_policy` (RAG over ingested policies).
- Three pre-loaded suggested prompt chips matching the screenshot intent (update content to match what's actually ingested):
  - "Which of my active auths are most likely to be denied?"
  - "Summarize Aetna's Botox-for-chronic-migraine criteria."
  - "Draft an appeal for the most recent denied auth."
  - "What's typical turnaround for chronic migraine prior auths?"
- System prompt scopes the assistant to: querying active auths, summarizing payer policies (RAG), drafting appeals, answering operational questions about the queue.
- Streams responses with citations rendered as hover pills (same component as in Auto-Pilot final report).

**Polish**:
- Loading skeletons on every async surface.
- Error boundaries around streaming components.
- "Claude Sonnet 4.5 online" header indicator: green if last successful API call <60s ago, yellow if 1-5min, red if >5min or error. Backed by a simple in-memory counter updated by the API routes.
- Empty states for every list (no patients, no auths, no eval results yet).
- Keyboard shortcut (⌘K) opens the search bar (placeholder — does nothing yet, but exists per screenshot).

**README.md**:

Sections:
1. **Problem statement** (one paragraph): prior auth costs the US healthcare system $30B+/year, average auth takes 12 days and 5 phone calls, costs the provider ~$13. Meridian Health (fictional regional system) processes 50K of these annually.

2. **What it does**: agentic pipeline with five specialist subagents (orchestrator + 5 Agents) that take a prior auth from intake to draft submission letter, with rigorous evals and observability.

3. **Architecture diagram** (Mermaid):
   ```mermaid
   graph TD
     UI[Auto-Pilot UI] -->|SSE| API[/api/autopilot]
     API --> ORCH[Orchestrator: TypeScript]
     ORCH -.parallel.-> ELIG[eligibilitySpecialist Agent · Haiku]
     ORCH -.parallel.-> POL[policyResearcher Agent · Sonnet]
     POL --> CHART[chartAbstractor Agent · Sonnet]
     CHART --> SCORE[riskScorer Agent · Haiku]
     SCORE --> DRAFT[justificationDrafter Agent · Sonnet · streaming]
     ELIG --> TOOLS1[check_eligibility tool]
     POL --> TOOLS2[lookup_medical_policy tool · Neon pgvector RAG]
     CHART --> TOOLS3[search_patient_chart tool · FHIR sandbox]
     ORCH --> DB[(Neon Postgres)]
     DB --> EVAL[/evals page]
     DB --> TRACE[/autopilot/trace/[id]]
   ```

4. **Key decisions and tradeoffs**:
   - v6 Agent abstraction for subagents, explicit TypeScript orchestration on top — "LLM reasoning within stages, deterministic control flow between stages"
   - Sonnet/Haiku per-stage routing — cost story
   - Deterministic risk score, LLM narrative — "LLMs are bad at math, great at narrative"
   - HIL boundary — agent never submits autonomously
   - Neon Postgres + pgvector — one DB for embeddings, traces, evals; production-shaped from day one
   - `@neondatabase/serverless` HTTP driver for serverless functions
   - Asymmetric eval cost framing — "false approvals are catastrophic, false escalations are baseline"
   - Programmatic groundedness check — not LLM-judged

5. **Run instructions**: clone, `pnpm install`, set up `.env.local`, set up Neon via Vercel Marketplace, `vercel env pull`, `pnpm db:push`, `pnpm tsx scripts/seed-data.ts`, `pnpm tsx scripts/ingest-policies.ts`, `pnpm dev`, `pnpm eval`.

6. **What's next** (production roadmap):
   - Full AI Gateway integration with model failover and unified observability
   - BAA-compliant deployment via Anthropic on AWS Bedrock for PHI handling
   - Real Availity integration for X12 270/271 eligibility
   - **CMS-0057-F FHIR Prior Auth API integration** (Medicare Advantage, Medicaid managed care, CHIP, QHP — mandated by Jan 1 2027). The 5-Agent topology maps directly onto these endpoints; no architectural changes needed.
   - Migration from `text-embedding-3-small` to Voyage 3 (Anthropic's recommended embedding partner) — benchmark first
   - Migration from pgvector to Turbopuffer at scale (>10K policies, dedicated retrieval performance)
   - Per-customer fine-tuning on payer-specific letter formats
   - SOC 2 Type II audit prep (audit logs already structured for it)

**Stop. Confirm**:
- AI Assistant chat works with both `get_active_auths` and `lookup_medical_policy` tools
- All polish items in place
- README is self-contained — a Vercel interviewer reading it cold understands the build

## Code conventions

- TypeScript strict mode. No `any` without explicit comment justifying.
- All async functions explicit error handling. No unhandled rejections.
- Agent instructions in separate files under `lib/ai/prompts/<agent-name>.ts` as exported template functions, not inline strings.
- Every Zod schema has a TS type via `z.infer`.
- Server components by default; client only where interactivity requires.
- Naming: kebab-case files, PascalCase components, camelCase functions.
- Comments: only *why*, not *what*.
- Use `pnpm` not `npm` or `yarn`.

## Non-goals — DO NOT BUILD

- Real submission to any payer system (mock only)
- Authentication / multi-tenancy (single-user demo)
- Email / notification integrations
- Patient-facing UI (no second persona — Jamie only)
- Deployment configuration beyond `pnpm dev` / `vercel deploy`
- Test coverage for UI components (pipeline is tested via evals)
- v7 beta — current `latest` v6 is the target

## Handling uncertainty

- For AI SDK v6 specifics, **read `docs/ai-sdk-v6/` first**. Do not rely on training data — v6 patterns differ from v5.
- For FHIR resource shapes from SMART Health IT, verify by querying before writing dependent code.
- For current Anthropic pricing in `lib/ai/pricing.ts`, fetch from anthropic.com/pricing — do not hardcode without verification.
- If a phase is taking unexpectedly long or scope is unclear, stop and ask rather than building speculatively.

## Definition of done

1. `pnpm dev` starts cleanly.
2. Auto-Pilot demo on the Aaliyah Johnson Botox case runs end-to-end in <30s with streamed events, real policy citations from Neon pgvector, real FHIR resource citations, and a streamed final letter with hover-tooltipped citations.
3. `pnpm eval` runs the 18-case suite and produces a report with **0 false approvals**.
4. `/evals` page renders the same report; "Run evals" button triggers a live run.
5. Trace view for any Auto-Pilot run shows full per-subagent detail with costs and latencies.
6. AI Assistant answers `get_active_auths` and policy questions via tools.
7. README explains architecture and decisions clearly enough that a Vercel interviewer reading cold understands the build.
8. All five subagents are implemented as v6 `Agent` instances (verifiable by reading the code).

Begin Phase 0 now. Stop when Phase 0 is complete and confirm before continuing.
```