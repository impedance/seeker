# Plan Template & Current Plan

Use this template before non-trivial changes to capture scope, files, anchors, risks, and checks.

## Template
- **Scope + non-goals:** describe what the change covers and what it deliberately omits.
- **Affected entry points/files:** list the modules/resources (with search pointers) that will be touched.
- **Relevant AICODE anchors to read/update:** mention existing anchors (`rg -n "AICODE-"`) that should change.
- **Risks/contracts to preserve:** note invariants or sharp edges that need attention.
- **Test/check list:** enumerate commands or manual checks to run.

---

## Current Plan (repo navigation initialization)

### Scope + non-goals
- **Scope:** create README navigation index, add the required documentation files (`docs/context.md`, `docs/status.md`, `docs/decisions/0001-initial.md`), and capture this plan inside `docs/plan-template.md` per AGENTS instructions; include AICODE anchors at the top of README/status/context explaining where to find info.
- **Non-goals:** no application logic, assets, or BaseX setup changes.

### Affected entry points/files
- `README.md` (for repository layout, entry points, common tasks, search cookbook).
- `docs/plan-template.md` (current plan plus guidance for future plans).
- `docs/context.md`, `docs/status.md`, `docs/decisions/0001-initial.md` (provide required context/status/ADR content and anchors).

### Relevant AICODE anchors to read/update
- Search `rg -n "AICODE-" README.md docs/*.md` once README and docs exist to confirm anchors.
- Add `AICODE-NOTE: NAV/README` near README beginning, plus `AICODE-NOTE: STATUS/FOCUS` and `CONTEXT/` anchors inside docs.

### Risks/contracts to preserve
- Maintain ASCII-only `AICODE-*` lines; no unauthorized prefixes.
- Ensure the README index highlights search commands as mandated by navigation system.

### Test/check list
- None (documentation changes only); manual validation consists of verifying README contains the required sections and `rg -n "AICODE-"` finds the new anchors.
