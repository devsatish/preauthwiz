'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Layers,
  Workflow,
  ShieldCheck,
  FlaskConical,
  Boxes,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TechnicalNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Step {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  body: React.ReactNode;
}

// Tiny inline tag — keeps copy scannable for technical reviewers without
// turning the dialog into a wall of text.
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
      {children}
    </span>
  );
}

const STEPS: Step[] = [
  {
    title: 'Why an agent pipeline?',
    icon: Layers,
    accent: 'bg-blue-50 text-blue-700',
    body: (
      <>
        <p>
          A single LLM call could draft a prior auth letter, but it would also be a black box —
          impossible to audit, hard to evaluate, easy to hallucinate.
        </p>
        <p className="mt-3">
          PreAuthWiz splits the work across <strong>five specialized subagents</strong> connected by
          a deterministic orchestrator. Each agent owns one job, runs its own tools, and emits
          trace events you can replay later.
        </p>
        <ul className="mt-3 space-y-1.5 text-[13px] text-slate-600 list-disc pl-5">
          <li><strong>Specialization</strong> — narrow prompts beat general ones</li>
          <li><strong>Parallelism</strong> — eligibility, policy, and chart fan out together</li>
          <li><strong>Auditability</strong> — every tool call, every retrieved chunk, every cited fact</li>
          <li><strong>Determinism</strong> — risk score is pure TypeScript, not LLM math</li>
        </ul>
      </>
    ),
  },
  {
    title: 'The five subagents',
    icon: Workflow,
    accent: 'bg-indigo-50 text-indigo-700',
    body: (
      <>
        <p className="mb-3">
          Built on <Tag>AI SDK v6</Tag> <Tag>ToolLoopAgent</Tag>. Models picked per workload —
          Sonnet 4.5 for reasoning-heavy work, Haiku 4.5 for structured extraction.
        </p>
        <ol className="space-y-2.5 text-[13px] text-slate-700">
          <li>
            <strong>1. Eligibility Specialist</strong> <Tag>Haiku 4.5</Tag>
            <p className="text-slate-600 mt-0.5">Coverage, network status, formulary check.</p>
          </li>
          <li>
            <strong>2. Policy Researcher</strong> <Tag>Sonnet 4.5</Tag>
            <p className="text-slate-600 mt-0.5">RAG over the payer policy corpus. Returns the criteria the auth must satisfy, with verbatim policy quotes.</p>
          </li>
          <li>
            <strong>3. Chart Abstractor</strong> <Tag>Sonnet 4.5</Tag>
            <p className="text-slate-600 mt-0.5">Reads the patient&apos;s FHIR Bundle. Extracts evidence with chart citations. Refuses to improvise — fabricated facts are caught and discarded.</p>
          </li>
          <li>
            <strong>4. Risk Scorer</strong> <Tag>Haiku 4.5</Tag>
            <p className="text-slate-600 mt-0.5">A pure-TS <code className="font-mono text-xs">computeScore()</code> applies thresholds (≥0.9 auto-approve · ≥0.6 escalate · &lt;0.6 deny). The LLM only writes the human-readable narrative.</p>
          </li>
          <li>
            <strong>5. Justification Drafter</strong> <Tag>Sonnet 4.5</Tag>
            <p className="text-slate-600 mt-0.5">Composes the letter, every clinical claim grounded by a chart-citation or a policy quote.</p>
          </li>
        </ol>
      </>
    ),
  },
  {
    title: 'Defense in depth',
    icon: ShieldCheck,
    accent: 'bg-amber-50 text-amber-700',
    body: (
      <>
        <p>
          Three telemetry events fire when an agent tries something it shouldn&apos;t.
          They&apos;re visible on the Trace page and the Dashboard banner.
        </p>
        <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
          <li>
            <strong className="text-amber-700">score_override</strong> — the LLM tried to talk the
            scorer into a different verdict. Blocked. Score stays as the deterministic computation.
          </li>
          <li>
            <strong className="text-rose-700">policy_extraction_failure</strong> — the policy researcher
            returned empty or malformed criteria. Run is flagged; reviewer sees the failure rather
            than a confidently-wrong letter.
          </li>
          <li>
            <strong className="text-rose-700">improvised_evidence_discarded</strong> — the chart
            abstractor cited a fact that isn&apos;t in the chart. Discarded before it can reach the letter.
          </li>
        </ul>
        <p className="mt-3 text-[13px] text-slate-600 italic">
          These aren&apos;t aspirational — they&apos;re real validators in the orchestrator that fire
          on real cases. The amber/red borders on trace events show exactly where they triggered.
        </p>
      </>
    ),
  },
  {
    title: 'Eval harness',
    icon: FlaskConical,
    accent: 'bg-emerald-50 text-emerald-700',
    body: (
      <>
        <p>
          A 10-case suite lives at <Tag>lib/eval/cases.ts</Tag>. Each case asserts the
          expected verdict and (optionally) blocking-criteria count and specific evidence
          claims. Boundary cases use <code className="font-mono text-xs">verdict_one_of</code>
          {' '}to handle temp-0 jitter without making the suite flaky.
        </p>
        <p className="mt-3">Mix:</p>
        <ul className="mt-1.5 space-y-1 text-[13px] text-slate-700 list-disc pl-5">
          <li>2 regression cases (canonical demo: Aaliyah / Marcus)</li>
          <li>4 adversarial cases (non-neurologist prescriber, episodic vs chronic, missing policy, etc)</li>
          <li>3 edge cases (partial preventive trial, stale headache diary, PCP-prescriber)</li>
        </ul>
        <p className="mt-3">
          Run via the <Tag>/evals</Tag> page or <code className="font-mono text-xs">pnpm eval</code>.
          The gate before any prompt change ships: <strong>10/10 PASS</strong>. Multiple bugs in
          the agent stack were caught here before they reached production — boundary
          calibration, scorer fail-open, chart improvisation.
        </p>
      </>
    ),
  },
  {
    title: 'Stack & infrastructure',
    icon: Boxes,
    accent: 'bg-violet-50 text-violet-700',
    body: (
      <>
        <ul className="space-y-2 text-[13px] text-slate-700">
          <li>
            <strong>Frontend</strong> — <Tag>Next.js 16</Tag> App Router (with the{' '}
            <Tag>proxy.ts</Tag> file convention, renamed from middleware), React Server Components,
            Tailwind v4, shadcn/ui.
          </li>
          <li>
            <strong>AI</strong> — <Tag>AI SDK v6</Tag> across the board: ToolLoopAgent for the
            subagents, streamText + useChat for the chat assistant, SSE for live activity streaming.
          </li>
          <li>
            <strong>Models</strong> — Anthropic <Tag>Claude Sonnet 4.5</Tag> +{' '}
            <Tag>Claude Haiku 4.5</Tag>. Anthropic prompt caching ({' '}
            <Tag>cacheControl: ephemeral, ttl: 1h</Tag>) for policy chunks so the policy
            researcher reuses retrieved context across runs.
          </li>
          <li>
            <strong>RAG</strong> — Neon Postgres + <Tag>pgvector</Tag> with HNSW indexing.
            Embeddings via OpenAI <Tag>text-embedding-3-small</Tag> at 1536 dimensions.
          </li>
          <li>
            <strong>Observability</strong> — every run writes events to{' '}
            <Tag>auth_run_events</Tag> with subagent, tool_call, retrieved_chunks, and timing.
            The Trace page replays them.
          </li>
          <li>
            <strong>Deploy</strong> — Vercel. Fluid Compute for the SSE routes. Env-gated access
            password for the public demo URL.
          </li>
        </ul>
      </>
    ),
  },
];

export function TechnicalNotesDialog({ open, onOpenChange }: TechnicalNotesDialogProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  function close() {
    onOpenChange(false);
  }

  function next() {
    if (isLast) {
      close();
      return;
    }
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  }

  function prev() {
    setStep(s => Math.max(0, s - 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', current.accent)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Technical notes · {step + 1} of {STEPS.length}
              </p>
              <DialogTitle className="text-base font-semibold text-slate-900 mt-0.5">
                {current.title}
              </DialogTitle>
            </div>
          </div>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i <= step ? 'bg-blue-600' : 'bg-slate-200',
                )}
              />
            ))}
          </div>
        </div>

        {/* Body — denser than the tour, scrollable for long lists. We render
            a plain <div> instead of DialogDescription because the body has
            block-level children (lists, code blocks) that <p> can't contain. */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto text-[14px] text-slate-700 leading-relaxed space-y-1">
          {current.body}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={close}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={prev}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
