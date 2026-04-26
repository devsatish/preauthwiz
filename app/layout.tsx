import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/app-shell';
import { getCurrentPersona, hasSeenTour } from '@/lib/auth/session';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PreAuthWiz — Meridian Health',
  description: 'Agentic prior authorization assistant for Meridian Health',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const persona = await getCurrentPersona();
  const tourSeen = await hasSeenTour();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50">
        <TooltipProvider>
          <AppShell persona={persona} tourSeen={tourSeen}>
            {children}
          </AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
