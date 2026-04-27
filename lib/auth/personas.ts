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
  // How to address this persona in greetings. Physicians get "Dr. Lastname";
  // admins get first name. Set per-persona so we don't have to infer titles
  // from fullName at every call site.
  greetingName: string;
  // Login-screen-only fields. The login page is editorial in style and frames
  // each persona by their workflow ("01 / PHYSICIAN", chart · score · letter).
  // These don't show up anywhere else in the app.
  loginNumber: string;
  loginCategory: string;
  loginTagline: string;
  loginTags: string[];
}

// The physician persona is listed first on the login screen because the demo
// flow naturally starts with the reviewer perspective.
export const PERSONAS: Persona[] = [
  {
    // Persona id stays 'aisha' so existing session cookies keep working without
    // forcing a re-login after the rename. Display name is decoupled.
    id: 'aisha',
    firstName: 'Emily',
    lastName: 'Carter',
    fullName: 'Dr. Emily Carter',
    initials: 'EC',
    role: 'Medical Reviewer',
    roleShort: 'Reviewer',
    bio: 'Reviews AI verdicts, signs off on auto-approves, owns peer-to-peer escalations.',
    avatarClass: 'bg-emerald-100 text-emerald-700',
    greetingName: 'Dr. Carter',
    loginNumber: '01',
    loginCategory: 'Physician',
    loginTagline: 'Scoring, citations, and draft letter beside the chart. Sign or send back.',
    loginTags: ['chart', 'score', 'letter'],
  },
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
    greetingName: 'Jamie',
    loginNumber: '02',
    loginCategory: 'Office Staff',
    loginTagline: 'Build the case packet — eligibility, demographics, chart. Hand off to the physician queue.',
    loginTags: ['intake', 'packet', 'queue'],
  },
];

export function findPersona(id: string | undefined | null): Persona | null {
  if (!id) return null;
  return PERSONAS.find(p => p.id === id) ?? null;
}
