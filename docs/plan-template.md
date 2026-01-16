# Plan Template & Current Plan

Use this template before non-trivial changes to capture scope, files, anchors, risks, and checks.

## Template
- **Scope + non-goals:** describe what the change covers and what it deliberately omits.
- **Affected entry points/files:** list the modules/resources (with search pointers) that will be touched.
- **Relevant AICODE anchors to read/update:** mention existing anchors (`rg -n "AICODE-"`) that should change.
- **Risks/contracts to preserve:** note invariants or sharp edges that need attention.
- **Test/check list:** enumerate commands or manual checks to run.

---

## Current Plan (Phase 4: navigation + UI wiring)

### Scope + non-goals
- **Scope:** implement the navigation state layer (`currentDatabase`, `expanded`, `selectedWork`, breadcrumbs), routing events, section loading/expansion logic, and the corresponding UI renders (database list, collapsible tree, work details, breadcrumbs, and loaders/errors) so Phase 4 (t13-t20) becomes executable end-to-end.
- **Non-goals:** wiring the search UI/XQuery layer, cross-database price lookups, or favorites/history features (those remain in t21+ and beyond).

### Affected entry points/files
- `app/js/navigation.js` (state container, loaders, expansion caching, selection hooks, breadcrumb helpers).
- `app/js/ui.js` (database list, tree/detail rendering, breadcrumb builder, loader/error helpers).
- `app/js/main.js` (glue that binds navigation updates to UI components and user events).
- `app/index.html` + `app/css/style.css` (breadcrumb placeholders/styling so the detail panel accommodates the new controls).
- `docs/TASKS.md` (mark t13-t20 as complete).
- `docs/status.md` (report Phase 4 completion and move focus toward search/cross-db work).

### Relevant AICODE anchors to read/update
- Update `AICODE-NOTE: STATUS/FOCUS` + `AICODE-NOTE: STATUS/ENTRY` in `docs/status.md` to highlight that search (t21-t23) and the cross-db helpers (t24-t27) are next.
- Keep every ASCII-only anchor in `AGENTS.md`, `README.md`, `docs/context.md`, and others discoverable via `rg -n "AICODE-"`.
- No new anchors beyond the status lines should be introduced for this change.

### Risks/contracts to preserve
- Preserve the docs invariant (`docs/context.md` anchor) that `README.md`, `docs/context.md`, `docs/status.md`, and `docs/decisions/*` stay present.
- Keep the `CONFIG` constants untouched so other modules relying on `baseURL`, timeouts, and pagination keep working.
- Ensure navigation loading/expansion errors propagate cleanly instead of leaving stale UI state.

### Test/check list
- After editing docs, run `rg -n "AICODE-" README.md docs/*.md`.
- Manually reason through the database list/tree/details flow to ensure handlers/UX match the Phase 4 checklist (no automated runtime tests are set up).
- Confirm `docs/TASKS.md` now marks t13-t20 complete and `docs/status.md` outlines the next focus.
- Note the absence of `package.json`, so `npm run lint:aicode` or similar repo tests cannot run; document this limitation in the final summary.
