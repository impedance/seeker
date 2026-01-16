# План разработки MVP (Минимальный прототип)

Упрощенная версия для быстрого старта. Только базовые функции:
- ✅ Отображение базы данных
- ✅ Сохранение иерархии
- ✅ Поиск по базе

**Время разработки**: 2-4 часа

---

## ☑ t1. Запуск BaseX с одной базой

**Описание:** Создать одну базу данных для тестирования (самую маленькую).

**Команды:**
```bash
cd basex
# Создаем только одну базу для начала (самая маленькая)
./bin/basex -c "CREATE DB gesnmr ../ГЭСНмр.xml"
# Запускаем HTTP сервер
./bin/basexhttp &
```

**Проверка:** Открыть http://localhost:8080 - должна открыться страница BaseX.

---

## ☑ t2. Создать простую структуру проекта

**Описание:** Минимальная структура - один HTML файл и один JS файл.

**Команды:**
```bash
mkdir app
touch app/index.html
touch app/app.js
```

**Структура:**
```
app/
├── index.html    # Всё в одном файле (HTML + CSS inline)
└── app.js        # Весь JavaScript в одном файле
```

---

## ☑ t3. Создать HTML с Bootstrap (всё в одном файле)

**Описание:** Простой HTML с двумя панелями: дерево слева, детали справа.

**Файл:** `app/index.html`

**Что включить:**
```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>ГЭСН Viewer</title>
    <!-- Bootstrap CDN -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
        #app { display: flex; height: 100vh; }
        #tree-panel { width: 50%; border-right: 1px solid #ddd; overflow-y: auto; padding: 20px; }
        #details-panel { width: 50%; overflow-y: auto; padding: 20px; }
        .tree-item { padding: 5px; cursor: pointer; margin-left: 20px; }
        .tree-item:hover { background: #f0f0f0; }
        .tree-item.active { background: #007bff; color: white; }
        #search { margin-bottom: 20px; }
    </style>
</head>
<body>
    <div id="app">
        <div id="tree-panel">
            <h3>ГЭСНмр</h3>
            <input type="text" id="search" class="form-control" placeholder="Поиск по коду или названию...">
            <div id="tree"></div>
        </div>
        <div id="details-panel">
            <h4>Детали</h4>
            <div id="details">Выберите элемент из дерева</div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>
```

**Проверка:** Открыть app/index.html - должны быть видны две панели.

---

## ☑ t4. Написать JavaScript для работы с BaseX

**Описание:** Весь код в одном файле app.js - API, отображение, поиск.

**Файл:** `app/app.js`

**Что реализовать:**

### 4.1. Конфигурация
```javascript
const CONFIG = {
    baseURL: 'http://localhost:8080/rest',
    database: 'gesnmr'
};
```

### 4.2. Функция для выполнения XQuery
```javascript
async function query(xquery) {
    const url = `${CONFIG.baseURL}/${CONFIG.database}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xquery
    });
    const text = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/xml');
}
```

### 4.3. Загрузка всего дерева
```javascript
async function loadTree() {
    // Загружаем все Section и Work
    const xquery = `
        for $section in //Section
        return <item type="{$section/@Type}" code="{$section/@Code}" name="{$section/@Name}"/>
    `;
    const result = await query(xquery);
    return Array.from(result.querySelectorAll('item'));
}
```

### 4.4. Загрузка деталей Work
```javascript
async function loadWorkDetails(code) {
    const xquery = `
        for $work in //Work[@Code="${code}"]
        return $work
    `;
    const result = await query(xquery);
    return result.querySelector('Work');
}
```

### 4.5. Отображение дерева
```javascript
function renderTree(items) {
    const treeDiv = document.getElementById('tree');
    treeDiv.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tree-item';
        div.textContent = `[${item.getAttribute('code')}] ${item.getAttribute('name')}`;
        div.onclick = () => selectItem(item);
        treeDiv.appendChild(div);
    });
}
```

### 4.6. Отображение деталей
```javascript
function renderDetails(work) {
    const detailsDiv = document.getElementById('details');
    if (!work) {
        detailsDiv.innerHTML = 'Элемент не найден';
        return;
    }

    const code = work.getAttribute('Code');
    const name = work.getAttribute('EndName');
    const unit = work.getAttribute('MeasureUnit');

    let html = `
        <h5>Код: ${code}</h5>
        <p><strong>Название:</strong> ${name}</p>
        <p><strong>Единица измерения:</strong> ${unit}</p>
        <h6>Ресурсы:</h6>
        <table class="table table-sm">
            <thead><tr><th>Код</th><th>Количество</th></tr></thead>
            <tbody>
    `;

    const resources = work.querySelectorAll('Resource');
    resources.forEach(r => {
        html += `<tr>
            <td>${r.getAttribute('Code')}</td>
            <td>${r.getAttribute('Quantity')}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    detailsDiv.innerHTML = html;
}
```

### 4.7. Поиск
```javascript
async function search(query) {
    const xquery = `
        for $work in //Work[contains(@Code, "${query}") or contains(@EndName, "${query}")]
        return <item code="{$work/@Code}" name="{$work/@EndName}"/>
    `;
    const result = await query(xquery);
    return Array.from(result.querySelectorAll('item'));
}
```

### 4.8. Инициализация
```javascript
// При загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const items = await loadTree();
        renderTree(items);

        // Поиск с задержкой
        let searchTimeout;
        document.getElementById('search').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                if (e.target.value.length > 2) {
                    const results = await search(e.target.value);
                    renderTree(results);
                } else {
                    const items = await loadTree();
                    renderTree(items);
                }
            }, 300);
        });
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось подключиться к BaseX. Убедитесь что сервер запущен.');
    }
});

// Выбор элемента
async function selectItem(item) {
    const code = item.getAttribute('code');
    const work = await loadWorkDetails(code);
    renderDetails(work);

    // Подсветка активного элемента
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
}
```

**Проверка:** Открыть app/index.html - должно загрузиться дерево и работать поиск.

---

## ☑ t5. Тестирование MVP
**Completed**: 2026-01-15 - Все проверки пройдены успешно

**Описание:** Проверить что всё работает.

**Что проверить:**
1. ✓ BaseX сервер запущен
2. ✓ Загружается список элементов
3. ✓ Клик на элемент показывает детали
4. ✓ Поиск находит элементы
5. ✓ Нет ошибок в консоли

**Тестовые сценарии:**
- Открыть app/index.html
- Должно появиться дерево с элементами
- Кликнуть на любой элемент - справа появятся детали
- Ввести в поиск "01" - должны отфильтроваться результаты

**Проблемы CORS:** Если браузер блокирует запросы к BaseX из-за CORS, запустить браузер с отключенным CORS:
```bash
# Chrome
google-chrome --disable-web-security --user-data-dir=/tmp/chrome

# Firefox - в about:config установить security.fileuri.strict_origin_policy = false
```

Или использовать простой HTTP сервер:
```bash
cd app
python3 -m http.server 3000
# Открыть http://localhost:3000
```

**Проверка:** Всё работает без ошибок.

---

## Готово! 🎉

После выполнения этих 5 задач у вас будет работающий MVP:
- ✅ База данных отображается
- ✅ Иерархия сохранена (все Section и Work)
- ✅ Работает поиск
- ✅ Показываются детали элементов

**Время:** 2-4 часа работы

**Что дальше?**

После того как MVP работает, можно добавлять улучшения из полного плана (TASKS.md):
- Красивое дерево с раскрытием/сворачиванием
- Все 7 баз данных
- Связи между базами (цены из справочников)
- Breadcrumbs, фильтры, экспорт, избранное
- Оптимизация и документация

Но сначала - запустим MVP! 🚀
