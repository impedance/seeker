# План: устранение ошибок CORS и подключения к BaseX

- **Scope + non-goals:** сфокусироваться на устранении CORS/подключения (прокси, заголовки, fallback-порты); не трогать бизнес-логику дерева/поиска/карточек.
- **Affected entry points/files:** `app/js/api.js` (заголовки fetch), `simple_proxy.py` (CORS allow headers/methods), `app/js/config.js` (список fallback-эндпоинтов), `scripts/start-dev.sh` (подсказки по портам), при необходимости `README.md` (инструкции запуска).
- **Relevant AICODE anchors to read/update:** `README.md` (NAV/README), `docs/context.md` (CONTRACT/DOCS_REQUIREMENT), `docs/status.md` (STATUS/FOCUS/ENTRY); после правок — `rg -n "AICODE-" README.md docs/*.md`.
- **Risks/contracts to preserve:** не менять контракт кеширования запросов в `app/js/api.js`; сохранить сценарий запуска через `scripts/start-dev.sh`; соблюдать `CONTRACT/DOCS_REQUIREMENT` по наличию ключевых docs.
- **Test/check list:**
  - `npm run lint:aicode`
  - `./scripts/start-dev.sh`, затем загрузка UI и проверка: дерево разделов открывается без CORS в консоли.
  - Проверка, что `baseURL` указывает на активный прокси-порт и запросы идут через него.
