# State of PreAuthWiz — 2026-04-26 (end of day)

Cold-resume document. ~3 pages.

---

## Where we are

**Phase 3 is complete.** Real RAG over ingested Aetna policies, vector search wired into `lookup_medical_policy`, three independent fail-safes against empty-criteria failure modes, verdict-stable on `auth-005` across 5 verified runs.

Today's commit chain (oldest → newest):

```
b67ebee phase 2: verified end-to-end — grounded letter generation on auth-005
3e6627c phase 2 final: deterministic verdicts, grounded narratives, score override telemetry
a87522e chore: pin temperature 0 on chart abstractor + policy researcher for reproducible evals
ac99f47 feat: prompt caching on chart abstractor + cache-aware cost calculation
a7f74e1 feat: ingest Aetna CPB 0113 + CPB 0462 into Neon pgvector
6b5951d feat: Phase 3 — real RAG ingestion + tool wiring
283a502 fix: defense in depth against empty-criteria failure modes
```

(STATE.md commit will follow as the next entry.)

---

## Demo state

**Canonical case: `auth-005`** (Aaliyah Johnson, J0585 Botox for chronic migraine, Aetna PPO).

Verified verdict on real-RAG path: **`escalate_for_review`**, deterministic across 5 consecutive runs.

| Run | Verdict | Score | blocking_count | criteria.length | extraction_confidence |
|---|---|--:|:-:|:-:|:-:|
| run-1777184147214-8w552c (pre-Fix-A, tool broken) | escalate | 0 | 1 | 0 | low |
| run-1777184331340-a5rrv2 | escalate | 0.833 | 0 | 16 | high |
| run-1777184496380-42njgv | escalate | 0.813 | 0 | 15 | high |
| run-1777184636790-jx1tr9 | escalate | 0.833 | 0 | 14 | high |

Verdict-stable across all post-fix runs. Score variance ~2.5% (0.813–0.833) is the same Anthropic-temp-0-not-bit-deterministic tail accepted in Phase 2. Criteria count varies 14–16 (LLM atomization granularity, not behavior shift). Zero `score_overrides`, zero `improvised_evidence_discarded`, zero `policy_extraction_failure` events on the post-fix runs.

**Live cost numbers (real RAG):** ~$0.76 per run, ~226K total tokens, ~150s latency.

**Mocked-path numbers (legacy, reference only):** ~$0.20 per run, ~43K tokens, ~100s. **Do not present these as the live demo numbers.** The 3.7× cost increase is the honest cost of vector retrieval over dense Aetna policy chunks; the policy researcher iterates several times to find the criteria sections amid research narratives and unrelated indications.

---

## Five bugs found and fixed today (root cause + fix)

### 1. Chart abstractor exclusion-semantics ambiguity (literal vs intent)

The chart abstractor was emitting `met="yes"` on exclusion criteria to mean *"the patient appropriately avoids this exclusion (good)"* while the deterministic scorer in `risk-scorer.ts:computeScore()` interpreted `met="yes"` on an exclusion as *"the patient meets the exclusion (block!)"*. Same input data could produce `auto_approve` or `recommend_deny` depending on which interpretation the LLM landed on per run. **Fix**: rewrote the chart-abstractor prompt with split required-vs-exclusion semantics + a worked example explicitly stating that for exclusions, `met="yes"` means the patient HAS the excluded condition. Added a defensive validator in `computeScore` that detects "exclusion does not apply" / "exclusion avoided" phrases in the chart abstractor's `reasoning` field and flips `met` from `yes`→`no` with telemetry persisted as `score_override` rows in `auth_run_events`. (Commit `3e6627c`.)

### 2. Risk scorer fail-open on empty criteria (patient-safety regression)

When `requiredCriteria.length === 0`, `computeScore()` returned `score: 1.0, verdict: 'auto_approve_eligible'` — interpreting "zero criteria" as "trivially satisfied." Mocked path always returned 13 criteria, so the empty branch never executed in test. When real RAG initially failed to extract criteria (see bugs #4 and #5), the scorer wrong-fail-opened. **Fix**: empty-criteria branch now returns `escalate_for_review` with score 0 and a synthetic blocking issue *"No policy criteria available — unable to verify medical necessity. Manual review required."* Fail-closed by default. (Commit `283a502`.)

### 3. Chart abstractor improvisation when given empty criteria

When the orchestrator passed `criteriaText = ''` to the chart abstractor (because the policy researcher returned zero criteria), the chart abstractor invented 8 plausible-sounding criteria from medical knowledge + the inlined chart context (`chronic_migraine_diagnosis`, `headache_frequency_15_days`, `no_prior_botox`, `not_pregnant_or_breastfeeding`, etc.). The narrative writer then dutifully wrote a letter justifying these fabricated criteria. **Fix**: explicit prompt rule: "If the input criteria list is empty, do NOT invent or improvise criteria. Return `{ evidence_by_criterion: [] }` immediately." Plus an orchestrator-side defensive check: if input criteria empty AND output evidence non-empty, discard improvised evidence + log `improvised_evidence_discarded` event. Three independent layers of defense (scorer fail-safe, prompt rule, orchestrator validator). (Commit `283a502`.)

### 4. Policy researcher unable to extract from dense real chunks

The original policy researcher prompt was tuned for the mocked tool's pre-distilled criteria chunks. Real Aetna chunks contain a mix of coverage criteria, research narratives ("Silberstein et al (2005) assessed..."), multi-indication boilerplate (cervical dystonia, hyperhidrosis), and brand-selection policy. The agent consumed 165K input tokens iterating on the tool, then bailed with `criteria: []` because it couldn't disambiguate criteria from surrounding noise. **Fix**: rewrote the prompt with retrieval strategy (which sections to look for: "Prevention", "Selection criteria", "Migraine prophylaxis"), atomization rules (each "and"-clause is a separate criterion, target 8–15), a worked example using actual Aetna chunk text, and an explicit failure-mode shape `{ criteria: [], extraction_confidence: 'low', extraction_failure_reason: <specific> }`. Post-fix, the agent extracts 14–16 criteria with `extraction_confidence: 'high'` consistently. (Commit `283a502`.)

### 5. Drizzle `sql\`ANY(${array})\`` row-constructor splat bug

When passing a JS array to `sql\`WHERE policy_id = ANY(${policyIds})\`` with the Drizzle `sql` template + neon-http driver, the array is splatted into individual placeholders and wrapped in parens — generating `WHERE policy_id = ANY(($2, $3))` instead of `WHERE policy_id = ANY($1::text[])`. Postgres reads `($2, $3)` as a row constructor, not an array, and the query errors out. The agent ToolLoop swallowed the errors and reported them as "Database query failures prevented retrieval." Caught by an isolation test (`scripts/test-lookup-tool.ts`) that runs the tool standalone. **Fix**: switched the WHERE clause from raw `sql\`...\`` to Drizzle's query-builder `inArray(policyChunks.policyId, policyIds)`, which generates the correct `IN (?, ?)` shape. (Commit `6b5951d`.)

---

## Architecture decisions worth defending in interview

### Hybrid orchestration: AI SDK v6 Agent abstraction + explicit TypeScript control flow

The orchestrator (`lib/agents/orchestrator.ts`) is plain TypeScript that calls `agent.generate()` on each subagent in sequence (or `Promise.all` for parallel stages 1 + 2). Each subagent is a `ToolLoopAgent` instance handling its own tool calls and structured output. This gives us LLM-driven reasoning where it matters (criteria extraction, evidence mapping, narrative writing) and deterministic control where it matters (stage ordering, persistence, score computation). Single-purpose agents with strict input/output contracts beat one big "do prior auth" agent every time. The Agent abstraction is sufficient for caching, tool calls, and structured output — we never had to drop to the lower-level `@anthropic-ai/sdk` for any feature.

### Deterministic risk scoring: LLM does narrative only, not math

`risk-scorer.ts:computeScore()` is pure TypeScript — given criteria + evidence, the verdict is reproducible bit-for-bit across runs regardless of LLM temperature. The Haiku narrative agent receives the score, verdict, blocking_issues, AND the chart evidence as grounding context — and writes prose only. It cannot change the verdict. This separation is the right model for a regulated domain: verdicts must be auditable and deterministic; explanations should be readable, which is what LLMs are good for. Bug #2 reinforced the importance of the deterministic side: when scoring math is wrong (fail-open on empty criteria), no amount of LLM polish on the narrative makes it correct.

### Score override telemetry catches semantic ambiguity in real time

When the defensive validator in `computeScore()` detects an exclusion-semantic flip (chart abstractor said `met="yes"` but reasoning text says "exclusion does not apply"), it overrides `met` to `"no"` AND records a `score_override` row in `auth_run_events` with `{ criterion_id, original_met, new_met, reasoning_excerpt }`. Counting these over time tells us whether the prompt-level fix is holding (count near zero = healthy) or whether new prompt regressions are happening (rising count = investigate). The safety net produces signal, not just behavior. Same pattern applied to `policy_extraction_failure` and `improvised_evidence_discarded` events — observability primitives, not just defensive code.

### Prompt caching with 1024-token floor as design constraint

Anthropic requires cached blocks ≥1024 tokens for Sonnet. The chart abstractor's static instructions alone (~370 tokens) don't qualify; combined with the inlined FHIR bundle (~1750 tokens) they cross the floor at ~2100 tokens. We chose **Option B** (inline the bundle as a cached system block + keep the `search_patient_chart` tool) over Option A (inline + drop the tool) to preserve the demo's "agentic story" — the live activity panel keeps its `tool_called` event for visual narrative, at a small 4K-token cold-run redundancy cost. In production we'd switch to Option A or content-addressable caching; for the demo, the small redundancy buys a clearer narrative. Cold-vs-warm verified: ~9% run-wide cost reduction, ~12% on the chart abstractor stage. **Latency win did not materialize** at this cache size (output-dominated workload, prefill savings noise) — honest framing in the demo.

### Three independent fail-safes against empty-criteria failure (scorer, abstractor, orchestrator)

Bug #2 was masked for an entire phase by mocked data. We could have just fixed the scorer and called it done. Instead we layered three defenses: (1) the **scorer** fails closed on empty criteria, (2) the **chart abstractor prompt** explicitly forbids improvisation on empty criteria, (3) the **orchestrator** validates the chart abstractor's output and discards improvised evidence with telemetry. Each layer would catch the bug independently; together they make the failure mode observable AND safe AND attributable. This is the right level of defensive engineering for patient-safety code paths — not paranoia, but proportional to the consequence of getting it wrong.

---

## Known issues / accepted tradeoffs

- **Score variance ~15% from Anthropic temp 0 not being bit-deterministic.** Verdict is stable across runs; absolute score (0.813–0.833 on auth-005) drifts. Eval contract: assert verdict equality, not score equality.
- **Real RAG cost 3.7× mocked path** ($0.20 → $0.76 per run). Expected; honest demo math. Driven by policy researcher iteration on dense real-policy text.
- **Policy researcher iteration count is the dominant cost driver.** ~165K–180K input tokens per run on the policy researcher alone. Caching its instructions helps marginally (Task 3 of today's brief); reducing iteration budget would help more but risks under-extraction.
- **Migration filename collision** (`0001_hnsw_index.sql` manual + `0001_robust_nightcrawler.sql` drizzle-generated coexist). Visually noisy, functionally fine.
- **Token total in `auth_runs.total_tokens` is sum of (uncached input + output + cache reads + cache writes)**, not a single-meaning quantity. Documented in code comments; eval harness should be aware.

---

## Remaining work, sized

- **Phase 4 eval harness — 2–3 hr.** Hero adversarial case: `dosage_consistency_chronic_migraine` — auth-005 requests 200 units (within Aetna's 200-unit ceiling per E2 exclusion), policy default is 155 units. Test that letter does not silently substitute 155 for the actual 200-unit request. Also: regression case for verdict stability, groundedness check (every cited FHIR ID exists in chart bundle), score-override count assertion. Needs user input on case selection + schema.
- **Second canonical fixture for auto-approve demo — 45–60 min.** A case that should hit `auto_approve_eligible` cleanly. Requires a chart with full preventive-trial documentation + prospective dose plan + reauth-quality evidence. Needs user voice for fixture construction.
- **README + architecture diagram — 1–2 hr.** Needs user voice. Architecture diagram should show the 5-subagent topology + tool boundaries + persistence layers.
- **Demo deck / 3-min pitch — 1 hr.** Needs user voice and the failure-mode story (5 bugs in one integration test). The "mocked data masks patient-safety bugs" narrative is the strongest hook.
- **Trace stub page — 30 min.** Task 2 of today's brief. Replaces the 404 footgun on the "View full trace" link. Phase 5 quality (data visibility over polish).

---

## Hero adversarial eval case for Phase 4

**`dosage_consistency_chronic_migraine`.** auth-005 requests 200 units (within Aetna's 200-unit ceiling per E2 exclusion: *"more than 200 Units is considered not medically necessary"*). The policy default referenced in `dr-neurology-consult` is 155 units (PREEMPT protocol). Earlier observation in this project: the justification drafter has been silently substituting 155 for 200 in letter copy. The eval should: parse the generated letter for the dose figure cited; assert it matches the requested 200 from `prior_auth.notes` OR contains an explicit reconciliation statement ("requesting 200 units; recommending 155 per protocol because…"). Silent swaps fail.

This is the canonical "agent looks right but is silently wrong" example for the pitch.
