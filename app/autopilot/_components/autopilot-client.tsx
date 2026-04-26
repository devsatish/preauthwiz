'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TopologyView, type AgentState, type AgentStatus } from '@/components/autopilot/topology';
import { LiveActivity, type ActivityEntry } from '@/components/autopilot/live-activity';
import { FinalReport } from '@/components/autopilot/final-report';
import { Zap, Send, History } from 'lucide-react';
import type { TraceEvent } from '@/lib/schemas/trace';

const PRIOR_AUTH_OPTIONS = [
  { id: 'auth-005', label: 'Aaliyah Johnson — J0585 Botox · NEW (Chronic Migraine) — Aetna PPO' },
  { id: 'auth-013', label: 'Marcus Chen — J0585 Botox · CONTINUATION Cycle 2 — Aetna PPO' },
  { id: 'auth-011', label: 'Sophia Martinez — 62323 Epidural Injection — Anthem PPO' },
  { id: 'auth-012', label: "Liam O'Brien — J0558 Dupilumab (Asthma) — BCBS" },
];

const INITIAL_AGENTS: AgentState[] = [
  { name: 'eligibilitySpecialist', label: 'Eligibility Specialist', role: 'Verifies coverage & PA requirement', model: 'Haiku 4.5', tool: 'check_eligibility', status: 'idle', callCount: 0 },
  { name: 'policyResearcher', label: 'Policy Researcher', role: 'Extracts payer criteria via RAG', model: 'Sonnet 4.5', tool: 'lookup_medical_policy', status: 'idle', callCount: 0 },
  { name: 'chartAbstractor', label: 'Chart Abstractor', role: 'Maps chart evidence to criteria', model: 'Sonnet 4.5', tool: 'search_patient_chart', status: 'idle', callCount: 0 },
  { name: 'riskScorer', label: 'Risk Scorer', role: 'Deterministic score + narrative', model: 'Haiku 4.5', tool: 'deterministic', status: 'idle', callCount: 0 },
  { name: 'justificationDrafter', label: 'Justification Drafter', role: 'Streams the PA letter', model: 'Sonnet 4.5', tool: 'streaming', status: 'idle', callCount: 0 },
];

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'auto_approve_eligible') {
    return <Badge className="bg-green-100 text-green-800 border-green-200 border">Auto-Approve Eligible</Badge>;
  }
  if (verdict === 'escalate_for_review') {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 border">Escalate for Review</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 border-red-200 border">Recommend Deny</Badge>;
}

function LastRunBadge({ completedAt }: { completedAt: string }) {
  const date = new Date(completedAt);
  const hoursAgo = differenceInHours(new Date(), date);
  const label =
    hoursAgo < 24
      ? `Last run: ${formatDistanceToNow(date, { addSuffix: true })}`
      : `Last run: ${format(date, 'MMM d, yyyy h:mm a')}`;
  return (
    <Badge variant="outline" className="gap-1.5 text-slate-600">
      <History className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export interface InitialRun {
  id: string;
  priorAuthId: string;
  startedAt: string;
  completedAt: string;
  letter: string;
  verdict: string;
  totalTokens: number;
  totalCostCents: number;
  latencyMs: number;
}

interface AutopilotClientProps {
  priorAuthId: string;
  initialRun: InitialRun | null;
}

export function AutopilotClient({ priorAuthId, initialRun }: AutopilotClientProps) {
  const router = useRouter();
  const [selectedAuthId, setSelectedAuthId] = useState(priorAuthId);
  const [isRunning, setIsRunning] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>(() =>
    initialRun
      ? INITIAL_AGENTS.map(a => ({ ...a, status: 'complete' as AgentStatus, callCount: 1 }))
      : INITIAL_AGENTS,
  );
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [letter, setLetter] = useState(initialRun?.letter ?? '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [runComplete, setRunComplete] = useState(initialRun !== null);
  const [verdict, setVerdict] = useState(initialRun?.verdict ?? '');
  const [totalTokens, setTotalTokens] = useState(initialRun?.totalTokens ?? 0);
  const [costCents, setCostCents] = useState(initialRun?.totalCostCents ?? 0);
  const [latencyMs, setLatencyMs] = useState(initialRun?.latencyMs ?? 0);
  const [currentRunId, setCurrentRunId] = useState<string | null>(initialRun?.id ?? null);
  const [lastRunCompletedAt, setLastRunCompletedAt] = useState<string | null>(
    initialRun?.completedAt ?? null,
  );
  const [hilDialogOpen, setHilDialogOpen] = useState(false);
  const eventCounter = useRef(0);

  function updateAgentStatus(name: string, status: AgentStatus) {
    setAgents(prev =>
      prev.map(a =>
        a.name === name
          ? { ...a, status, callCount: status === 'complete' ? a.callCount + 1 : a.callCount }
          : a,
      ),
    );
  }

  function addActivity(event: TraceEvent) {
    eventCounter.current += 1;
    const subagent = 'subagent' in event ? event.subagent : 'run';
    setActivityLog(prev => [
      ...prev,
      {
        id: `${subagent}-${event.type}-${event.timestamp}-${eventCounter.current}`,
        event,
      },
    ]);
  }

  function handleCaseChange(newId: string) {
    setSelectedAuthId(newId);
    router.push(`/autopilot?case=${newId}`);
  }

  async function runAutoPilot() {
    setIsRunning(true);
    setAgents(INITIAL_AGENTS.map(a => ({ ...a })));
    setActivityLog([]);
    setLetter('');
    setIsStreaming(false);
    setRunComplete(false);
    setVerdict('');
    setTotalTokens(0);
    setCostCents(0);
    setLatencyMs(0);
    setCurrentRunId(null);

    try {
      const response = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorAuthId: selectedAuthId }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: TraceEvent;
          try {
            event = JSON.parse(raw) as TraceEvent;
          } catch {
            continue;
          }

          addActivity(event);

          if (event.type === 'agent_started') {
            updateAgentStatus(event.subagent, 'running');
          } else if (event.type === 'agent_completed') {
            updateAgentStatus(event.subagent, 'complete');
          } else if (event.type === 'text_chunk') {
            setIsStreaming(true);
            setLetter(prev => prev + event.chunk);
          } else if (event.type === 'run_completed') {
            const completedAt = new Date().toISOString();
            setVerdict(event.verdict ?? '');
            setTotalTokens(event.total_tokens);
            setCostCents(event.total_cost_cents);
            setLatencyMs(event.latency_ms);
            setRunComplete(true);
            setIsStreaming(false);
            setCurrentRunId(event.runId);
            setLastRunCompletedAt(completedAt);
            // Silent URL update — no Next.js re-render, so the live state survives.
            // A subsequent manual refresh will hydrate the same run from the server.
            window.history.replaceState(
              {},
              '',
              `/autopilot?case=${selectedAuthId}&run=${event.runId}`,
            );
          } else if (event.type === 'run_error') {
            setAgents(prev => prev.map(a => (a.status === 'running' ? { ...a, status: 'error' } : a)));
          }
        }
      }
    } catch (err) {
      console.error('AutoPilot run error:', err);
    } finally {
      setIsRunning(false);
      setIsStreaming(false);
    }
  }

  const showLastRunBadge = !isRunning && lastRunCompletedAt !== null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">Agentic</Badge>
        <Badge variant="outline">AI SDK v6</Badge>
        <Badge variant="outline">Agent + Tool primitives</Badge>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          Prior Auth Auto-Pilot
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          5 specialist subagents orchestrated in TypeScript — eligibility, policy research, chart abstraction, risk scoring, and letter drafting.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="flex-1 min-w-0 max-w-lg border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedAuthId}
          onChange={e => handleCaseChange(e.target.value)}
          disabled={isRunning}
        >
          {PRIOR_AUTH_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <Button
          onClick={runAutoPilot}
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Zap className="h-4 w-4 mr-1.5" />
          {isRunning ? 'Running…' : 'Run Auto-Pilot'}
        </Button>
        {showLastRunBadge && lastRunCompletedAt && (
          <LastRunBadge completedAt={lastRunCompletedAt} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">Agent Topology</CardTitle>
            </CardHeader>
            <CardContent>
              <TopologyView agents={agents} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">Live Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <LiveActivity events={activityLog} />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-700">Final Report</CardTitle>
                {verdict && <VerdictBadge verdict={verdict} />}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3">
              <ScrollArea className="h-96">
                <FinalReport
                  letter={letter}
                  isStreaming={isStreaming}
                  runId={runComplete ? currentRunId ?? undefined : undefined}
                  verdict={verdict}
                  totalTokens={totalTokens}
                  costCents={costCents}
                  latencyMs={latencyMs}
                />
              </ScrollArea>
            </CardContent>
          </Card>

          {runComplete && (
            <div className="border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
              <p className="text-xs text-slate-600 mb-1 font-medium">Human-in-the-Loop</p>
              <p className="text-xs text-slate-500 mb-3">
                PreAuthWiz never submits autonomously. Review the draft before routing.
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => setHilDialogOpen(true)}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send for Clinician Review
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={hilDialogOpen} onOpenChange={setHilDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Clinician Review</DialogTitle>
            <DialogDescription>
              This will route the draft justification letter to Dr. Aisha Patel for final clinical review and payer submission.
              PreAuthWiz never submits prior authorizations autonomously — a licensed clinician must review and approve before any submission.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
            This action will notify Dr. Patel via the EHR task queue. No payer submission occurs at this step.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHilDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setHilDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700">
              Confirm — Route to Dr. Patel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
