'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Bot,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { Persona } from '@/lib/auth/personas';
import { cn } from '@/lib/utils';

interface TourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
  persona: Persona;
}

interface Step {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to PreAuthWiz',
    body: 'Prior authorizations are the friction point in modern healthcare — 30+ minutes of chart reading, policy hunting, and letter drafting per case. PreAuthWiz collapses that to ~90 seconds. A 5-agent pipeline pulls the chart, matches payer policy, scores medical necessity, and drafts a justification letter you can sign — with every clinical claim cited back to the chart note or policy paragraph it came from.',
    icon: Sparkles,
    accent: 'bg-blue-50 text-blue-700',
  },
  {
    title: 'Auth Queue',
    body: 'Your incoming work, just like an EHR worklist. Filter by status, sort by deadline, and click any row to see the patient + clinical detail. New auths land here as the front desk submits them.',
    icon: ClipboardList,
    accent: 'bg-indigo-50 text-indigo-700',
  },
  {
    title: 'Auto-Pilot — the magic',
    body: 'Pick a case, hit Run, and watch five subagents work in parallel: Eligibility, Policy Researcher, Chart Abstractor, Risk Scorer, Letter Drafter. Live SSE stream shows every tool call and citation as it happens. Final output: a verdict, a score, and a draft letter ready for your signature.',
    icon: Zap,
    accent: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Trust the trace',
    body: 'Every Auto-Pilot run leaves a full trace: tool calls, retrieved policy chunks, supporting evidence with chart citations. If the AI gets it wrong, you can see exactly where — no black box. The eval harness on /evals proves it stays right across regression cases.',
    icon: ShieldCheck,
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Ask the assistant anything',
    body: 'Chat is your conversational layer. Ask "what\'s the status of auth-005?", "compare auth-005 and auth-013", or "summarize Aetna\'s Botox policy" — the assistant uses the same tools as Auto-Pilot, just on demand.',
    icon: Bot,
    accent: 'bg-violet-50 text-violet-700',
  },
];

export function TourDialog({ open, onOpenChange, onDismiss, persona }: TourDialogProps) {
  const [step, setStep] = useState(0);

  // Reset to step 0 whenever the dialog opens fresh.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  function close() {
    onOpenChange(false);
    onDismiss();
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
        className="sm:max-w-lg p-0 overflow-hidden"
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
                Step {step + 1} of {STEPS.length}
              </p>
              <DialogTitle className="text-base font-semibold text-slate-900 mt-0.5">
                {current.title}
              </DialogTitle>
            </div>
          </div>
          {/* Progress bar */}
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

        {/* Body */}
        <div className="px-6 py-5">
          <DialogDescription className="text-sm text-slate-600 leading-relaxed">
            {current.body}
          </DialogDescription>

          {step === 0 && (
            <p className="text-xs text-slate-500 mt-4 italic">
              Signed in as <span className="font-medium text-slate-700">{persona.fullName}</span> · {persona.role}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={close}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip tour
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
                  Got it
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
