// Runs the gear search off the main thread, so the simulator page stays responsive on big boxes. The page sends the
// simulator data once, then one request per search; each answer carries the request's id.
import type { BoxDoc } from '../box/store';
import type { DpsData } from './model';
import { optimise, type OptimiseOptions } from './optimise';

export type WorkerRequest =
  | { type: 'data'; data: DpsData }
  | { type: 'run'; id: number; box: BoxDoc; ownedId: number; opts: OptimiseOptions };
export type WorkerReply = { id: number; result: ReturnType<typeof optimise>; error?: string };

let data: DpsData | null = null;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'data') {
    data = msg.data;
    return;
  }
  try {
    const owned = msg.box.heroes.find((h) => h.id === msg.ownedId);
    const result = data && owned ? optimise(data, msg.box, owned, msg.opts) : null;
    (self as unknown as Worker).postMessage({ id: msg.id, result } satisfies WorkerReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: msg.id, result: null, error: String(err) } satisfies WorkerReply);
  }
};
