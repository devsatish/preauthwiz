'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

function CitationPill({ criterionId, sourceRef }: { criterionId: string; sourceRef: string }) {
  const [sourceType, sourceId] = sourceRef.split(':');
  return (
    <HoverCard>
      <HoverCardTrigger>
        <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 text-xs font-mono px-1.5 py-0.5 rounded cursor-help border border-blue-200 hover:bg-blue-200 transition-colors">
          {criterionId} / {sourceRef}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs">
        <div className="space-y-1.5">
          <p className="font-semibold text-slate-900">Inline Citation</p>
          <div className="flex gap-2 items-center">
            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{criterionId}</span>
            <span className="text-slate-500">Policy criterion ID</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">{sourceType}:{sourceId}</span>
            <span className="text-slate-500">Chart evidence source</span>
          </div>
          <p className="text-slate-500 pt-1 border-t border-slate-100">
            View the trace for full policy excerpt and chart evidence.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function renderCitations(text: string): React.ReactNode[] {
  const pattern = /\[([A-Z]\d+)\s*\/\s*([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [full, criterionId, sourceRef] = match;
    parts.push(
      <CitationPill
        key={`${match.index}-${full}`}
        criterionId={criterionId}
        sourceRef={sourceRef.trim()}
      />,
    );
    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

interface FinalReportProps {
  letter: string;
  isStreaming: boolean;
  runId?: string;
  verdict?: string;
  totalTokens?: number;
  costCents?: number;
  latencyMs?: number;
}

export function FinalReport({
  letter,
  isStreaming,
  runId,
  verdict,
  totalTokens,
  costCents,
  latencyMs,
}: FinalReportProps) {
  if (!letter && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">
          📋
        </div>
        <p>Final report will appear here</p>
      </div>
    );
  }

  const lines = letter.split('\n');

  return (
    <div className="space-y-3">
      {isStreaming && !letter && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}

      <div className="text-sm text-slate-700 space-y-1.5">
        {lines.map((line, i) => {
          if (line.startsWith('## ')) {
            return <h2 key={i} className="text-sm font-bold text-slate-900 mt-4 mb-1">{line.slice(3)}</h2>;
          }
          if (line.startsWith('# ')) {
            return <h1 key={i} className="text-base font-bold text-slate-900 mt-2 mb-1">{line.slice(2)}</h1>;
          }
          if (line.trim() === '') return <div key={i} className="h-1" />;
          return (
            <p key={i} className="leading-relaxed">
              {renderCitations(line)}
            </p>
          );
        })}
        {isStreaming && (
          <span className="inline-block h-4 w-0.5 bg-blue-500 animate-pulse ml-0.5" />
        )}
      </div>

      {verdict && runId && (
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>
            {totalTokens?.toLocaleString()} tokens ·{' '}
            ${((costCents ?? 0) / 100).toFixed(4)} ·{' '}
            {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '—'}
          </span>
          <Link href={`/autopilot/trace/${runId}`} className="flex items-center gap-1 text-blue-600 hover:underline">
            View full trace <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
