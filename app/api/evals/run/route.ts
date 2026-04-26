import { NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST() {
  // Phase 4: will run the full eval suite
  return NextResponse.json({ message: 'Eval runner not yet implemented — coming in Phase 4' }, { status: 501 });
}
