// Everything the Simulator needs (parsed skills, base stats, Awakening, sets, curves, Ulgorim stages), fetched
// by the page once.
import { dpsData } from '../lib/dps/data';

export function GET() {
  return new Response(JSON.stringify(dpsData()), { headers: { 'Content-Type': 'application/json' } });
}
