import { db } from '@/lib/db/client';
import { priorAuths } from '@/lib/db/schema';
import { eq, or, count } from 'drizzle-orm';
import { format } from 'date-fns';
import { DashboardKPIs } from '@/components/dashboard/kpis';
import { DashboardCharts } from '@/components/dashboard/charts';
import { AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

async function getDashboardData() {
  try {
    const [activeCountResult] = await db
      .select({ count: count() })
      .from(priorAuths)
      .where(
        or(
          eq(priorAuths.status, 'pending'),
          eq(priorAuths.status, 'needs_info'),
          eq(priorAuths.status, 'p2p_required'),
        )!
      );
    return { activeAuthCount: activeCountResult?.count ?? 0 };
  } catch {
    return { activeAuthCount: 7 };
  }
}

export default async function DashboardPage() {
  const { activeAuthCount } = await getDashboardData();
  const today = format(new Date(), 'MMMM d, yyyy');

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Good afternoon, Jamie</h1>
        <p className="text-slate-500 mt-1">
          Meridian Health · {today} · {activeAuthCount} auth{activeAuthCount !== 1 ? 's' : ''} need your attention today
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">AI caught 4 issues this morning</span> — 2 missing documentation requests, 1 eligibility mismatch, 1 dosing flag.
        </p>
        <Link href="/evals" className="ml-auto text-xs text-amber-700 hover:underline font-medium whitespace-nowrap flex items-center gap-1">
          View report <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-5 w-5" />
          <span className="font-semibold text-sm">Auto-Pilot Available</span>
        </div>
        <p className="text-blue-100 text-sm mb-4">
          Aaliyah Johnson · J0585 Botox for Chronic Migraine · Aetna Open Access Select PPO is ready for Auto-Pilot processing.
        </p>
        <Link
          href="/autopilot"
          className="inline-flex items-center gap-1.5 bg-white text-blue-700 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
        >
          Run Auto-Pilot <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <DashboardKPIs activeAuthCount={activeAuthCount} />
      <DashboardCharts />
    </div>
  );
}
