# Plan Template & Current Plan

Use this template before non-trivial changes to capture scope, files, anchors, risks, and checks.

## Template
- **Scope + non-goals:** describe what the change covers and what it deliberately omits.
- **Affected entry points/files:** list the modules/resources (with search pointers) that will be touched.
- **Relevant AICODE anchors to read/update:** mention existing anchors (`rg -n "AICODE-"`) that should change.
- **Risks/contracts to preserve:** note invariants or sharp edges that need attention.
- **Test/check list:** enumerate commands or manual checks to run.

---

## Current Plan (Phase 7: resilience + CDN fixes)

### Scope + non-goals
- **Scope:** update the Bootstrap stylesheet anchor to include the correct integrity hash and add BaseX endpoint fallbacks so the UI can reach whichever server port `scripts/start-dev.sh` opened.
- **Non-goals:** filters/export/favorites (t28-t30) and Phase 8 stability chores remain for a dedicated follow-up.

### Affected entry points/files
- `docs/plan-template.md` (capture the new work plan for follow-up tasks).
- `app/index.html` (fix the Bootstrap integrity attribute).
- `app/js/config.js` (declare optional alternative BaseX endpoints).
- `app/js/api.js` (try each configured endpoint before failing and remember the working host).
- `simple_proxy.py` (allow GET/HEAD through the CORS proxy so the UI can reuse it).

### Relevant AICODE anchors to read/update
- `README.md` as the navigation index that describes the entry point we touched (`AICODE-NOTE: NAV/README entry`).
- `docs/context.md` / `docs/status.md` so their invariants remain searchable (`AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT ...`, `AICODE-NOTE: STATUS/...`).
- Run `rg -n "AICODE-" README.md docs/*.md` after editing docs.

### Risks/contracts to preserve
- Keep the existing `AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT keep README/docs/context/docs/status/docs/decisions present [2025-10-05]`.
- Avoid changing `CONFIG` semantics (timeouts, caching, database list) beyond the new fallback helpers.
- Ensure caching logic still works even though we try multiple endpoints (cache key remains `database|query`).

### Test/check list
- `rg -n "AICODE-" README.md docs/*.md` after touching docs.
- Manual smoke check: load the UI, confirm Bootstrap loads without integrity warnings, select a base, expand a node, and see that at least one BaseX port succeeds instead of showing repeated network errors.
- Verify the BaseX fallback list covers the ports mentioned in `scripts/start-dev.sh` (8080/8984/9090).
