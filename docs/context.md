<!-- AICODE-NOTE: CONTEXT/BOOT mission: map repo structure + docs baseline ref: README.md -->
<!-- AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT keep README/docs/context/docs/status/docs/decisions present [2025-10-05] -->
<!-- AICODE-LINK: docs/decisions/0001-initial.md -->

# Context

- **Mission:** Provide a clear navigation layer for contributors by surfacing AGENTS directives, the navigation system, and the BaseX viewer tasks.
- **Stack:** browser UI served from `app/`, BaseX server under `basex/`, Python tooling through `.venv/` (use `.venv/bin/python` for scripts/tests), and documentation-driven coordination via `docs/` files.
- **Invariants:** Documentation anchors must stay discoverable via `rg -n "AICODE-"`, README must remain the single source of layout/index, and `docs/status.md` must reflect the current focus/future tasks.

# References

- AGENTS instructions: `AGENTS.md`
- Navigation system reference: `aicode-system.md`
- Task roadmap: `TASKS.md` / `TASKS_MVP.md`
