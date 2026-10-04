// Lets phones install the site as an app (Add to Home Screen).
import type { APIRoute } from 'astro';
import { href } from '../lib/data';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: 'Invokers Companion',
      short_name: 'Invokers',
      description: 'Invokers, Titans, tier lists, events, summons and guides.',
      start_url: href('/'),
      scope: href('/'),
      display: 'standalone',
      background_color: '#0c0b1d',
      theme_color: '#0c0b1d',
      icons: [
        { src: href('icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: href('icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
        { src: href('icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: href('icons/icon.svg'), sizes: 'any', type: 'image/svg+xml' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
