# Plan Template & Current Plan

Use this template before non-trivial changes to capture scope, files, anchors, risks, and checks.

## Template
- **Scope + non-goals:** describe what the change covers and what it deliberately omits.
- **Affected entry points/files:** list the modules/resources (with search pointers) that will be touched.
- **Relevant AICODE anchors to read/update:** mention existing anchors (`rg -n "AICODE-"`) that should change.
- **Risks/contracts to preserve:** note invariants or sharp edges that need attention.
- **Test/check list:** enumerate commands or manual checks to run.

---

## Current Plan (Phases 5-6: search + cross-db polish)

### Scope + non-goals
- **Scope:** implement the search workflow (t21-t23) with debounce, grouped results, and tree integration, and add the cross-database pricing/navigation helpers (t24-t27) that enrich resource rows with fsbts data, allow navigation to resource references, and capture back/forward history.
- **Non-goals:** future extension tasks (filters, export, favorites) remain in Phase 7+; we do not add automated tests beyond manual scenario checks.

### Affected entry points/files
- `app/js/search.js` (debounced input handler, search orchestration, grouped result payloads).
- `app/js/api.js` (search query enhancements + resource pricing/reference helpers, catalog lookup utilities).
- `app/js/navigation.js` (history stacks, resource selection, breadcrumb context, and resource price enrichment).
- `app/js/ui.js` (search-results rendering, resource table status badges, history buttons, and dual work/resource detail views).
- `app/js/main.js` (wiring search results + history controls into Navigation/UI events).
- `app/index.html`, `app/css/style.css` (new history controls, search-results panel, and resource status styles).
- `docs/TASKS.md` (mark t21-t27 done and capture short completion notes).
- `docs/status.md` (record search + cross-db accomplishments and update focus/next-up lines).

### Relevant AICODE anchors to read/update
- Update `AICODE-NOTE: STATUS/FOCUS` + `AICODE-NOTE: STATUS/ENTRY` in `docs/status.md` to point to the new Phase 7 targets (t28-t30, t31+).
- Keep every ASCII-only anchor (`AGENTS.md`, `README.md`, `docs/context.md`, etc.) discoverable via `rg -n "AICODE-"`.
- After touching docs, re-run `rg -n "AICODE-" README.md docs/*.md`.

### Risks/contracts to preserve
- Maintain `docs/context.md` invariant (`AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT keep README/docs/context/docs/status/docs/decisions present [2025-10-05]`).
- Preserve `CONFIG` values (baseURL, timeouts, pageSize) so API consumers in other modules do not break.
- Ensure history/navigation interactions do not leave the tree or resource panel in a mismatched state when switching databases/search hits.

### Test/check list
- After editing docs, run `rg -n "AICODE-" README.md docs/*.md`.
- Manually verify: search input respects debounce, grouped results appear, clicking a hit loads the correct database and expands the tree; resources show price badges and click into fsbts references; history buttons go back/forward between work/resource.
- Confirm `docs/TASKS.md` marks t21-t27 complete and `docs/status.md` reflects the new focus.
