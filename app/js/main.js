import { CONFIG } from './config.js';
import { Navigation } from './navigation.js';
import { UI } from './ui.js';
import { registerSearch } from './search.js';

function renderSectionsList() {
  const list = document.getElementById('sections-list');
  if (!list) return;
  list.innerHTML = '';
  const databaseItems = CONFIG.databases.length
    ? CONFIG.databases
    : [{ id: 'placeholder', name: 'Database not configured' }];

  databaseItems.forEach((db) => {
    const li = document.createElement('li');
    li.textContent = db.name;
    li.dataset.database = db.id;
    li.className = 'section-item';
    list.appendChild(li);
  });
}

function renderTreeHint() {
  const tree = document.getElementById('tree-view');
  if (!tree) return;
  tree.innerHTML = '<p class="placeholder">Tree will appear once data is loaded.</p>';
}

function renderDetailsPlaceholder() {
  const details = document.getElementById('details-panel');
  if (!details) return;
  const body = details.querySelector('.panel-body');
  if (body) {
    body.innerHTML = '<p class="placeholder">Select a node to see details.</p>';
  }
}

function attachSectionEvents() {
  const list = document.getElementById('sections-list');
  if (!list) return;
  list.addEventListener('click', (event) => {
    const target = event.target;
    if (target && target.dataset) {
      const id = target.dataset.database;
      if (id) {
      console.debug('Selected database:', id);
      }
    }
  });
}

function init() {
  Navigation.init();
  renderSectionsList();
  renderTreeHint();
  renderDetailsPlaceholder();
  attachSectionEvents();
  registerSearch((query) => {
    console.debug('Search query:', query);
  });
  UI.setLoader(false);
}

document.addEventListener('DOMContentLoaded', init);
