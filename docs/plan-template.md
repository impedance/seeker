# Plan Template & Current Plan

Use this template before non-trivial changes to capture scope, files, anchors, risks, and checks.

## Template
- **Scope + non-goals:** describe what the change covers and what it deliberately omits.
- **Affected entry points/files:** list the modules/resources (with search pointers) that will be touched.
- **Relevant AICODE anchors to read/update:** mention existing anchors (`rg -n "AICODE-"`) that should change.
- **Risks/contracts to preserve:** note invariants or sharp edges that need attention.
- **Test/check list:** enumerate commands or manual checks to run.

---

## Current Plan (tasks t9-t12: API + parsing layer)

### Scope + non-goals
- **Scope:** implement the BaseX API layer that runs XQuery against the configured REST endpoint, parses the XML output into Section/Work models, exposes wrappers for sections/children/work details/search, and adds a TTL cache plus unified error handling so repeated queries stay fast.
- **Non-goals:** connecting the API data to navigation/UI modules, hooking search results into the tree, or building favorites/export flows (those remain in t13+).

### Affected entry points/files
- `app/js/api.js` (core fetch helper, parsing utilities, wrappers, caching/unsafe handling).
- `app/js/config.js` (if needed to expose timeouts or cache defaults used by the API).
- `docs/TASKS.md` (mark t9-t12 as complete once implementation is validated).
- `docs/status.md` (refresh focus/entry anchors to reflect that navigation/state work is now next).
- `docs/plan-template.md` (this plan record, now describing the API phase of work).

### Relevant AICODE anchors to read/update
- Update `AICODE-NOTE: STATUS/FOCUS` + `AICODE-NOTE: STATUS/ENTRY` to call out that navigation state/tree work (t13-t20) is the current focus after the API layer.
- Keep all existing ASCII-only `AICODE-*` anchors intact (`AGENTS.md`, `README.md`, `docs/context.md`, etc.).
- No new anchors beyond the adjusted status lines are required for this chunk.

### Risks/contracts to preserve
- Keep the navigation/status/context anchors discoverable via `rg -n "AICODE-"` after edits.
- Do not break the BaseX configuration constants in `app/js/config.js` (e.g., `baseURL`, `requestTimeout`, `pageSize`), as other modules rely on them.
- Ensure fetch timeout handling does not swallow genuine errors and that parsing gracefully reports invalid XML.

### Test/check list
- Run `rg -n "AICODE-" README.md docs/*.md` after touching docs to confirm the anchors remain visible.
- Manual review of `app/js/api.js` to ensure `executeQuery`, parsing utilities, and search wrapper output stable models (no automated runtime tests available).
- Verify `docs/TASKS.md` marks t9-t12 complete and that planners/readers can see the next open tasks.
- Note that `npm run lint:aicode` / repo tests cannot run because no npm scripts/package are defined, so mention that limitation during the final report.
