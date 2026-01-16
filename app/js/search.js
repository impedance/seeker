import { CONFIG } from './config.js';
import { search as executeSearch } from './api.js';

const DEBOUNCE_MS = typeof CONFIG.searchDebounce === 'number' ? CONFIG.searchDebounce : 300;
const SEARCHABLE_DATABASES = Array.isArray(CONFIG.databases)
  ? CONFIG.databases.filter((db) => db.searchable !== false)
  : [];

function buildEmptyState() {
  return {
    query: '',
    loading: false,
    groups: [],
    error: null
  };
}

export function registerSearch({ onStateChange } = {}) {
  const input = document.getElementById('search-input');
  if (!input || typeof onStateChange !== 'function') {
    return;
  }

  let timer = null;
  let currentToken = 0;
  let state = buildEmptyState();

  function emit(partial) {
    state = { ...state, ...partial };
    onStateChange(state);
  }

  function clearPrevious() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function runSearch(query, token) {
    if (!SEARCHABLE_DATABASES.length) {
      emit({ query, loading: false, groups: [], error: 'Нет настроенных баз для поиска.' });
      return;
    }

    emit({ query, loading: true, groups: [], error: null });
    const groups = await Promise.all(
      SEARCHABLE_DATABASES.map(async (db) => {
        try {
          const hits = await executeSearch(db.id, query);
          return { databaseId: db.id, databaseName: db.name, hits, error: null };
        } catch (error) {
          return {
            databaseId: db.id,
            databaseName: db.name,
            hits: [],
            error: error?.message || 'Ошибка поиска'
          };
        }
      })
    );

    if (token !== currentToken) {
      return;
    }

    emit({ loading: false, groups, error: null });
  }

  function handleInput(value) {
    const nextQuery = (value || '').trim();
    clearPrevious();

    if (!nextQuery) {
      emit(buildEmptyState());
      return;
    }

    const token = ++currentToken;
    timer = setTimeout(() => {
      runSearch(nextQuery, token);
    }, DEBOUNCE_MS);
  }

  input.addEventListener('input', (event) => {
    handleInput(event.target.value);
  });

  emit(state);
}
