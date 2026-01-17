# Plan Template & Current Plan

Use this template before non-trivial changes to capture scope, files, anchors, risks, and checks.

## Template
- **Scope + non-goals:** describe what the change covers and what it deliberately omits.
- **Affected entry points/files:** list the modules/resources (with search pointers) that will be touched.
- **Relevant AICODE anchors to read/update:** mention existing anchors (`rg -n "AICODE-"`) that should change.
- **Risks/contracts to preserve:** note invariants or sharp edges that need attention.
- **Test/check list:** enumerate commands or manual checks to run.

---

## Current Plan (Tree shows NameGroup Work items properly)

### Scope + non-goals
- **Scope:** Обеспечить, чтобы `NameGroup` (группировки работ внутри таблиц) раскрывались в дереве, добавляя реальные Work-узлы рядом с Section без изменения существующей навигации/кэширования и сохраняя трассировку путей/истории.
- **Non-goals:** Фильтры/экспорт/избранное (t28-t30), Phase 8 стабилизация и визуальные редизайны, а также любые асинхронные расширения поискового слоя.

### Affected entry points/files
- `app/js/api.js` (парсинг XML: `buildSection`, вспомогательные функции, сборка Summary для Work).
- `app/js/ui.js` (рендер дерева и метаданные Work-узлов, оставить Section только разворачиваемыми).
- `app/js/navigation.js` (проверка, чтобы `selectWork`/history/breadcrumbs продолжали работать по Work-кодам).
- `docs/status.md` (обновить фокус/следующие шаги).
- `docs/plan-template.md` (этот документ, чтобы зафиксировать план).

### Relevant AICODE anchors to read/update
- `docs/context.md` (`AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT keep README/docs/context/docs/status/docs/decisions present [2025-10-05]` обязательный).
- `docs/status.md` (`AICODE-NOTE: STATUS/FOCUS`/`STATUS/ENTRY`, если фокус смещается).
- После всех изменений в документах выполнить `rg -n "AICODE-" README.md docs/*.md`.

### Risks/contracts to preserve
- Не трогать `AICODE-CONTRACT: CONTRACT/DOCS_REQUIREMENT ... [2025-10-05]`.
- Не ломать кэш `sectionCache`, `childrenCache`, `workCache`, чтобы повторные выборы продолжали использовать старые данные.
- Не превращать `Section` в кликабельные работы: клики по Section только разворачивают/сворачивают узел; Work-узлы остаются единственными кликабельными элементами с `handlers.onWorkSelect`.

### Test/check list
- Открыть базу (например, `ГЭСН`) и раскрыть таблицу (например, `02-02-002`): проверить, что появились Work-строки из `NameGroup`.
- Кликнуть Work и убедиться, что карточка деталей с ресурсами/цитатами отобразилась и хлебные крошки обновились.
- Пройти результат поиска и убедиться, что навигация раскрывает путь и показывает правильную Work.
- Убедиться, что секции без Work ведут себя как прежде и не дублируются.
- После редактирования документа и README выполнить `rg -n "AICODE-" README.md docs/*.md`.

### Phase breakdown (tasks)
- **Phase 1: Data mapping**
  - Изучить XML: Section → NameGroup → Work, чтобы понять, где живут работы.
  - Добавить функцию `collectWorkNodes(node, sectionPath)` (или аналог) для рекурсивного обхода NameGroup и прямых Work.
  - Обновить `buildSection`, чтобы после сбора `section.children` также заполнялся `section.works` без потери `section.path`.
- **Phase 2: UI behavior**
  - Убедиться, что `renderTree` добавляет новые Work-узлы (с кодом/name/measurement), сохраняя текущую структуру DOM.
  - Сохранять `handlers.onWorkSelect` только за Work-узлами и не делать их повторно раскрывающимися.
  - Проверить, что выбранный Work подсвечивается и не ломается разделение Sections/Works.
  - Добавить клавиатурный доступ, `aria-label` и `title` к Work-узлам, чтобы они оставались единственными интерактивными элементами в дереве и ясно описывали путь/измерения.
- **Phase 3: Navigation and caching**
  - Гарантировать, что `Navigation.selectWork` продолжает кешировать детали по Work-коду (`workCache`), и кэшированные записи содержат разделы из NameGroup.
  - Проверить, что история/хлебные крошки строятся по `sectionPath`/`sectionNames`, игнорируя NameGroup промежуточно.
