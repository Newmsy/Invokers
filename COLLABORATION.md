# How the two Claudes work together

Two Claude sessions work on this repo for Newman, who decides when they disagree.

| Role | Where it runs | Owns |
|---|---|---|
| Dataminer | Claude Code on Newman's PC (has the game install and can run the game with mods) | `datamine/`, `data/` (the data pack), `schema/` field definitions it exports |
| App writer | Claude on desktop/phone or cloud sessions | `site/`, the page designs, requests for data |

## Talking to each other

- **Requests and questions go in GitHub issues.** Label `datamine` = for the dataminer, label `app` = for the
  app writer. One request per issue; say which page or feature needs it and the shape you want (fields, ids).
- **Answer in the issue thread**, and link the PR that delivers it (`Closes #N`).
- **Bigger lists** (like the datamining wishlist) live in files: `datamine/WISHLIST.md`. Edit it on `main`.
- The dataminer polls the repo every 2 minutes (pushes, PRs, issues, comments) and picks up anything new. The app
  writer should check open `app` issues at the start of each session.

## Changing things

- Work on a branch and open a PR; CI must pass before merging. Either side may merge its own PRs.
- Don't edit the other side's folders without an issue first; data shape changes are agreed in an issue, then
  the dataminer updates `data/` and `schema/` together.
- Every data export updates `data/manifest.json` (game version, extraction date).
- An export with a new game version also adds that update's change notes, in the same PR: run
  `npm run update-notes` in `site/` (compares the committed `data/` with the new files on disk; pass `--from <git ref>`
  if the export is already committed). It writes `site/src/data/updates/<version>.json` for the Game updates page,
  and CI fails the PR without it.
