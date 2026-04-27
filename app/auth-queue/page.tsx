import Link from 'next/link';
import { db } from '@/lib/db/client';
import { priorAuths, patients, providers, authRuns } from '@/lib/db/schema';
import { eq, desc, ilike, and, sql, type SQL } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface QueueRow {
  authId: string;
  cptCode: string;
  dxCodes: string[];
  status: string;
  payerId: string;
  planName: string;
  notes: string | null;
  createdAt: Date;
  patientFirst: string;
  patientLast: string;
  patientMrn: string;
  providerName: string;
  providerSpecialty: string;
  latestRunId: string | null;
  latestVerdict: string | null;
  latestCostCents: string | null;
  latestLatencyMs: number | null;
  latestCompletedAt: Date | null;
}

function VerdictPill({ verdict }: { verdict: string | null }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';
  if (verdict === 'auto_approve_eligible') return <span className={`${base} bg-green-100 text-green-800 border-green-200`}>auto-approve</span>;
  if (verdict === 'escalate_for_review') return <span className={`${base} bg-amber-100 text-amber-800 border-amber-200`}>escalate</span>;
  if (verdict === 'recommend_deny') return <span className={`${base} bg-red-100 text-red-800 border-red-200`}>deny</span>;
  if (verdict === 'recommend_approve') return <span className={`${base} bg-blue-100 text-blue-800 border-blue-200`}>approve</span>;
  return <span className={`${base} bg-slate-100 text-slate-500 border-slate-200`}>not processed</span>;
}

function relativeTime(d: Date): string {
  const ageMs = Date.now() - d.getTime();
  const min = Math.floor(ageMs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 7) return d.toISOString().slice(0, 10);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return 'just now';
}

interface FilterState {
  status?: string;
  payer?: string;
  search?: string;
  sort?: 'created' | 'verdict';
}

export default async function AuthQueuePage(props: PageProps<'/auth-queue'>) {
  const params = await props.searchParams;
  const filter: FilterState = {
    status: typeof params.status === 'string' ? params.status : 'all',
    payer: typeof params.payer === 'string' ? params.payer : 'all',
    search: typeof params.search === 'string' ? params.search : '',
    sort: params.sort === 'verdict' ? 'verdict' : 'created',
  };

  // Latest auth_run per prior_auth via DISTINCT ON. Subquery rather than ORM-side
  // window to keep the SQL straightforward; result joined back as latest_run.
  const latestRunSub = sql`(
    SELECT DISTINCT ON (prior_auth_id)
      id, prior_auth_id, verdict, total_cost_cents, completed_at, started_at
    FROM auth_runs
    ORDER BY prior_auth_id, started_at DESC
  )`;

  const whereClauses: SQL[] = [];
  // Always exclude eval-harness test fixtures from the user-facing queue.
  // Real auths use auth-NNN (digits only); test fixtures use auth-UPPERCASE-LABEL.
  whereClauses.push(sql`${priorAuths.id} ~ '^auth-[0-9]+$'`);
  if (filter.status && filter.status !== 'all') {
    whereClauses.push(eq(priorAuths.status, filter.status));
  }
  if (filter.payer && filter.payer !== 'all') {
    whereClauses.push(eq(priorAuths.payerId, filter.payer));
  }
  if (filter.search) {
    const needle = `%${filter.search}%`;
    whereClauses.push(
      sql`(${ilike(patients.firstName, needle)} OR ${ilike(patients.lastName, needle)} OR ${ilike(patients.mrn, needle)} OR ${ilike(priorAuths.id, needle)})`,
    );
  }

  const baseQuery = db
    .select({
      authId: priorAuths.id,
      cptCode: priorAuths.cptCode,
      dxCodes: priorAuths.dxCodes,
      status: priorAuths.status,
      payerId: priorAuths.payerId,
      planName: priorAuths.planName,
      notes: priorAuths.notes,
      createdAt: priorAuths.createdAt,
      patientFirst: patients.firstName,
      patientLast: patients.lastName,
      patientMrn: patients.mrn,
      providerName: providers.name,
      providerSpecialty: providers.specialty,
      latestRunId: sql<string | null>`latest_run.id`,
      latestVerdict: sql<string | null>`latest_run.verdict`,
      latestCostCents: sql<string | null>`latest_run.total_cost_cents`,
      latestLatencyMs: sql<number | null>`EXTRACT(EPOCH FROM (latest_run.completed_at - latest_run.started_at)) * 1000`,
      latestCompletedAt: sql<Date | null>`latest_run.completed_at`,
    })
    .from(priorAuths)
    .innerJoin(patients, eq(priorAuths.patientId, patients.id))
    .innerJoin(providers, eq(priorAuths.providerId, providers.id))
    .leftJoin(sql`${latestRunSub} AS latest_run`, sql`latest_run.prior_auth_id = ${priorAuths.id}`);

  const filtered = whereClauses.length > 0 ? baseQuery.where(and(...whereClauses)) : baseQuery;
  const sorted = filter.sort === 'verdict'
    ? filtered.orderBy(sql`latest_run.verdict NULLS LAST`, desc(priorAuths.createdAt))
    : filtered.orderBy(desc(priorAuths.createdAt));
  const rows = (await sorted) as unknown as QueueRow[];

  // Stats — computed client-side from the unfiltered set is more useful, but the
  // filtered set matches what the user sees. Going with filtered for consistency.
  const total = rows.length;
  const byVerdict = {
    auto_approve_eligible: rows.filter(r => r.latestVerdict === 'auto_approve_eligible').length,
    escalate_for_review: rows.filter(r => r.latestVerdict === 'escalate_for_review').length,
    recommend_deny: rows.filter(r => r.latestVerdict === 'recommend_deny').length,
    not_processed: rows.filter(r => r.latestVerdict === null).length,
  };

  // Distinct payers + statuses for filter dropdowns — derive from current rowset.
  const allRowsForFilters = filter.status === 'all' && filter.payer === 'all' && !filter.search
    ? rows
    : ((await db
        .select({ status: priorAuths.status, payerId: priorAuths.payerId })
        .from(priorAuths)
        .where(sql`${priorAuths.id} ~ '^auth-[0-9]+$'`)) as Array<{ status: string; payerId: string }>);
  const distinctStatuses = Array.from(new Set(allRowsForFilters.map(r => r.status))).sort();
  const distinctPayers = Array.from(new Set(allRowsForFilters.map(r => r.payerId))).sort();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-4 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">Prior Authorization Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">All prior auths joined with their most recent orchestrator run, if any.</p>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <Stat label="Total" value={String(total)} />
          <Stat label="Auto-approve" value={String(byVerdict.auto_approve_eligible)} accent="green" />
          <Stat label="Escalate" value={String(byVerdict.escalate_for_review)} accent="amber" />
          <Stat label="Deny" value={String(byVerdict.recommend_deny)} accent="red" />
          <Stat label="Unprocessed" value={String(byVerdict.not_processed)} accent="slate" />
        </div>
      </div>

      {/* Filters */}
      <form action="/auth-queue" method="get" className="border border-slate-200 rounded-lg bg-white px-5 py-3 flex items-end gap-3 flex-wrap">
        <FilterDropdown name="status" label="Status" current={filter.status ?? 'all'} options={['all', ...distinctStatuses]} />
        <FilterDropdown name="payer" label="Payer" current={filter.payer ?? 'all'} options={['all', ...distinctPayers]} />
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Search</label>
          <input
            type="text"
            name="search"
            defaultValue={filter.search ?? ''}
            placeholder="patient name, MRN, or auth id…"
            className="text-xs px-2 py-1.5 border border-slate-300 rounded min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <FilterDropdown name="sort" label="Sort by" current={filter.sort ?? 'created'} options={['created', 'verdict']} />
        <button
          type="submit"
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Apply
        </button>
        {(filter.status !== 'all' || filter.payer !== 'all' || filter.search) && (
          <Link href="/auth-queue" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">{total} {total === 1 ? 'auth' : 'auths'}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <div className="px-5 py-6 text-xs text-slate-400 text-center">No auths match the current filters.</div>
          )}
          {rows.map(r => {
            const cost = r.latestCostCents !== null ? `$${(Number(r.latestCostCents) / 100).toFixed(3)}` : null;
            const lat = r.latestLatencyMs !== null ? `${(Number(r.latestLatencyMs) / 1000).toFixed(1)}s` : null;
            return (
              <div key={r.authId} className="px-5 py-3 text-xs">
                <div className="flex items-baseline gap-3 flex-wrap">
                  {/* Patient is the primary identifier. Auth ID is internal —
                      demoted to a small mono caption under the MRN. The whole
                      patient block links to autopilot for that case. */}
                  <Link
                    href={`/autopilot?case=${r.authId}`}
                    className="min-w-[200px] shrink-0 group"
                    title={`Open ${r.authId} in Auto-Pilot`}
                  >
                    <p className="text-slate-800 font-medium group-hover:text-blue-700 group-hover:underline">
                      {r.patientFirst} {r.patientLast}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">{r.patientMrn}</p>
                    <p className="text-slate-400 font-mono text-[10px] mt-0.5">{r.authId}</p>
                  </Link>
                  <div className="text-slate-500 min-w-[140px]">
                    <p>{r.providerName}</p>
                    <p className="text-slate-400 text-xs">{r.providerSpecialty}</p>
                  </div>
                  <div className="text-slate-500 min-w-[120px]">
                    <p className="font-mono">{r.payerId}</p>
                    <p className="text-slate-400 text-xs truncate">{r.planName}</p>
                  </div>
                  <div className="text-slate-500 min-w-[120px]">
                    <p className="font-mono">{r.cptCode}</p>
                    <p className="text-slate-400 text-xs font-mono">{r.dxCodes.join(', ')}</p>
                  </div>
                  <div className="min-w-[120px]">
                    <VerdictPill verdict={r.latestVerdict} />
                    {cost && lat && (
                      <p className="text-slate-400 text-xs mt-1 font-mono">{cost} · {lat}</p>
                    )}
                  </div>
                  <span className="text-slate-400 text-xs ml-auto">{relativeTime(r.createdAt)}</span>
                  {r.latestRunId && (
                    <Link href={`/autopilot/trace/${r.latestRunId}`} className="text-blue-600 hover:underline text-xs">
                      trace
                    </Link>
                  )}
                </div>
                {r.notes && (
                  <p className="text-slate-500 mt-1 text-xs italic line-clamp-1">{r.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({ name, label, current, options }: { name: string; label: string; current: string; options: string[] }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{label}</label>
      <select
        name={name}
        defaultValue={current}
        className="text-xs px-2 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'amber' | 'red' | 'slate' }) {
  const color =
    accent === 'green' ? 'text-green-700'
      : accent === 'amber' ? 'text-amber-700'
      : accent === 'red' ? 'text-red-700'
      : 'text-slate-700';
  return (
    <div>
      <p className="text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}
