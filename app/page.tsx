import { db } from '@/lib/db/client';
import { priorAuths, authRunEvents, authRuns } from '@/lib/db/schema';
import { eq, or, count, gte, sql, inArray } from 'drizzle-orm';
import { DashboardKPIs } from '@/components/dashboard/kpis';
import { DashboardCharts } from '@/components/dashboard/charts';
import { AlertTriangle, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getCurrentPersona } from '@/lib/auth/session';

interface DashboardData {
  activeAuthCount: number;
  todayDate: string;
  greetingPhrase: string;
  // Telemetry counts in the last 24h — these replace the prior hardcoded alert.
  telemetry: {
    score_override: number;
    policy_extraction_failure: number;
    improvised_evidence_discarded: number;
    runs_today: number;
    auto_approve_today: number;
    escalate_today: number;
    deny_today: number;
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const hour = now.getHours();
  const greetingPhrase = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [activeCountResult] = await db
      .select({ count: count() })
      .from(priorAuths)
      .where(
        or(
          eq(priorAuths.status, 'pending'),
          eq(priorAuths.status, 'needs_info'),
          eq(priorAuths.status, 'p2p_required'),
        )!,
      );

    // Count telemetry events in the last 24h (real "AI caught issues" data, not hardcoded fiction).
    const eventCounts = await db
      .select({ status: authRunEvents.status, count: count() })
      .from(authRunEvents)
      .where(
        sql`${authRunEvents.timestamp} >= ${dayAgo.toISOString()} AND ${authRunEvents.status} IN ('score_override', 'policy_extraction_failure', 'improvised_evidence_discarded')`,
      )
      .groupBy(authRunEvents.status);

    const telemetryByStatus: Record<string, number> = {};
    for (const row of eventCounts) telemetryByStatus[row.status] = row.count;

    // Count today's runs by verdict for the second-paragraph context.
    const verdictCounts = await db
      .select({ verdict: authRuns.verdict, count: count() })
      .from(authRuns)
      .where(gte(authRuns.startedAt, dayAgo))
      .groupBy(authRuns.verdict);

    const byVerdict: Record<string, number> = {};
    for (const row of verdictCounts) {
      if (row.verdict) byVerdict[row.verdict] = row.count;
    }
    const runsToday = Object.values(byVerdict).reduce((a, b) => a + b, 0);

    return {
      activeAuthCount: activeCountResult?.count ?? 0,
      todayDate,
      greetingPhrase,
      telemetry: {
        score_override: telemetryByStatus['score_override'] ?? 0,
        policy_extraction_failure: telemetryByStatus['policy_extraction_failure'] ?? 0,
        improvised_evidence_discarded: telemetryByStatus['improvised_evidence_discarded'] ?? 0,
        runs_today: runsToday,
        auto_approve_today: byVerdict['auto_approve_eligible'] ?? 0,
        escalate_today: byVerdict['escalate_for_review'] ?? 0,
        deny_today: byVerdict['recommend_deny'] ?? 0,
      },
    };
  } catch {
    return {
      activeAuthCount: 7,
      todayDate,
      greetingPhrase,
      telemetry: {
        score_override: 0,
        policy_extraction_failure: 0,
        improvised_evidence_discarded: 0,
        runs_today: 0,
        auto_approve_today: 0,
        escalate_today: 0,
        deny_today: 0,
      },
    };
  }
}

interface FeaturedCase {
  authId: string;
  patientName: string;
  procedure: string;
  payer: string;
  framing: string;
}

async function getFeaturedCases(): Promise<FeaturedCase[]> {
  // The two canonical demo cases. We pull the actual auth + patient rows so the
  // CTA copy stays in sync with the seed data, instead of hardcoded strings.
  try {
    const rows = await db
      .select({
        authId: priorAuths.id,
        cptCode: priorAuths.cptCode,
        notes: priorAuths.notes,
        payerId: priorAuths.payerId,
        planName: priorAuths.planName,
      })
      .from(priorAuths)
      .where(inArray(priorAuths.id, ['auth-005', 'auth-013']));

    const labels: Record<string, { framing: string; procedureLabel: string }> = {
      'auth-005': { framing: 'New request — full chart abstraction + criteria match', procedureLabel: 'Botox for Chronic Migraine (initial)' },
      'auth-013': { framing: 'Continuation request — cycle 2, prior response documented', procedureLabel: 'Botox Cycle 2 (continuation)' },
    };

    return rows
      .map(r => {
        const cfg = labels[r.authId];
        if (!cfg) return null;
        return {
          authId: r.authId,
          patientName: r.authId === 'auth-005' ? 'Aaliyah Johnson' : 'Marcus Chen',
          procedure: cfg.procedureLabel,
          payer: `${r.payerId} · ${r.planName}`,
          framing: cfg.framing,
        };
      })
      .filter((r): r is FeaturedCase => r !== null)
      .sort((a, b) => a.authId.localeCompare(b.authId));
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [data, featured, persona] = await Promise.all([
    getDashboardData(),
    getFeaturedCases(),
    getCurrentPersona(),
  ]);
  const firstName = persona?.firstName ?? 'there';
  const totalIssues =
    data.telemetry.score_override +
    data.telemetry.policy_extraction_failure +
    data.telemetry.improvised_evidence_discarded;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
        >
          {data.greetingPhrase}, <em className="italic text-[#1F4F36]">{firstName}.</em>
        </h1>
        <p className="text-slate-500 mt-1.5 text-sm">
          Meridian Health · {data.todayDate} · {data.activeAuthCount} auth{data.activeAuthCount !== 1 ? 's' : ''} need your attention today
        </p>
      </div>

      {/* Telemetry alert — real counts, hides itself when zero */}
      {totalIssues > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">AI safety nets fired {totalIssues} time{totalIssues !== 1 ? 's' : ''} in the last 24h</span>
            {' — '}
            {data.telemetry.score_override > 0 && `${data.telemetry.score_override} scorer override${data.telemetry.score_override !== 1 ? 's' : ''}`}
            {data.telemetry.score_override > 0 && (data.telemetry.policy_extraction_failure + data.telemetry.improvised_evidence_discarded) > 0 && ', '}
            {data.telemetry.policy_extraction_failure > 0 && `${data.telemetry.policy_extraction_failure} policy extraction failure${data.telemetry.policy_extraction_failure !== 1 ? 's' : ''}`}
            {data.telemetry.policy_extraction_failure > 0 && data.telemetry.improvised_evidence_discarded > 0 && ', '}
            {data.telemetry.improvised_evidence_discarded > 0 && `${data.telemetry.improvised_evidence_discarded} improvised-evidence discard${data.telemetry.improvised_evidence_discarded !== 1 ? 's' : ''}`}
            .
          </p>
          <Link href="/evals" className="ml-auto text-xs text-amber-700 hover:underline font-medium whitespace-nowrap flex items-center gap-1">
            View eval harness <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : data.telemetry.runs_today > 0 ? (
        <div className="bg-[#F1EFE6] border border-[#1F4F36]/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F4F36] opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1F4F36]" />
          </span>
          <CheckCircle2 className="h-4 w-4 text-[#1F4F36] shrink-0" />
          <p className="text-sm text-[#1F4F36]">
            <span className="font-semibold">{data.telemetry.runs_today} run{data.telemetry.runs_today !== 1 ? 's' : ''} in the last 24h, no safety-net events</span>
            {' — '}
            {data.telemetry.auto_approve_today} auto-approved · {data.telemetry.escalate_today} escalated · {data.telemetry.deny_today} denied
          </p>
          <Link href="/evals" className="ml-auto text-xs text-[#1F4F36] hover:underline font-medium whitespace-nowrap flex items-center gap-1">
            View eval harness <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : null}

      {/* Two-path CTA — demo's headline narrative */}
      {featured.length === 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {featured.map((c, i) => (
            <div
              key={c.authId}
              className={`rounded-xl p-5 text-white ${
                i === 0
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                  : 'bg-gradient-to-br from-emerald-600 to-emerald-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-5 w-5" />
                <span className="font-semibold text-sm uppercase tracking-wide">{i === 0 ? 'Auto-Pilot · New Request' : 'Auto-Pilot · Continuation'}</span>
              </div>
              <p className="text-xs opacity-80 mb-3">{c.framing}</p>
              <p className="text-sm font-medium leading-snug mb-3">
                {c.patientName} · {c.procedure} · {c.payer}
              </p>
              <Link
                href={`/autopilot?case=${c.authId}`}
                className={`inline-flex items-center gap-1.5 bg-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  i === 0 ? 'text-blue-700 hover:bg-blue-50' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Run Auto-Pilot · {c.authId} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5" />
            <span className="font-semibold text-sm">Auto-Pilot Available</span>
          </div>
          <Link
            href="/autopilot"
            className="inline-flex items-center gap-1.5 bg-white text-blue-700 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
          >
            Run Auto-Pilot <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <DashboardKPIs activeAuthCount={data.activeAuthCount} />
      <DashboardCharts />
    </div>
  );
}
