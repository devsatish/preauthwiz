'use client';

import { CheckCircle, Loader2, Circle, Shield, Search, ClipboardList, BarChart2, FileText, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export interface AgentState {
  name: string;
  label: string;
  role: string;
  model: string;
  tool: string;
  status: AgentStatus;
  callCount: number;
}

const AGENT_ICONS = {
  eligibilitySpecialist: Shield,
  policyResearcher: Search,
  chartAbstractor: ClipboardList,
  riskScorer: BarChart2,
  justificationDrafter: FileText,
};

export function TopologyView({ agents }: { agents: AgentState[] }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {/* Orchestrator */}
      <div className="bg-slate-800 text-white rounded-lg px-5 py-3 text-center shadow">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Orchestrator</p>
        <p className="font-semibold text-sm mt-0.5">TypeScript Control Flow</p>
        <p className="text-xs text-slate-400 mt-0.5">Stages 1–2 parallel · 3–5 sequential</p>
      </div>

      <ArrowDown className="h-5 w-5 text-slate-400" />

      {/* Subagent cards */}
      <div className="flex gap-3 flex-wrap justify-center">
        {agents.map((agent) => {
          const Icon = AGENT_ICONS[agent.name as keyof typeof AGENT_ICONS] ?? Circle;
          return (
            <div
              key={agent.name}
              className={cn(
                'bg-white border rounded-lg p-3 w-40 transition-all duration-300 shadow-sm',
                agent.status === 'idle' && 'border-slate-200 opacity-70',
                agent.status === 'running' && 'border-blue-400 ring-2 ring-blue-100',
                agent.status === 'complete' && 'border-green-400',
                agent.status === 'error' && 'border-red-400',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={cn(
                  'h-4 w-4',
                  agent.status === 'idle' && 'text-slate-400',
                  agent.status === 'running' && 'text-blue-500',
                  agent.status === 'complete' && 'text-green-500',
                  agent.status === 'error' && 'text-red-500',
                )} />
                {agent.status === 'running' && (
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                )}
                {agent.status === 'complete' && (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                )}
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-tight">{agent.label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{agent.role}</p>
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                <p className="text-xs text-slate-400 font-mono">{agent.tool}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {agent.model}
                  </span>
                  {agent.callCount > 0 && (
                    <span className="text-xs text-slate-400">{agent.callCount}×</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
