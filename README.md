<!-- AICODE-NOTE: NAV/README entry: README.md ref: AGENTS.md docs/context.md -->
<!-- AICODE-NOTE: NAV/TESTS entry: docs/status.md ref: docs/status.md -->

# Seeker Navigation Workspace

## Repository layout (purpose + search pointer)
- `AGENTS.md` · session rules, required docs list, and navigation checklist (`rg -n "AICODE-" AGENTS.md`).
- `aicode-*` · navigation system reference and anchor guidance (`rg -n "AICODE-" aicode-system.md`).
- `app/` · planned UI code (HTML/CSS/JS modules) for the BaseX-driven viewer (`rg -n "AICODE-" app`).
- `docs/` · living context, status, plan template, and architectural decisions (`rg -n "AICODE-" docs`).
- `TASKS*.md` · development roadmap and sprint-style tasks (`rg -n "AICODE-" TASKS*.md`).

## Entry points (high-level entry files + search pointers)
- `app/index.html` · planned browser UI surface (search for `id="tree-view"` via `rg -n "tree-view" app/index.html`).
- `proxy.py` / `simple_proxy.py` · helper scripts for BaseX or networking proxies (`rg -n "def " proxy.py`).
- `docs/context.md` · mission, stack, invariants for contributors (`rg -n "CONTEXT/" docs/context.md`).
- `docs/status.md` · current focus/goals and progress markers (`rg -n "STATUS/" docs/status.md`).

## Common tasks (real commands)
- `rg -n "AICODE-"` · discover anchors required by the navigation system and AGENTS instructions.
- `./basex/bin/basex -c "CREATE DB gesn ../ГЭСН.xml"` · import XML into BaseX (repeat per file in `TASKS.md`).
- `./basex/bin/basexhttp` · start the BaseX HTTP server to serve REST queries to the app.
- `./scripts/start-dev.sh` · convenience script that launches BaseX HTTP and the `simple_proxy.py` CORS proxy in one go (logs land in `/tmp/basex-http.log`).

## Search cookbook
- `rg -n "AICODE-NOTE:" -g"*.md"` · find navigation anchors across docs.
- `rg -n "AICODE-CONTRACT"` · locate invariants that must keep working.
- `rg -n "AICODE-TRAP" docs -n` · highlight sharp edges before touching risky logic.
- `rg --files docs` · list required docs to ensure context/status/decisions exist.

## Notes
- Use `docs/status.md` as the living status, update when focus shifts.
- Place new architecture rationale in `docs/decisions/*.md` and link via `AICODE-LINK:` from the affected code.
- `scripts/start-dev.sh` поднимает BaseX+прокси на ближайших свободных портах (8888/8889/8890 для прокси); если порт отличается от 8888, поправьте `CONFIG.baseURL/baseURLFallbacks` в `app/js/config.js`.
- Если BaseX требует Basic Auth, скрипт по умолчанию подставляет `BASEX_USER=admin` и `BASEX_PASSWORD=admin`; можно переопределить их (или передать готовое `BASEX_AUTH="Basic dXNlcjpwYXNz"`).
