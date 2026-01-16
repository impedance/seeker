import { CONFIG } from './config.js';
import { Navigation } from './navigation.js';
import { UI } from './ui.js';
import { registerSearch } from './search.js';

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
  UI.renderTree(
    snapshot.sections,
    snapshot.expanded,
    snapshot.selectedWork?.code,
    {
      onSectionToggle: (code) => Navigation.expandNode(code),
      onWorkSelect: (work) => Navigation.selectWork(work)
    },
    snapshot.error
  );
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

document.addEventListener('DOMContentLoaded', init);
