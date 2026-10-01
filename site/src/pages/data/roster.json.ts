import { roster } from '../../lib/roster';

export function GET() {
  return new Response(JSON.stringify(roster()), { headers: { 'Content-Type': 'application/json' } });
}
