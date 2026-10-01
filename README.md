# Invokers Companion

An unofficial fan site for Invokers, built from datamined game files.

| Folder | What it holds |
| --- | --- |
| `data/` | The exported data pack (JSON) |
| `schema/` | JSON Schemas for the data pack |
| `site/` | The website: a static [Astro](https://astro.build) site |

## Run it locally

```sh
cd site
npm install
npm run dev      # http://localhost:4321
npm run build    # type-check and build into site/dist
```

## CI

GitHub Actions type-checks and builds the site on every push to `main` and
every pull request (`.github/workflows/ci.yml`). The built site is attached to
each run as the `site` artifact. Hosting isn't set up yet; the site builds to
plain static files, so any static host works.

## Ratings and art

- Hero tiers are the site owner's own scores, kept in `site/src/data/ratings.json` as
  `{ "<hero id>": { "tier": "S", "note": "optional" } }`. Heroes without an
  entry show as not rated yet.
- Hero portraits go in `site/public/art/heroes/<hero id>.webp` (or `.png`/`.jpg`).
  Pages pick them up on the next build and show a placeholder until then.

## Ground rules

- Every page shows the game version and extraction date.
- Game art (portraits and icons) is allowed; the site owner decided on 2026-10-01 to publish it.
- No drop or upgrade predictions; the site shows what the data says.
