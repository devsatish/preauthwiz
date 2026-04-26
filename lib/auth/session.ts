import { cookies } from 'next/headers';
import { findPersona, type Persona } from './personas';

export const SESSION_COOKIE = 'paw_session';
// Companion cookie — present once the tour has been dismissed at least once,
// so we know whether to auto-open the dialog after first sign-in.
export const TOUR_SEEN_COOKIE = 'paw_tour_seen';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function getCurrentPersona(): Promise<Persona | null> {
  const store = await cookies();
  return findPersona(store.get(SESSION_COOKIE)?.value);
}

export async function hasSeenTour(): Promise<boolean> {
  const store = await cookies();
  return store.get(TOUR_SEEN_COOKIE)?.value === '1';
}
