'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Zap,
  MessageSquare,
  BarChart3,
  Users,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/auth-queue', label: 'Auth Queue', icon: ClipboardList },
  { href: '/autopilot', label: 'Auto-Pilot', icon: Zap },
  { href: '/assistant', label: 'Assistant', icon: MessageSquare },
  { href: '/evals', label: 'Evals', icon: BarChart3 },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/providers', label: 'Providers', icon: Stethoscope },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900">PreAuthWiz</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Meridian Health</p>
      </div>

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

      <div className="px-4 py-3 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
            JA
          </div>
          <div>
            <p className="text-xs font-medium text-slate-900">Jamie Alvarez</p>
            <p className="text-xs text-slate-500">Intake Admin</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
