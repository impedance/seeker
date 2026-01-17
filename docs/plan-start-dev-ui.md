# Plan: start-dev.sh запускает UI и проверяет процессы

- **Scope + non-goals:** add запуск статического UI сервера из `app/` в `scripts/start-dev.sh`, учитывать уже запущенные процессы и выводить URL; не добавляем новый dev/build toolchain, не меняем логику BaseX/прокси.
- **Affected entry points/files:** `scripts/start-dev.sh` (логика запуска), `README.md` (обновить описание задачи запуска).
- **Relevant AICODE anchors to read/update:** `README.md` (NAV/README entry), `docs/context.md` (CONTRACT/DOCS_REQUIREMENT).
- **Risks/contracts to preserve:** сохраняем поведение `ALLOW_MULTI/STOP_OLD`, не ломаем выбор свободных портов и сценарий прокси в фоне/фореграунде.
- **Test/check list:** `./scripts/start-dev.sh` (убеждаемся, что BaseX+proxy+UI поднялись), открыть `http://127.0.0.1:<UI_PORT>/`, проверить что UI грузится; `rg -n "AICODE-" README.md docs/*.md` после правок в docs.
