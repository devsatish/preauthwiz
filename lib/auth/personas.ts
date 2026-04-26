// Demo persona registry. There's no real auth — sign-in is a persona picker
// so reviewers can see "what does this look like for an intake admin vs a
// medical reviewer." Adding a new persona = appending an entry here.

export type PersonaId = 'jamie' | 'aisha';

export interface Persona {
  id: PersonaId;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  role: string;
  roleShort: string;
  bio: string;
  // Tailwind avatar tint — kept in sync with the rest of the app's avatar palette.
  avatarClass: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'jamie',
    firstName: 'Jamie',
    lastName: 'Alvarez',
    fullName: 'Jamie Alvarez',
    initials: 'JA',
    role: 'Intake Admin',
    roleShort: 'Intake',
    bio: 'Triages incoming auths, collects missing chart data, escalates edge cases.',
    avatarClass: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'aisha',
    firstName: 'Aisha',
    lastName: 'Patel',
    fullName: 'Dr. Aisha Patel',
    initials: 'AP',
    role: 'Medical Reviewer',
    roleShort: 'Reviewer',
    bio: 'Reviews AI verdicts, signs off on auto-approves, owns peer-to-peer escalations.',
    avatarClass: 'bg-emerald-100 text-emerald-700',
  },
];

export function findPersona(id: string | undefined | null): Persona | null {
  if (!id) return null;
  return PERSONAS.find(p => p.id === id) ?? null;
}
