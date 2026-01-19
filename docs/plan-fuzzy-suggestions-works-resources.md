<!-- AICODE-NOTE: NAV/PLAN_FUZZY_WORKS_RESOURCES plan: fuzzy suggestions for works/resources in search input ref: AGENTS.md -->
# Plan: Fuzzy Suggestions for Works + Resources

## Scope + non-goals
- **Scope:** add fuzzy suggestions for Work and Resource entities alongside existing Section suggestions, with grouping, caching, and safe request limits; keep existing search results rendering intact.
- **Non-goals:** no changes to full search results ranking, no redesign of UI layout, no new global search indexing service, and no changes to BaseX schema/import.

## Affected entry points/files
- `app/js/search.js` (suggestion pipeline: token extraction, scoring, merging multiple suggestion sources).
- `app/js/api.js` (new lightweight queries for Work/Resource suggestion sources and parsers).
- `app/js/ui.js` (render grouped suggestions: sections/works/resources; click handling).
- `app/js/main.js` (wire suggestion handlers to new entity types).
- `app/js/config.js` (optional limits/flags for suggestion sources).
- `docs/status.md` (update focus if this becomes current work).

## Relevant AICODE anchors to read/update
- `docs/context.md` (`AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT keep README/docs/context/docs/status/docs/decisions present [2025-10-05]`).
- `docs/status.md` (`AICODE-NOTE: STATUS/FOCUS`/`STATUS/ENTRY` if focus shifts).
- After doc edits run: `rg -n "AICODE-" README.md docs/*.md`.

## Risks/contracts to preserve
- Preserve `AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT ... [2025-10-05]`.
- Avoid UI slowdowns: suggestions must remain responsive and debounced.
- Do not break current `registerSearch` flow or `#search-results` rendering.
- Keep network load bounded (limit suggestions, cache per DB, avoid full scans on each keystroke).

## Test/check list
- Manual: type a short token that matches a Section/Work/Resource and confirm grouped suggestions show up.
- Manual: click each suggestion type and verify the input is updated and results panel still works.
- Manual: switch databases and confirm suggestions reflect the active DB.
- Manual: check DevTools for BaseX query errors/timeouts and no console exceptions.
- Docs: `rg -n "AICODE-" README.md docs/*.md` after edits.

## Implementation plan

### Phase 1: Data sources + API
- Add API helpers to fetch suggestion candidates for Works and Resources (limit + lightweight fields only: code, name, section path).
- Implement parsers similar to `parseSectionIndex`, returning normalized data for scoring.
- Add caching and TTL using existing cache infrastructure; ensure requests are per-database.

### Phase 2: Search logic
- Extend `registerSearch` to request Work/Resource suggestions alongside Section suggestions.
- Reuse normalization and fuzzy scoring; apply source-specific thresholds (e.g., higher threshold for resources).
- Merge suggestion results into a single structure with source labels (section/work/resource) and stable ordering.

### Phase 3: UI rendering
- Update `renderSearchSuggestions` to show grouped lists (e.g., headings for sections/works/resources).
- Ensure each suggestion type carries enough metadata to apply selection (e.g., work code to jump).
- Keep layout compact and keyboard/mouse behavior consistent.

### Phase 4: Selection behavior
- For Section suggestion: keep current behavior (replace last token).
- For Work suggestion: set input to work code or title and optionally trigger selection flow.
- For Resource suggestion: set input to resource code or title; optionally route to resource details.
- Keep this behavior configurable via `CONFIG` flags (e.g., apply-to-input only vs. direct navigation).

### Phase 5: Performance safeguards
- Add hard limits per source and a total max suggestions.
- Avoid querying large datasets repeatedly: memoize per token prefix where feasible.
- Short-circuit on very short tokens (e.g., <2 chars) for Work/Resource.

### Phase 6: Validation
- Verify section suggestions still work as before.
- Validate no regressions in search results, tree expansion, and history controls.
