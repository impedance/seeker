import { CONFIG } from './config.js';
import {
  search as executeSearch,
  getSectionIndex,
  getWorkSuggestions,
  getResourceSuggestions
} from './api.js';
const SEARCHABLE_DATABASES = Array.isArray(CONFIG.databases)
  ? CONFIG.databases.filter((db) => db.searchable !== false)
  : [];
const SUGGESTION_CONFIG = CONFIG.searchSuggestions || {};
const SUGGESTION_LIMITS = {
  section: SUGGESTION_CONFIG.sectionLimit ?? 6,
  work: SUGGESTION_CONFIG.workLimit ?? 5,
  resource: SUGGESTION_CONFIG.resourceLimit ?? 5,
  total: SUGGESTION_CONFIG.totalLimit ?? 12
};
const SUGGESTION_FETCH_LIMITS = {
  work: SUGGESTION_CONFIG.workFetchLimit ?? 40,
  resource: SUGGESTION_CONFIG.resourceFetchLimit ?? 40
};
const SUGGESTION_MIN_SCORES = {
  section: SUGGESTION_CONFIG.sectionMinScore ?? 0.28,
  work: SUGGESTION_CONFIG.workMinScore ?? 0.32,
  resource: SUGGESTION_CONFIG.resourceMinScore ?? 0.38
};
const SUGGESTION_MIN_TOKEN = {
  section: SUGGESTION_CONFIG.sectionMinToken ?? 1,
  work: SUGGESTION_CONFIG.workMinToken ?? 2,
  resource: SUGGESTION_CONFIG.resourceMinToken ?? 2
};
const SUGGESTION_CACHE_TTL = CONFIG.cacheTTL ?? 120_000;

const sectionIndexCache = new Map();
const sectionIndexPromises = new Map();
const suggestionCache = new Map();

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

function parseSearchTokens(value = '') {
  const trimmed = (value || '').trim();
  const rawTokens = trimmed ? trimmed.split(/\s+/) : [];
  const normalizedValue = normalizeText(trimmed);
  const normalizedTokens = normalizedValue ? normalizedValue.split(/\s+/).filter(Boolean) : [];
  const normalizedLength = normalizedTokens.reduce((sum, token) => sum + token.length, 0);
  const lastTokenRaw = rawTokens.length ? rawTokens[rawTokens.length - 1] : '';
  return {
    trimmed,
    normalizedTokens,
    normalizedLength,
    lastTokenRaw
  };
}

function shouldFetchSuggestions(tokens, normalizedLength, minToken) {
  if (!tokens.length) {
    return false;
  }
  if (!Number.isFinite(minToken) || minToken <= 0) {
    return true;
  }
  if (normalizedLength >= minToken) {
    return true;
  }
  return tokens.some((token) => token.length >= minToken);
}

function matchesAllTokens(entry, tokens) {
  return tokens.every((token) => {
    if (!token) {
      return false;
    }
    return (
      entry.normalizedName.includes(token) ||
      entry.normalizedCode.includes(token) ||
      entry.normalizedPath.includes(token)
    );
  });
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

function getSuggestionCache(key) {
  const cached = suggestionCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt < Date.now()) {
    suggestionCache.delete(key);
    return null;
  }
  return cached.value;
}

function setSuggestionCache(key, value) {
  suggestionCache.set(key, {
    value,
    expiresAt: Date.now() + SUGGESTION_CACHE_TTL
  });
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

function computeTokenMatchScore(normalizedToken, entry, pathWeight = 0.85) {
  return Math.max(
    computeScoreNormalized(normalizedToken, entry.normalizedName),
    computeScoreNormalized(normalizedToken, entry.normalizedCode),
    computeScoreNormalized(normalizedToken, entry.normalizedPath) * pathWeight
  );
}

function computeEntryScore(tokens = [], entry = {}) {
  if (!tokens.length) {
    return 0;
  }
  const tokenScores = tokens.map((token) => computeTokenMatchScore(token, entry));
  const baseScore = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const pathBonus = tokens.reduce((bonus, token) => {
    const path = entry.normalizedPath || '';
    if (!path.length) {
      return bonus;
    }
    const index = path.indexOf(token);
    if (index < 0) {
      return bonus;
    }
    const closeness = 1 - index / (path.length || 1);
    const increment = Math.min(0.05, Math.max(0, closeness) * 0.05);
    return bonus + increment;
  }, 0);
  return Math.min(1, baseScore + pathBonus);
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

function formatWorkForSuggestions(entry = {}) {
  const pathNames = Array.isArray(entry.sectionNames) ? entry.sectionNames.filter(Boolean) : [];
  const pathCodes = Array.isArray(entry.sectionPath) ? entry.sectionPath.filter(Boolean) : [];
  const pathLabel = pathNames.length ? pathNames.join(' › ') : '';
  return {
    code: entry.code || '',
    name: entry.name || '',
    sectionPath: pathCodes,
    sectionNames: pathNames,
    pathLabel,
    normalizedName: normalizeText(entry.name),
    normalizedCode: normalizeText(entry.code),
    normalizedPath: normalizeText(pathLabel),
    displayLabel: entry.name || entry.code || 'Работа'
  };
}

function formatResourceForSuggestions(entry = {}) {
  const pathNames = Array.isArray(entry.sectionNames) ? entry.sectionNames.filter(Boolean) : [];
  const pathCodes = Array.isArray(entry.sectionPath) ? entry.sectionPath.filter(Boolean) : [];
  const pathLabel = pathNames.length ? pathNames.join(' › ') : '';
  return {
    code: entry.code || '',
    name: entry.name || '',
    sectionPath: pathCodes,
    sectionNames: pathNames,
    pathLabel,
    normalizedName: normalizeText(entry.name),
    normalizedCode: normalizeText(entry.code),
    normalizedPath: normalizeText(pathLabel),
    displayLabel: entry.name || entry.code || 'Ресурс'
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

function buildSuggestions(
  index = [],
  tokens = [],
  limit = SUGGESTION_LIMITS.section,
  minScore = SUGGESTION_MIN_SCORES.section
) {
  if (!tokens.length || !index.length) {
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
    if (!matchesAllTokens(section, tokens)) {
      return;
    }
    const score = computeEntryScore(tokens, section);
    if (score < minScore) {
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
    type: 'section',
    code: section.code,
    name: section.name,
    pathNames: section.pathNames,
    pathLabel: section.pathLabel,
    value: section.name || section.code || '',
    inputValue: section.name || section.code || '',
    score,
    displayLabel: section.displayLabel
  }));
}

function buildEntitySuggestions(entries = [], tokens = [], limit, minScore, type) {
  if (!tokens.length || !entries.length) {
    return [];
  }

  const scored = [];
  const seen = new Set();

  entries.forEach((entry) => {
    if (!entry) {
      return;
    }
    const identifier = entry.code || entry.name || entry.pathLabel;
    if (!identifier || seen.has(identifier)) {
      return;
    }
    if (!matchesAllTokens(entry, tokens)) {
      return;
    }
    const score = computeEntryScore(tokens, entry);
    if (score < minScore) {
      return;
    }
    seen.add(identifier);
    scored.push({ entry, score });
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return String(a.entry.code || '').localeCompare(String(b.entry.code || ''));
  });

  return scored.slice(0, limit).map(({ entry, score }) => ({
    type,
    code: entry.code,
    name: entry.name,
    pathLabel: entry.pathLabel,
    sectionPath: entry.sectionPath,
    sectionNames: entry.sectionNames,
    value: entry.name || entry.code || '',
    inputValue: entry.code || entry.name || '',
    score,
    displayLabel: entry.displayLabel
  }));
}

function buildSuggestionGroups({ sections = [], works = [], resources = [] }, totalLimit) {
  const groups = [];
  if (sections.length) {
    groups.push({ id: 'section', label: 'Разделы', items: sections });
  }
  if (works.length) {
    groups.push({ id: 'work', label: 'Работы', items: works });
  }
  if (resources.length) {
    groups.push({ id: 'resource', label: 'Ресурсы', items: resources });
  }
  if (!Number.isFinite(totalLimit) || totalLimit <= 0) {
    return groups;
  }
  let remaining = totalLimit;
  const trimmed = groups.map((group) => {
    if (remaining <= 0) {
      return { ...group, items: [] };
    }
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    return { ...group, items };
  });
  return trimmed.filter((group) => group.items.length);
}

function flattenGroups(groups = []) {
  return groups.reduce((acc, group) => acc.concat(group.items || []), []);
}

export function registerSearch({ onStateChange, onSuggestionsChange, getActiveDatabase } = {}) {
  const input = document.getElementById('search-input');
  if (!input || typeof onStateChange !== 'function') {
    return {
      applySuggestion: () => {},
      refreshSuggestions: () => {}
    };
  }

  let currentToken = 0;
  let state = buildEmptyState();
  let suggestionState = {
    query: '',
    groups: [],
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
    const {
      trimmed,
      normalizedTokens,
      normalizedLength,
      lastTokenRaw
    } = parseSearchTokens(value);
    if (!normalizedTokens.length) {
      emitSuggestions({ query: trimmed, groups: [], suggestions: [], loading: false, error: null });
      return;
    }
    const database =
      (typeof getActiveDatabase === 'function' ? getActiveDatabase() : null) || CONFIG.defaultDatabase;
    if (!database) {
      emitSuggestions({
        query: trimmed,
        groups: [],
        suggestions: [],
        loading: false,
        error: 'База данных не выбрана.'
      });
      return;
    }
    const tokenSignature = normalizedTokens.join(' ');
    const requestId = ++suggestionRequestId;
    emitSuggestions({ query: trimmed, loading: true, error: null });
    try {
      const errors = [];
      const fetchSections = async () => {
        if (!shouldFetchSuggestions(normalizedTokens, normalizedLength, SUGGESTION_MIN_TOKEN.section)) {
          return [];
        }
        const index = await ensureSectionIndex(database);
        return buildSuggestions(
          index,
          normalizedTokens,
          SUGGESTION_LIMITS.section,
          SUGGESTION_MIN_SCORES.section
        );
      };
      const fetchWorkSuggestions = async () => {
        if (!shouldFetchSuggestions(normalizedTokens, normalizedLength, SUGGESTION_MIN_TOKEN.work)) {
          return [];
        }
        if (!lastTokenRaw) {
          return [];
        }
        const cacheKey = `${database}|work|${tokenSignature}`;
        const cached = getSuggestionCache(cacheKey);
        if (cached) {
          return cached;
        }
        const entries = await getWorkSuggestions(database, lastTokenRaw, SUGGESTION_FETCH_LIMITS.work);
        const formatted = Array.isArray(entries) ? entries.map(formatWorkForSuggestions) : [];
        const suggestions = buildEntitySuggestions(
          formatted,
          normalizedTokens,
          SUGGESTION_LIMITS.work,
          SUGGESTION_MIN_SCORES.work,
          'work'
        ).map((suggestion) => ({ ...suggestion, database }));
        setSuggestionCache(cacheKey, suggestions);
        return suggestions;
      };
      const fetchResourceSuggestions = async () => {
        if (!shouldFetchSuggestions(normalizedTokens, normalizedLength, SUGGESTION_MIN_TOKEN.resource)) {
          return [];
        }
        if (!lastTokenRaw) {
          return [];
        }
        const cacheKey = `${database}|resource|${tokenSignature}`;
        const cached = getSuggestionCache(cacheKey);
        if (cached) {
          return cached;
        }
        const entries = await getResourceSuggestions(database, lastTokenRaw, SUGGESTION_FETCH_LIMITS.resource);
        const formatted = Array.isArray(entries) ? entries.map(formatResourceForSuggestions) : [];
        const suggestions = buildEntitySuggestions(
          formatted,
          normalizedTokens,
          SUGGESTION_LIMITS.resource,
          SUGGESTION_MIN_SCORES.resource,
          'resource'
        ).map((suggestion) => ({ ...suggestion, database }));
        setSuggestionCache(cacheKey, suggestions);
        return suggestions;
      };

      const [sections, works, resources] = await Promise.all([
        fetchSections().catch((error) => {
          errors.push(error);
          return [];
        }),
        fetchWorkSuggestions().catch((error) => {
          errors.push(error);
          return [];
        }),
        fetchResourceSuggestions().catch((error) => {
          errors.push(error);
          return [];
        })
      ]);
      if (requestId !== suggestionRequestId) {
        return;
      }
      const groups = buildSuggestionGroups(
        { sections, works, resources },
        Number.isFinite(SUGGESTION_LIMITS.total) ? SUGGESTION_LIMITS.total : null
      );
      const suggestions = flattenGroups(groups);
      const errorMessage =
        errors.length && !suggestions.length
          ? errors[0]?.message || 'Не удалось загрузить подсказки'
          : null;
      emitSuggestions({
        query: trimmed,
        groups,
        loading: false,
        suggestions,
        error: errorMessage
      });
    } catch (error) {
      if (requestId !== suggestionRequestId) {
        return;
      }
      emitSuggestions({
        query: trimmed,
        groups: [],
        suggestions: [],
        loading: false,
        error: error?.message || 'Не удалось загрузить подсказки'
      });
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

  function submitSearch(value) {
    const nextQuery = (value || '').trim();
    if (!nextQuery) {
      emit(buildEmptyState());
      return;
    }
    const token = ++currentToken;
    runSearch(nextQuery, token);
  }

  function handleInput(value) {
    handleSuggestionQuery(value);
    const nextQuery = (value || '').trim();
    if (!nextQuery) {
      emit(buildEmptyState());
    }
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
    submitSearch(nextValue);
  }

  function refreshSuggestions() {
    handleSuggestionQuery(input.value);
  }

  input.addEventListener('input', (event) => {
    handleInput(event.target.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      submitSearch(input.value);
    }
  });

  const submitButton = document.getElementById('search-submit');
  if (submitButton) {
    submitButton.addEventListener('click', () => {
      submitSearch(input.value);
    });
  }

  emitSuggestions(suggestionState);
  handleSuggestionQuery(input.value);
  emit(state);

  return {
    applySuggestion,
    refreshSuggestions,
    submitSearch
  };
}
