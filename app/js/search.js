import { CONFIG } from './config.js';
import { search as executeSearch, getSectionIndex } from './api.js';

const DEBOUNCE_MS = typeof CONFIG.searchDebounce === 'number' ? CONFIG.searchDebounce : 300;
const SEARCHABLE_DATABASES = Array.isArray(CONFIG.databases)
  ? CONFIG.databases.filter((db) => db.searchable !== false)
  : [];
const SUGGESTION_LIMIT = 6;
const SUGGESTION_MIN_SCORE = 0.28;

const sectionIndexCache = new Map();
const sectionIndexPromises = new Map();

function buildEmptyState() {
  return {
    query: '',
    loading: false,
    groups: [],
    error: null
  };
}

function normalizeText(value) {
  if (value == null) {
    return '';
  }
  const text = String(value);
  const normalized = text.normalize ? text.normalize('NFD') : text;
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function extractLastToken(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return '';
  }
  const tokens = trimmed.split(/\s+/);
  return tokens[tokens.length - 1] || '';
}

function replaceLastToken(original, suggestion) {
  if (!suggestion) {
    return original || '';
  }
  const trimmed = (original || '').trim();
  if (!trimmed) {
    return `${suggestion} `;
  }
  const tokens = trimmed.split(/\s+/);
  tokens[tokens.length - 1] = suggestion;
  return `${tokens.join(' ')} `;
}

function levenshteinDistance(a, b) {
  const lenA = a.length;
  const lenB = b.length;
  if (!lenA) {
    return lenB;
  }
  if (!lenB) {
    return lenA;
  }

  const matrix = Array.from({ length: lenA + 1 }, (_, index) => index);
  for (let j = 1; j <= lenB; j += 1) {
    let previous = matrix[0];
    matrix[0] = j;
    for (let i = 1; i <= lenA; i += 1) {
      const current = matrix[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i] = Math.min(
        matrix[i] + 1,
        matrix[i - 1] + 1,
        previous + cost
      );
      previous = current;
    }
  }
  return matrix[lenA];
}

function computeScoreNormalized(token, target) {
  if (!token || !target) {
    return 0;
  }
  if (target.startsWith(token)) {
    return 1;
  }
  const distance = levenshteinDistance(token, target);
  const maxLength = Math.max(token.length, target.length);
  if (!maxLength) {
    return 0;
  }
  return Math.max(0, 1 - distance / maxLength);
}

function formatSectionForSuggestions(entry = {}) {
  const pathNames = Array.isArray(entry.pathNames) ? entry.pathNames.filter(Boolean) : [];
  const pathCodes = Array.isArray(entry.pathCodes) ? entry.pathCodes.filter(Boolean) : [];
  const pathLabel = pathNames.length ? pathNames.join(' › ') : '';
  return {
    code: entry.code || '',
    name: entry.name || '',
    pathNames,
    pathCodes,
    pathLabel,
    depth: pathNames.length,
    normalizedName: normalizeText(entry.name),
    normalizedCode: normalizeText(entry.code),
    normalizedPath: normalizeText(pathLabel),
    displayLabel: entry.name || entry.code || 'Раздел'
  };
}

async function ensureSectionIndex(database) {
  if (!database) {
    return [];
  }
  if (sectionIndexCache.has(database)) {
    return sectionIndexCache.get(database);
  }
  let promise = sectionIndexPromises.get(database);
  if (!promise) {
    promise = getSectionIndex(database)
      .then((items) => {
        const normalizedEntries = Array.isArray(items)
          ? items.map(formatSectionForSuggestions)
          : [];
        sectionIndexCache.set(database, normalizedEntries);
        sectionIndexPromises.delete(database);
        return normalizedEntries;
      })
      .catch((error) => {
        sectionIndexPromises.delete(database);
        throw error;
      });
    sectionIndexPromises.set(database, promise);
  }
  return promise;
}

function buildSuggestions(index = [], token, limit = SUGGESTION_LIMIT) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken || !index.length) {
    return [];
  }

  const scored = [];
  const seen = new Set();

  index.forEach((section) => {
    if (!section) {
      return;
    }
    const identifier = section.code || section.name || section.pathLabel;
    if (!identifier || seen.has(identifier)) {
      return;
    }
    const score = Math.max(
      computeScoreNormalized(normalizedToken, section.normalizedName),
      computeScoreNormalized(normalizedToken, section.normalizedCode),
      computeScoreNormalized(normalizedToken, section.normalizedPath) * 0.85
    );
    if (score < SUGGESTION_MIN_SCORE) {
      return;
    }
    seen.add(identifier);
    scored.push({ section, score });
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.section.depth - b.section.depth;
  });

  return scored.slice(0, limit).map(({ section, score }) => ({
    code: section.code,
    name: section.name,
    pathNames: section.pathNames,
    pathLabel: section.pathLabel,
    value: section.name || section.code || '',
    score,
    displayLabel: section.displayLabel
  }));
}

export function registerSearch({ onStateChange, onSuggestionsChange, getActiveDatabase } = {}) {
  const input = document.getElementById('search-input');
  if (!input || typeof onStateChange !== 'function') {
    return {
      applySuggestion: () => {},
      refreshSuggestions: () => {}
    };
  }

  let timer = null;
  let currentToken = 0;
  let state = buildEmptyState();
  let suggestionState = {
    query: '',
    suggestions: [],
    loading: false,
    error: null
  };
  let suggestionRequestId = 0;

  function emit(partial) {
    state = { ...state, ...partial };
    onStateChange(state);
  }

  function emitSuggestions(partial) {
    suggestionState = { ...suggestionState, ...partial };
    if (typeof onSuggestionsChange === 'function') {
      onSuggestionsChange(suggestionState);
    }
  }

  async function handleSuggestionQuery(value) {
    const rawToken = extractLastToken(value);
    if (!rawToken) {
      emitSuggestions({ query: '', suggestions: [], loading: false, error: null });
      return;
    }
    const database =
      (typeof getActiveDatabase === 'function' ? getActiveDatabase() : null) || CONFIG.defaultDatabase;
    if (!database) {
      emitSuggestions({
        query: rawToken,
        suggestions: [],
        loading: false,
        error: 'База данных не выбрана.'
      });
      return;
    }
    const requestId = ++suggestionRequestId;
    emitSuggestions({ query: rawToken, loading: true, error: null });
    try {
      const index = await ensureSectionIndex(database);
      if (requestId !== suggestionRequestId) {
        return;
      }
      const suggestions = buildSuggestions(index, rawToken, SUGGESTION_LIMIT);
      emitSuggestions({ query: rawToken, loading: false, suggestions, error: null });
    } catch (error) {
      if (requestId !== suggestionRequestId) {
        return;
      }
      emitSuggestions({
        query: rawToken,
        suggestions: [],
        loading: false,
        error: error?.message || 'Не удалось загрузить подсказки'
      });
    }
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
    handleSuggestionQuery(value);
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

  function applySuggestion(value = '') {
    if (!value) {
      return;
    }
    const nextValue = replaceLastToken(input.value, value);
    input.value = nextValue;
    input.setSelectionRange(nextValue.length, nextValue.length);
    input.focus();
    handleInput(nextValue);
  }

  function refreshSuggestions() {
    handleSuggestionQuery(input.value);
  }

  input.addEventListener('input', (event) => {
    handleInput(event.target.value);
  });

  emitSuggestions(suggestionState);
  handleSuggestionQuery(input.value);
  emit(state);

  return {
    applySuggestion,
    refreshSuggestions
  };
}
