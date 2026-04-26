import { db } from '@/lib/db/client';
import { patients, priorAuths } from '@/lib/db/schema';
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

export default async function PatientsPage() {
  let rows: Awaited<ReturnType<typeof fetchPatients>> = [];
  try {
    rows = await fetchPatients();
  } catch {
    // DB not yet configured — rows stays empty, page renders empty state
  }

  return renderPage(rows);
}

async function fetchPatients() {
  return db
    .select({
      id: patients.id,
      mrn: patients.mrn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dob: patients.dob,
      sex: patients.sex,
      planId: patients.planId,
      planName: patients.planName,
      payerId: patients.payerId,
      dxCodes: patients.dxCodes,
      phone: patients.phone,
      authCount: count(priorAuths.id),
    })
    .from(patients)
    .leftJoin(priorAuths, eq(priorAuths.patientId, patients.id))
    .groupBy(patients.id);
}

function renderPage(rows: Awaited<ReturnType<typeof fetchPatients>>) {

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-slate-500 text-sm mt-1">{rows.length} patients total</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((patient) => {
          const initials =
            (patient.firstName[0] ?? '').toUpperCase() +
            (patient.lastName[0] ?? '').toUpperCase();
          const colorClass = avatarColor(patient.firstName);
          const visibleDx = patient.dxCodes.slice(0, 3);
          const extraDx = patient.dxCodes.length - visibleDx.length;

          return (
            <Card key={patient.id}>
              <CardContent className="flex flex-col gap-3 pt-4">
                {/* Avatar + Name row */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorClass}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-slate-500 text-xs">{patient.sex}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <Badge variant="secondary">{patient.authCount} auths</Badge>
                  </div>
                </div>

                {/* Details */}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-400 font-medium">MRN</dt>
                  <dd>
                    <Badge variant="outline">{patient.mrn}</Badge>
                  </dd>

                  <dt className="text-slate-400 font-medium">Plan</dt>
                  <dd className="text-slate-500 truncate">{patient.planName}</dd>

                  <dt className="text-slate-400 font-medium">Payer ID</dt>
                  <dd className="text-slate-600">{patient.payerId}</dd>

                  <dt className="text-slate-400 font-medium">DOB</dt>
                  <dd className="text-slate-600">{patient.dob}</dd>

                  {patient.phone && (
                    <>
                      <dt className="text-slate-400 font-medium">Phone</dt>
                      <dd className="text-slate-600">{patient.phone}</dd>
                    </>
                  )}
                </dl>

                {/* DX code chips */}
                {visibleDx.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {visibleDx.map((dx) => (
                      <Badge key={dx} variant="secondary" className="text-xs">
                        {dx}
                      </Badge>
                    ))}
                    {extraDx > 0 && (
                      <Badge variant="outline" className="text-xs">
                        +{extraDx} more
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}  // end renderPage
