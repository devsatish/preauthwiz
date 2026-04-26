'use client';

import { usePathname } from 'next/navigation';
import { AppNav } from '@/components/nav';
import type { Persona } from '@/lib/auth/personas';

interface AppShellProps {
  persona: Persona | null;
  tourSeen: boolean;
  children: React.ReactNode;
}

// The shell decides whether to render the side nav. The /login page is
// intentionally chrome-free (full-bleed marketing layout), and any other
// unauthenticated route would also skip the nav since proxy.ts redirects
// those to /login before they render.
export function AppShell({ persona, tourSeen, children }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage || !persona) {
    return <>{children}</>;
  }

  return (
    // h-screen + overflow-hidden locks the shell to viewport height; main
    // scrolls internally. Without this, long pages (auth queue, trace) push
    // the side-nav footer below the fold.
    <div className="flex h-screen overflow-hidden">
      <AppNav persona={persona} tourSeen={tourSeen} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
