# Data pack

Exported from the game files by the datamining side. The site reads these
files at build time and never writes to them.

- `manifest.json`: game version, extraction date, schema version. Every page
  shows the game version and extraction date from here.
- One JSON file per domain: `heroes`, `skills`, `combos`, `events`, `gear`,
  `sets`, `items`, `stats`. Only `heroes.json` and `events.json` exist so far,
  as empty placeholders.

Field definitions go in `../schema/`.
