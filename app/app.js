// ГЭСН Viewer Application
// JavaScript code for BaseX integration

// ============ Конфигурация ============
const CONFIG = {
    baseURL: 'http://localhost:8888/rest',
    database: 'gesnmr'
};

// ============ Управление темой ============
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle');

    if (theme === 'dark') {
        body.classList.add('dark-theme');
        toggleBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
    } else {
        body.classList.remove('dark-theme');
        toggleBtn.innerHTML = '<i class="bi bi-moon-fill"></i>';
    }

    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-theme');
    applyTheme(isDark ? 'light' : 'dark');
}

// ============ Функция для выполнения XQuery ============
async function query(xquery) {
    const url = `${CONFIG.baseURL}/${CONFIG.database}`;
    const credentials = btoa('admin:admin');

    // Экранируем специальные символы в XQuery для XML
    const escapedQuery = xquery
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const body = `<query><text>${escapedQuery}</text></query>`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Basic ${credentials}`
        },
        body: body
    });

    if (!response.ok) {
        throw new Error(`BaseX error: ${response.status}`);
    }

    const text = await response.text();
    // Оборачиваем результат в корневой элемент если нужно
    const wrappedText = text.startsWith('<') ? text : `<root>${text}</root>`;
    const parser = new DOMParser();
    return parser.parseFromString(wrappedText, 'text/xml');
}

// ============ Загрузка всего дерева ============
async function loadTree() {
    // Загружаем все Work, чтобы дерево было интерактивным по умолчанию
    const xquery = `
        for $work in //Work
        return <item type="{$work/ancestor::Section[1]/@Type}" code="{$work/@Code}" name="{$work/@EndName}"/>
    `;
    const result = await query(xquery);
    return Array.from(result.querySelectorAll('item'));
}

// ============ Загрузка деталей Work ============
async function loadWorkDetails(code) {
    const xquery = `
        for $work in //Work[@Code="${code}"]
        return $work
    `;
    const result = await query(xquery);
    return result.querySelector('Work');
}

// ============ Отображение дерева ============
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

// ============ Отображение деталей ============
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

// ============ Поиск ============
async function search(searchQuery) {
    const xquery = `
        for $work in //Work[contains(@Code, "${searchQuery}") or contains(@EndName, "${searchQuery}")]
        return <item code="{$work/@Code}" name="{$work/@EndName}"/>
    `;
    const result = await query(xquery);
    return Array.from(result.querySelectorAll('item'));
}

// ============ Выбор элемента ============
async function selectItem(item) {
    const code = item.getAttribute('code');
    const work = await loadWorkDetails(code);
    renderDetails(work);

    // Подсветка активного элемента
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
}

// ============ Инициализация ============
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Инициализируем тему перед рендерингом
        initTheme();

        const items = await loadTree();
        renderTree(items);

        // Обработчик переключения темы
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

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
