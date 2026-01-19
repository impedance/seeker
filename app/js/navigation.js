import { CONFIG } from './config.js';
import {
  getSections,
  getChildren,
  getWorkDetails,
  enrichResourcesWithCatalog,
  getResourceReference
} from './api.js';

const state = {
  currentDatabase: null,
  sections: [],
  expanded: new Set(),
  selectedWork: null,
  selectedResource: null,
  breadcrumbs: [],
  currentPath: [],
  loading: false,
  detailLoading: false,
  error: null,
  detailError: null,
  detailType: null,
  treeRevision: 0
};

const listeners = new Set();
const sectionCache = new Map();
const childrenCache = new Map();
const workCache = new Map();
let bootstrapped = false;

const historyStack = {
  past: [],
  future: [],
  current: null
};

function resetHistory() {
  historyStack.past = [];
  historyStack.future = [];
  historyStack.current = null;
}

function historyEntryEquals(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.type === b.type && a.database === b.database && a.code === b.code;
}

function recordHistoryEntry(entry) {
  if (!entry) {
    return;
  }
  if (historyEntryEquals(historyStack.current, entry)) {
    historyStack.current = entry;
    return;
  }
  if (historyStack.current) {
    historyStack.past.push(historyStack.current);
  }
  historyStack.current = entry;
  historyStack.future = [];
}

function getHistorySnapshot() {
  return {
    canGoBack: historyStack.past.length > 0,
    canGoForward: historyStack.future.length > 0,
    current: historyStack.current
  };
}

function bumpTreeRevision() {
  state.treeRevision += 1;
}

function cloneWorkDetails(work = null) {
  if (!work) {
    return null;
  }
  return {
    ...work,
    content: Array.isArray(work.content) ? [...work.content] : [],
    resources: (work.resources || []).map((resource) => ({ ...resource })),
    references: (work.references || []).map((reference) => ({ ...reference })),
    sectionPath: Array.isArray(work.sectionPath) ? [...work.sectionPath] : [],
    sectionNames: Array.isArray(work.sectionNames) ? [...work.sectionNames] : []
  };
}

function getSectionCacheKey(database, code) {
  return `${database}|${code}`;
}

function getSnapshot() {
  return {
    currentDatabase: state.currentDatabase,
    sections: state.sections,
    expanded: state.expanded,
    selectedWork: state.selectedWork,
    selectedResource: state.selectedResource ? { ...state.selectedResource } : null,
    breadcrumbs: [...state.breadcrumbs],
    currentPath: [...state.currentPath],
    loading: state.loading,
    detailLoading: state.detailLoading,
    error: state.error,
    detailError: state.detailError,
    detailType: state.detailType,
    treeRevision: state.treeRevision,
    history: getHistorySnapshot()
  };
}

function emit() {
  const snapshot = getSnapshot();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Navigation listener error', error);
    }
  });
}

function mergeSectionData(sectionData) {
  if (!sectionData || !sectionData.code) {
    return;
  }

  function walk(nodes = []) {
    for (const node of nodes) {
      if (node.code === sectionData.code) {
        node.children = Array.isArray(sectionData.children) ? sectionData.children : [];
        node.works = Array.isArray(sectionData.works) ? sectionData.works : [];
        node.hasChildren =
          Boolean(sectionData.hasChildren) || node.children.length > 0 || node.works.length > 0;
        return true;
      }
      if (walk(node.children)) {
        return true;
      }
    }
    return false;
  }

  if (!walk(state.sections) && sectionData.depth === 0) {
    state.sections.push(sectionData);
  }
}

async function loadSections(databaseId) {
  const targetDatabase = databaseId || state.currentDatabase || CONFIG.defaultDatabase;
  if (!targetDatabase) {
    state.error = 'Не выбрана база данных';
    bumpTreeRevision();
    emit();
    return;
  }

  state.loading = true;
  state.error = null;
  state.detailError = null;
  state.detailLoading = false;
  state.selectedWork = null;
  state.selectedResource = null;
  state.detailType = null;
  state.breadcrumbs = [];
  state.currentPath = [];
  state.expanded.clear();
  state.sections = [];
  bumpTreeRevision();
  emit();

  try {
    const cached = sectionCache.get(targetDatabase);
    if (cached) {
      state.sections = cached;
    } else {
      const sections = await getSections(targetDatabase);
      sectionCache.set(targetDatabase, sections);
      state.sections = sections;
    }
    state.currentDatabase = targetDatabase;
    bumpTreeRevision();
  } catch (error) {
    state.error = error?.message || 'Не удалось загрузить разделы';
    bumpTreeRevision();
  } finally {
    state.loading = false;
    emit();
    return state.sections;
  }
}

async function expandNode(sectionCode, options = {}) {
  if (!sectionCode) {
    return;
  }

  const isExpanded = state.expanded.has(sectionCode);
  if (isExpanded && options.toggle !== false) {
    state.expanded.delete(sectionCode);
    bumpTreeRevision();
    emit();
    return;
  }
  if (isExpanded && options.toggle === false) {
    emit();
    return;
  }

  if (!state.currentDatabase) {
    state.error = 'Сначала выберите базу';
    bumpTreeRevision();
    emit();
    return;
  }

  state.loading = true;
  state.error = null;
  emit();

  const cacheKey = getSectionCacheKey(state.currentDatabase, sectionCode);
  try {
    let sectionData = childrenCache.get(cacheKey);
    if (!sectionData) {
      const nodes = await getChildren(state.currentDatabase, sectionCode);
      const [root] = nodes;
      if (!root) {
        throw new Error('Раздел не найден');
      }
      sectionData = root;
      childrenCache.set(cacheKey, sectionData);
    }

    mergeSectionData(sectionData);
    state.expanded.add(sectionCode);
    bumpTreeRevision();
    state.error = null;
  } catch (error) {
    state.error = error?.message || 'Не удалось загрузить узел';
    bumpTreeRevision();
  } finally {
    state.loading = false;
    emit();
  }
}

async function selectWork(workSummary, options = {}) {
  if (!workSummary?.code) {
    return;
  }
  if (!state.currentDatabase) {
    state.detailError = 'Сначала выберите базу данных';
    emit();
    return;
  }

  const { recordHistory = true } = options;
  const workKey = getSectionCacheKey(state.currentDatabase, workSummary.code);
  state.detailLoading = true;
  state.detailError = null;
  state.detailType = 'work';
  state.selectedResource = null;
  emit();

  try {
    let details = workCache.get(workKey);
    if (details) {
      details = cloneWorkDetails(details);
    } else {
      const fetched = await getWorkDetails(state.currentDatabase, workSummary.code);
      if (!fetched) {
        throw new Error('Детали работы не найдены');
      }
      details = cloneWorkDetails(fetched);
    }

    details.resources = await enrichResourcesWithCatalog(details.resources);
    workCache.set(workKey, cloneWorkDetails(details));
    state.selectedWork = details;
    state.breadcrumbs = Array.isArray(details.sectionNames) ? [...details.sectionNames] : [];
    state.currentPath = Array.isArray(details.sectionPath) ? [...details.sectionPath] : [];
    state.detailError = null;

    if (recordHistory) {
      recordHistoryEntry({
        type: 'work',
        database: state.currentDatabase,
        code: details.code,
        sectionPath: Array.isArray(details.sectionPath) ? [...details.sectionPath] : [],
        sectionNames: Array.isArray(details.sectionNames) ? [...details.sectionNames] : []
      });
    }
  } catch (error) {
    state.selectedWork = null;
    state.breadcrumbs = [];
    state.currentPath = [];
    state.detailError = error?.message || 'Не удалось загрузить детали работы';
  } finally {
    state.detailLoading = false;
    emit();
  }
}

async function selectResource(resourceInfo, options = {}) {
  const resourceCode = resourceInfo?.code;
  if (!resourceCode) {
    return;
  }
  const { recordHistory = true } = options;
  state.detailLoading = true;
  state.detailError = null;
  state.detailType = 'resource';
  emit();

  try {
    const reference = await getResourceReference(resourceCode);
    if (!reference) {
      throw new Error('Данные ресурса не найдены');
    }
    state.selectedWork = null;
    state.selectedResource = reference;
    state.breadcrumbs = Array.isArray(reference.sectionNames) ? [...reference.sectionNames] : [];
    state.currentPath = Array.isArray(reference.sectionPath) ? [...reference.sectionPath] : [];
    state.detailError = null;
    if (recordHistory) {
      recordHistoryEntry({
        type: 'resource',
        database: reference.database,
        code: reference.code,
        sectionPath: Array.isArray(reference.sectionPath) ? [...reference.sectionPath] : [],
        sectionNames: Array.isArray(reference.sectionNames) ? [...reference.sectionNames] : []
      });
    }
  } catch (error) {
    state.selectedResource = null;
    state.detailError = error?.message || 'Не удалось загрузить ресурс';
  } finally {
    state.detailLoading = false;
    emit();
  }
}

async function focusBreadcrumb(index) {
  const path = state.currentPath || [];
  if (index == null || index < 0 || index >= path.length) {
    return;
  }

  const code = path[index];
  state.currentPath = path.slice(0, index + 1);
  state.breadcrumbs = (state.selectedWork?.sectionNames || []).slice(0, index + 1);
  emit();
  await expandNode(code, { toggle: false });
}

async function navigateToHistoryEntry(entry) {
  if (!entry) {
    return;
  }
  if (entry.type === 'work') {
    if (state.currentDatabase !== entry.database) {
      await loadSections(entry.database);
    }
    if (Array.isArray(entry.sectionPath)) {
      for (const sectionCode of entry.sectionPath) {
        if (sectionCode) {
          await expandNode(sectionCode, { toggle: false });
        }
      }
    }
    await selectWork({ code: entry.code }, { recordHistory: false });
  } else if (entry.type === 'resource') {
    await selectResource({ code: entry.code }, { recordHistory: false });
  }
}

async function navigateHistory(direction) {
  const source = direction === 'back' ? historyStack.past : historyStack.future;
  const destination = direction === 'back' ? historyStack.future : historyStack.past;
  if (!historyStack.current || !source.length) {
    return;
  }
  const nextEntry = source.pop();
  destination.push(historyStack.current);
  historyStack.current = nextEntry;
  emit();
  await navigateToHistoryEntry(nextEntry);
}

function goBack() {
  return navigateHistory('back');
}

function goForward() {
  return navigateHistory('forward');
}

export const Navigation = {
  init() {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    resetHistory();
    loadSections(CONFIG.defaultDatabase);
  },
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return;
    }
    listeners.add(listener);
    listener(getSnapshot());
    return () => listeners.delete(listener);
  },
  unsubscribe(listener) {
    listeners.delete(listener);
  },
  loadSections,
  expandNode,
  selectWork,
  selectResource,
  focusBreadcrumb,
  goBack,
  goForward,
  get state() {
    return state;
  }
};
