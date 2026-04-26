'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Zap,
  BarChart3,
  Users,
  Stethoscope,
  Bot,
  HelpCircle,
  LogOut,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Persona } from '@/lib/auth/personas';
import { TourDialog } from '@/components/tour-dialog';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/auth-queue', label: 'Auth Queue', icon: ClipboardList },
  { href: '/autopilot', label: 'Auto-Pilot', icon: Zap },
  { href: '/chat', label: 'Chat', icon: Bot },
  { href: '/evals', label: 'Evals', icon: BarChart3 },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/providers', label: 'Providers', icon: Stethoscope },
];

interface AppNavProps {
  persona: Persona;
  tourSeen: boolean;
}

export function AppNav({ persona, tourSeen }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  // Auto-open the tour dialog the first time a persona signs in. The
  // dialog itself is responsible for marking it seen on close.
  const [tourOpen, setTourOpen] = useState(!tourSeen);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, force a navigation — proxy.ts will redirect
      // back to /login if the cookie is still valid.
    }
    window.location.assign('/login');
  }

  return (
    <>
      <nav className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-screen">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900">PreAuthWiz</span>
            </Link>
            <button
              onClick={() => setTourOpen(true)}
              className="text-slate-400 hover:text-blue-600 transition-colors"
              aria-label="Take a tour"
              title="Take a tour"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Meridian Health</p>
        </div>

        {/* Nav items */}
        <div className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {item.href === '/autopilot' && (
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                    AI
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Tour CTA — only surfaces while it's still useful (i.e., user hasn't dismissed) */}
        {!tourSeen && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setTourOpen(true)}
              className="w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Take the 60-second tour
            </button>
          </div>
        )}

        {/* User block */}
        <div className="px-3 py-3 border-t border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', persona.avatarClass)}>
              {persona.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-900 truncate">{persona.fullName}</p>
              <p className="text-xs text-slate-500 truncate">{persona.role}</p>
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </nav>

      <TourDialog
        open={tourOpen}
        onOpenChange={setTourOpen}
        onDismiss={() => {
          // Persist "seen" so subsequent reloads don't auto-open.
          fetch('/api/auth/tour-seen', { method: 'POST' }).catch(() => {});
          // Refresh so server components re-read the cookie (hides the in-nav CTA).
          router.refresh();
        }}
        persona={persona}
      />
    </>
  );
}
