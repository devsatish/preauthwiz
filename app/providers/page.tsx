import { db } from '@/lib/db/client';
import { providers, priorAuths } from '@/lib/db/schema';
import { count, eq } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default async function ProvidersPage() {
  let rows: Awaited<ReturnType<typeof fetchProviders>> = [];
  try {
    rows = await fetchProviders();
  } catch {
    // DB not yet configured
  }

  return renderPage(rows);
}

async function fetchProviders() {
  return db
    .select({
      id: providers.id,
      npi: providers.npi,
      name: providers.name,
      specialty: providers.specialty,
      organization: providers.organization,
      authCount: count(priorAuths.id),
    })
    .from(providers)
    .leftJoin(priorAuths, eq(priorAuths.providerId, providers.id))
    .groupBy(providers.id);
}

function renderPage(rows: Awaited<ReturnType<typeof fetchProviders>>) {

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-slate-500 text-sm mt-1">{rows.length} providers total</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((provider) => {
          const nameParts = provider.name.trim().split(/\s+/);
          const initials =
            nameParts.length >= 2
              ? (nameParts[0][0] ?? '').toUpperCase() +
                (nameParts[nameParts.length - 1][0] ?? '').toUpperCase()
              : (provider.name[0] ?? '').toUpperCase();
          const colorClass = avatarColor(provider.name);

          return (
            <Card key={provider.id}>
              <CardContent className="flex flex-col gap-3 pt-4">
                {/* Avatar + Name row */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorClass}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate">{provider.name}</p>
                  </div>
                  <div className="shrink-0">
                    <Badge variant="secondary">{provider.authCount} auths</Badge>
                  </div>
                </div>

                {/* Specialty badge */}
                <div>
                  <Badge variant="outline">{provider.specialty}</Badge>
                </div>

                {/* Details */}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-400 font-medium">Organization</dt>
                  <dd className="text-slate-600 truncate">{provider.organization}</dd>

                  <dt className="text-slate-400 font-medium">NPI</dt>
                  <dd className="text-slate-600">{provider.npi}</dd>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}  // end renderPage
