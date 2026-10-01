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

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). Pull requests only build it. Turn Pages on
once under Settings → Pages → Source: GitHub Actions.

## Ground rules

- Every page shows the game version and extraction date.
- No game art until the developer's fan-content policy has been checked.
- No drop or upgrade predictions; the site shows what the data says.
