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
}

function handleSearchState(state) {
  latestSearchState = state;
  UI.renderSearchResults(state, searchHandlers);
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
  registerSearch({ onStateChange: handleSearchState });
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
