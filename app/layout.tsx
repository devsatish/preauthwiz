import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
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

// Editorial serif. Loaded globally as a CSS variable so the login page, side-nav
// brand mark, and dashboard greeting can all reference the same font without
// re-downloading. Used sparingly — the bulk of the app stays Geist sans.
const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
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
