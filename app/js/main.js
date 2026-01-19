import { CONFIG } from './config.js';
import { Navigation } from './navigation.js';
import { UI } from './ui.js';
import { registerSearch } from './search.js';

const THEME_STORAGE_KEY = 'gesn-viewer-theme';
const Theme = {
  DARK: 'dark',
  LIGHT: 'light'
};
const themeIconMap = {
  [Theme.DARK]: 'bi bi-sun-fill',
  [Theme.LIGHT]: 'bi bi-moon-fill'
};
let currentTheme = Theme.DARK;

function readStoredTheme() {
  try {
    return window.localStorage?.getItem(THEME_STORAGE_KEY) || null;
  } catch (error) {
    console.warn('Не удалось прочитать тему из localStorage', error);
    return null;
  }
}

function persistTheme(theme) {
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Не удалось сохранить тему в localStorage', error);
  }
}

function applyTheme(theme) {
  if (!theme) {
    return;
  }
  currentTheme = theme;
  [document.documentElement, document.body].forEach((element) => {
    if (element) {
      element.dataset.theme = theme;
    }
  });
  const toggleIcon = document.querySelector('#theme-toggle i');
  if (toggleIcon) {
    toggleIcon.className = themeIconMap[theme] || themeIconMap[Theme.DARK];
  }
  const toggleButton = document.getElementById('theme-toggle');
  if (toggleButton) {
    const isDark = theme === Theme.DARK;
    toggleButton.setAttribute('aria-pressed', String(isDark));
    toggleButton.setAttribute(
      'aria-label',
      isDark ? 'Переключиться на светлую тему' : 'Переключиться на тёмную тему'
    );
  }
}

function initTheme() {
  const preferredTheme = readStoredTheme();
  const initialTheme = preferredTheme === Theme.LIGHT ? Theme.LIGHT : Theme.DARK;
  applyTheme(initialTheme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = currentTheme === Theme.DARK ? Theme.LIGHT : Theme.DARK;
      applyTheme(nextTheme);
      persistTheme(nextTheme);
    });
  }
}

const searchHandlers = {
  onHitSelect(databaseId, hit) {
    handleSearchSelection(databaseId, hit);
  }
};

let searchController = null;

let latestSearchState = {
  query: '',
  loading: false,
  groups: [],
  error: null
};

let lastTreeRevision = null;
let lastTreeSectionsRef = null;

function updateHistoryControls(snapshot) {
  const backButton = document.getElementById('nav-back');
  const forwardButton = document.getElementById('nav-forward');
  if (backButton) {
    backButton.disabled = !snapshot.history?.canGoBack;
  }
  if (forwardButton) {
    forwardButton.disabled = !snapshot.history?.canGoForward;
  }
}

function handleNavigationUpdate(snapshot) {
  UI.renderDatabaseList(CONFIG.databases, snapshot.currentDatabase, (databaseId) => {
    Navigation.loadSections(databaseId);
  });

  const treeHandlers = {
    onSectionToggle: (code) => Navigation.expandNode(code),
    onWorkSelect: (work) => Navigation.selectWork(work)
  };

  const shouldRenderTree =
    snapshot.treeRevision !== lastTreeRevision || snapshot.sections !== lastTreeSectionsRef;
  if (shouldRenderTree) {
    UI.renderTree(snapshot.sections, snapshot.expanded, snapshot.selectedWork?.code, treeHandlers, snapshot.error);
    lastTreeRevision = snapshot.treeRevision;
    lastTreeSectionsRef = snapshot.sections;
  } else {
    UI.setActiveWork(snapshot.selectedWork?.code);
  }

  UI.renderBreadcrumbs(snapshot.breadcrumbs, (index) => {
    Navigation.focusBreadcrumb(index);
  });
  UI.renderDetails(
    {
      type: snapshot.detailType,
      work: snapshot.selectedWork,
      resource: snapshot.selectedResource
    },
    {
      loading: snapshot.detailLoading,
      error: snapshot.detailError
    },
    {
      onResourceSelect: (resource) => Navigation.selectResource(resource)
    }
  );
  UI.renderSearchResults(latestSearchState, searchHandlers);
  UI.setLoader(snapshot.loading);
  updateHistoryControls(snapshot);
  searchController?.refreshSuggestions();
}

function handleSearchState(state) {
  latestSearchState = state;
  UI.renderSearchResults(state, searchHandlers);
}

const suggestionSelection = CONFIG.searchSuggestionSelection || {};

function getSuggestionInputValue(suggestion) {
  return suggestion?.inputValue || suggestion?.value || suggestion?.name || suggestion?.code || '';
}

async function navigateToWorkSuggestion(suggestion) {
  if (!suggestion?.code) {
    return;
  }
  try {
    const targetDatabase = suggestion.database || Navigation.state.currentDatabase;
    if (targetDatabase && Navigation.state.currentDatabase !== targetDatabase) {
      await Navigation.loadSections(targetDatabase);
    }
    if (Array.isArray(suggestion.sectionPath)) {
      for (const code of suggestion.sectionPath) {
        if (code) {
          await Navigation.expandNode(code, { toggle: false });
        }
      }
    }
    await Navigation.selectWork({ code: suggestion.code });
  } catch (error) {
    console.error('Не удалось перейти к работе из подсказки', error);
  }
}

async function navigateToResourceSuggestion(suggestion) {
  if (!suggestion?.code) {
    return;
  }
  try {
    await Navigation.selectResource({ code: suggestion.code });
  } catch (error) {
    console.error('Не удалось перейти к ресурсу из подсказки', error);
  }
}

async function handleSuggestionSelection(suggestion) {
  if (!suggestion) {
    return;
  }
  const type = suggestion.type || 'section';
  const mode = suggestionSelection[type] || 'input';
  if (mode === 'navigate') {
    if (type === 'work') {
      await navigateToWorkSuggestion(suggestion);
      return;
    }
    if (type === 'resource') {
      await navigateToResourceSuggestion(suggestion);
      return;
    }
  }
  const text = getSuggestionInputValue(suggestion);
  if (!text) {
    return;
  }
  searchController?.applySuggestion(text);
}

function handleSuggestionState(state) {
  UI.renderSearchSuggestions(state, {
    onSuggestion: handleSuggestionSelection
  });
}

async function handleSearchSelection(databaseId, hit) {
  if (!hit?.code) {
    return;
  }
  try {
    if (Navigation.state.currentDatabase !== databaseId) {
      await Navigation.loadSections(databaseId);
    }
    if (Array.isArray(hit.sectionPath)) {
      for (const code of hit.sectionPath) {
        if (code) {
          await Navigation.expandNode(code, { toggle: false });
        }
      }
    }
    Navigation.selectWork({ code: hit.code });
  } catch (error) {
    console.error('Не удалось перейти к результату поиска', error);
  }
}

function init() {
  UI.clearDetails();
  initTheme();
  Navigation.subscribe(handleNavigationUpdate);
  Navigation.init();
  searchController = registerSearch({
    onStateChange: handleSearchState,
    onSuggestionsChange: handleSuggestionState,
    getActiveDatabase: () => Navigation.state.currentDatabase
  });
  const backButton = document.getElementById('nav-back');
  const forwardButton = document.getElementById('nav-forward');
  if (backButton) {
    backButton.addEventListener('click', () => Navigation.goBack());
  }
  if (forwardButton) {
    forwardButton.addEventListener('click', () => Navigation.goForward());
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
