<!-- AICODE-NOTE: NAV/PLAN_SEARCH_SUGGESTIONS_MULTI_TOKEN plan: multi-word suggestion scoring ref: AGENTS.md README.md docs/context.md docs/status.md -->
# Plan: устойчивые подсказки по поиску

- **Scope + non-goals:** улучшить `registerSearch`/подсказки так, чтобы поиск по названию работ, ресурсов и разделов учитывал все слова запроса и допускал частичные совпадения по любому токену (например, после ввода `Смазка пл...` подсказки «Смазка пластичная» и связанные работы остаются в списке). Non-goals: не трогать серверную выборку (`getSectionIndex`, `getWorkSuggestions`, `getResourceSuggestions`) и не вводить новый UI-канал показа подсказок.
- **Affected entry points/files:** `app/js/search.js` (нормализация запроса, кеширование, построение скоринга и управление `applySuggestion`), `app/js/ui.js` (если потребуется адаптировать отображение подсказок/метаданных после смены структуры `state.suggestions`), `docs/plan-fuzzy-suggestions.md` (контекст и пересмотр фаз), `docs/plan-search-suggestions-multi-token.md` (этот документ).
- **Relevant AICODE anchors to read/update:** актуальные якоря сохраняются (`README.md`, `docs/context.md`, `docs/status.md`, `docs/decisions/*`); если появятся новые результату/фокус, дополнить `docs/status.md` (`AICODE-NOTE: STATUS/FOCUS`/`STATUS/ENTRY`); после всех изменений выполнить `rg -n "AICODE-" README.md docs/*.md`.
- **Risks/contracts to preserve:** не нарушать `AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT keep README/docs/context/docs/status/docs/decisions present [2025-10-05]`; не раздувать время отклика подсказок (неформальная фильтрация по каждому токену должна оставаться O(n) на кэшированном массиве); не ломать `suggestionCache`/`sectionIndexCache` и кэшированные подсказки по базам; сохранить поведение `applySuggestion` (подстановка последнего токена и следующее обновление запроса).
- **Test/check list:** набирать «Смазка» → увидеть «Смазка пластичная»; дописать «Смазка пл...» и убедиться, что подсказка не исчезает и даже появляется рядом; проверить другие комбинации токенов/опечаток (например «смазка сол»), клик по чипу заменяет последний токен и триггерит поиск; убедиться, что кеши не создают дублированных подсказок; прогнать `rg -n "AICODE-" README.md docs/*.md` после правок.

---

## Phase breakdown (tasks)

- **Phase 1: разбить запрос на токены**
  - добавить утилиту `parseSearchTokens(query)` (нормализация `normalizeText`, сплит по пробелам, фильтрация пустых фрагментов plus отдельно `lastToken` для `applySuggestion`).
  - ввести `querySignature`/ключ для кеша подсказок (`database|type|normalizedTokens.join(' ')`) вместо текущего одного токена, чтобы обновления по мере ввода новых слов не сбрасывали кэш, и аккуратно очищать старые записи.
  - пересмотреть `SUGGESTION_MIN_TOKEN`/`SUGGESTION_MIN_SCORES`: использовать длину всего запроса или наличие хотя бы одного токена `>= min` для каждого типа, а не только последнего фрагмента.

- **Phase 2: вычислить скоринг по всем токенам**
  - заменить `buildSuggestions(index, token, ...)`/`buildEntitySuggestions(entries, token, ...)` на версии, принимающие массив токенов, и пересчитать `computeEntryScore` так, чтобы каждый токен сравнивался с `normalizedName`, `normalizedCode`, `normalizedPath`, используя комбинацию `startsWith`, `includes` и Levenshtein или ранжирование по средней оценке.
  - добавить функцию `matchesAllTokens(entry, tokens)` (или аналог) для грубой фильтрации без Levenshtein (например, требовать `entryNormalized` содержит токен или слово в начале) и использовать её для пропуска нерелевантных записей до тяжелых вычислений.
  - сохранить сортировку по баллам и глубине/коду, но ещё добавлять буст за то, что токены находятся ближе к началу пути.

- **Phase 3: обновить pipeline подсказок**
  - переписать `handleSuggestionQuery`: вместо `extractLastToken` использовать полную строку и токены для вызова `buildSuggestions`/`buildEntitySuggestions`, отслеживая `lastToken` отдельно для `applySuggestion`.
  - при выборе подсказки сохранять `suggestion`, но подставлять его только в часть после `lastToken`, оставаясь совместимым с `replaceLastToken`.
  - обновить `suggestionCache`/`suggestionRequestId`-логику так, чтобы при изменении порядка слов (например, "пластичная смазка") все равно получались согласованные результаты, и не допустить race conditions.
  - при необходимости добавить новые поля в объект подсказки (`matchedTokens`, `scoreDetails`) для UI, не ломая существующую структуру (`displayLabel`, `pathLabel`, `value` остаются).

- **Phase 4: документация и статус**
  - описать в `docs/status.md` новый фокус (если поисковая логика становится текущей работой) и отразить статус выполнения (можно кратко упомянуть про `AICODE-NOTE: STATUS/FOCUS`).
  - при необходимости дополнить `docs/plan-fuzzy-suggestions.md` или ввести ссылку `AICODE-LINK` на новый план/обоснование.
