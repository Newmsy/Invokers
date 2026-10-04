// Service worker: keeps pages and images you've opened so they work offline and load fast on poor signal.
// Pages come from the network first (so they're never stale when online); images and built assets from the cache.
// A new data pack or build gets a new cache name, which clears the old one.
import type { APIRoute } from 'astro';
import { href, pack } from '../lib/data';

const version = `${pack.gameVersion}-${Date.now()}`;

const worker = (base: string, offline: string, precache: string[]) => `
const CACHE = 'invokers-${version}';
const BASE = ${JSON.stringify(base)};
const OFFLINE = ${JSON.stringify(offline)};
const PRECACHE = ${JSON.stringify(precache)};

// A redirected response can't answer a page load, so a redirect (e.g. adding a trailing slash) is stored unwrapped.
const unwrap = (res) => (res.redirected ? new Response(res.body, { status: res.status, headers: res.headers }) : res);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(PRECACHE.map((u) => fetch(u, { credentials: 'include' }).then((res) => res.ok && c.put(u, unwrap(res))))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('invokers-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(req) {
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const copy = unwrap(res.clone());
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(BASE) || url.pathname.startsWith('/_vercel/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fromNetwork(req).catch(async () => (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match(OFFLINE))),
    );
    return;
  }
  // Images and hashed build files never change under the same URL.
  if (url.pathname.startsWith(BASE + 'img/') || url.pathname.startsWith(BASE + '_astro/') || url.pathname.startsWith(BASE + 'icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit ?? fromNetwork(req)));
    return;
  }
  // Everything else (search index, data files): cached copy now, fresh copy for next time.
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fromNetwork(req).catch(() => hit);
      return hit ?? fresh;
    }),
  );
});
`;

export const GET: APIRoute = () => {
  const base = href('/');
  return new Response(worker(base, href('offline'), [href('/'), href('offline'), href('icons/icon-192.png')]), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
  });
};
