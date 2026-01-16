<!-- AICODE-NOTE: STATUS/FOCUS focus: navigation state + UI wiring (t13-t20) ref: docs/TASKS.md -->
<!-- AICODE-NOTE: STATUS/ENTRY next: search + cross-db resources (t21-t27) ref: docs/TASKS.md -->

# Status

## Latest accomplishments
- Captured the initial plan in `docs/plan-template.md` and confirmed the BaseX import steps listed in `docs/TASKS.md`.
- Created all required BaseX databases (`gesn`, `gesnm`, `gesnmr`, `gesnp`, `gesnr`, `fsbts_mat`, `fsbts_mash`) from the XML sources.
- Scaffolded the `app/` layout including `app/index.html` with Bootstrap panels, the starter CSS bundle, and stub JS modules that render placeholders.
- Attempted `./bin/basexhttp -d -l -h 8080` to expose `http://localhost:8080`, but the sandbox blocks listening sockets (`java.net.SocketException: Operation not permitted`); recorded the limitation for future testing.
- Finished the initial CSS layout pass (panels, tree, details, responsive) and completed the BaseX `CONFIG` metadata list.
- Delivered the BaseX API module (fetch with timeout, DOMParser-based parsing, section/work/search wrappers, and TTL caching) so navigation can rely on real data.

## Current focus
- Build the navigation state layer (`currentDatabase`, `path`, `expanded`, `selected`) and position it to emit events for UI updates (t13-t16).
- Start wiring UI pieces (database list, tree placeholder, details/breadcrumbs) to respond to navigation state without yet rendering real data (t16-t20).

## Next up (after navigation docs)
1. Draft the search module (debounce + grouped results) and connect it to the new `search` wrapper plus tree navigation (t21-t23).
2. Layer in cross-db resource linking, price lookups, and history/navigation helpers after search works (t24-t27).
3. Continue tracking `AICODE-*` anchors (`rg -n "AICODE-" README.md docs/*.md`) after every significant edit.
