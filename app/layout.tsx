import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppNav } from '@/components/nav';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-slate-50">
        <TooltipProvider>
          <AppNav />
          <main className="flex-1 min-h-screen overflow-auto">
            {children}
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
