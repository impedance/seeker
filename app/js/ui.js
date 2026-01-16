function getElement(id) {
  return document.getElementById(id);
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

function buildResourceTable(resources = [], handlers = {}) {
  const container = document.createElement('div');
  container.className = 'resource-section';

  const title = document.createElement('h4');
  title.textContent = 'Ресурсы';
  container.appendChild(title);

  if (!resources.length) {
    const empty = document.createElement('p');
    empty.className = 'placeholder';
    empty.textContent = 'Ресурсы не заданы.';
    container.appendChild(empty);
    return container;
  }

  const table = document.createElement('table');
  table.className = 'resource-table';
  const thead = table.createTHead();
  const headRow = thead.insertRow();
  ['Код', 'Название', 'Кол-во', 'Ед.изм.', 'Цена', 'Статус'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });

  const tbody = table.createTBody();
  resources.forEach((resource) => {
    const row = tbody.insertRow();
    row.className = 'resource-row';

    const hasPrice = Boolean(resource?.price?.cost || resource?.price?.optCost);
    row.classList.add(hasPrice ? 'has-price' : 'missing-price');

    const catalogDatabase = resource.catalogDatabase || resource.catalog?.database;
    const isClickable = !!(handlers.onResourceSelect && resource.code && catalogDatabase);
    if (isClickable) {
      row.classList.add('is-clickable');
      row.addEventListener('click', () => handlers.onResourceSelect(resource));
      row.title = 'Открыть справочник';
    }

    const codeCell = row.insertCell();
    codeCell.textContent = resource.code || '';
    const nameCell = row.insertCell();
    nameCell.textContent = resource.name || '';
    const quantityCell = row.insertCell();
    quantityCell.textContent = resource.quantity ? resource.quantity.toString() : '—';
    const unitCell = row.insertCell();
    unitCell.textContent = resource.measureUnit || '';
    const priceCell = row.insertCell();
    priceCell.className = 'price-cell';
    const priceValue = formatPrice(resource.price?.cost);
    if (priceValue) {
      const priceWrapper = document.createElement('span');
      priceWrapper.className = 'price-value';
      const amount = document.createElement('span');
      amount.className = 'price-amount';
      amount.textContent = priceValue;
      priceWrapper.appendChild(amount);
      if (resource.price?.optCost) {
        const opt = document.createElement('small');
        opt.textContent = ` (opt ${formatPrice(resource.price.optCost)})`;
        priceWrapper.appendChild(opt);
      }
      priceCell.appendChild(priceWrapper);
    } else {
      priceCell.textContent = '—';
    }
    const statusCell = row.insertCell();
    const statusText = hasPrice ? 'Есть цена' : 'Нет цены';
    statusCell.textContent = statusText;
    statusCell.className = hasPrice ? 'status-ok' : 'status-missing';
  });

  container.appendChild(table);
  return container;
}

function createWorkNode(work, level, handlers, selectedWorkCode) {
  const row = document.createElement('div');
  row.className = 'tree-item work-node';
  row.dataset.type = 'work';
  row.dataset.code = work.code || '';
  row.dataset.level = level;

  const info = document.createElement('div');
  info.className = 'item-meta';

  const title = document.createElement('span');
  title.className = 'item-name';
  title.textContent = work.name || work.code || '—';
  info.appendChild(title);

  if (work.code) {
    const code = document.createElement('span');
    code.className = 'item-code';
    code.textContent = work.code;
    info.appendChild(code);
  }

  row.appendChild(info);

  if (work.measureUnit) {
    const badge = document.createElement('span');
    badge.className = 'badge bg-light text-muted';
    badge.textContent = work.measureUnit;
    row.appendChild(badge);
  }

  if (selectedWorkCode && work.code === selectedWorkCode) {
    row.classList.add('active');
  }

  row.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onWorkSelect?.(work);
  });
  return row;
}

function createSectionNode(section, level, expandedSet, handlers, selectedWorkCode) {
  const fragment = document.createDocumentFragment();
  const row = document.createElement('div');
  row.className = 'tree-item section-node';
  row.dataset.type = 'section';
  row.dataset.code = section.code || '';
  row.dataset.level = level;

  const info = document.createElement('div');
  info.className = 'item-meta';

  const title = document.createElement('span');
  title.className = 'item-name';
  title.textContent = section.name || section.code || '—';
  info.appendChild(title);

  if (section.code) {
    const code = document.createElement('span');
    code.className = 'item-code';
    code.textContent = section.code;
    info.appendChild(code);
  }

  row.appendChild(info);

  const hasChildren = (Array.isArray(section.children) && section.children.length) || (Array.isArray(section.works) && section.works.length);
  if (hasChildren) {
    row.classList.add('expandable');
    const icon = document.createElement('span');
    icon.className = 'expand-icon bi bi-caret-right-fill';
    row.appendChild(icon);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'expand-icon';
    row.appendChild(spacer);
  }

  if (expandedSet.has(section.code)) {
    row.classList.add('expanded');
  }

  row.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onSectionToggle?.(section.code);
  });

  fragment.appendChild(row);

  if (expandedSet.has(section.code)) {
    const childLevel = level + 1;
    if (Array.isArray(section.children)) {
      section.children.forEach((child) => {
        fragment.appendChild(createSectionNode(child, childLevel, expandedSet, handlers, selectedWorkCode));
      });
    }
    if (Array.isArray(section.works)) {
      section.works.forEach((work) => {
        fragment.appendChild(createWorkNode(work, childLevel, handlers, selectedWorkCode));
      });
    }
  }

  return fragment;
}

function renderTreeContent(sections, expanded, selectedWorkCode, handlers, error) {
  const container = getElement('tree-view');
  if (!container) {
    return;
  }
  container.innerHTML = '';

  if (error) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger mb-0';
    alert.textContent = error;
    container.appendChild(alert);
    return;
  }

  if (!sections || !sections.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Выберите базу, чтобы увидеть содержимое.';
    container.appendChild(placeholder);
    return;
  }

  const expandedSet = expanded instanceof Set ? expanded : new Set(expanded);
  const fragment = document.createDocumentFragment();
  sections.forEach((section) => {
    fragment.appendChild(createSectionNode(section, 0, expandedSet, handlers, selectedWorkCode));
  });
  container.appendChild(fragment);
}

function renderResourceCard(resource) {
  if (!resource) {
    return null;
  }
  const card = document.createElement('article');
  card.className = 'details-card resource-card';

  const heading = document.createElement('h3');
  heading.textContent = resource.name || resource.code || '—';
  card.appendChild(heading);

  const meta = document.createElement('p');
  meta.className = 'meta';
  const metaParts = ['Код: ' + (resource.code || '—')];
  if (resource.measureUnit) {
    metaParts.push('Ед.изм.: ' + resource.measureUnit);
  }
  meta.textContent = metaParts.join(' · ');
  card.appendChild(meta);

  const priceLine = document.createElement('p');
  priceLine.className = 'price-line';
  const priceValue = formatPrice(resource.price?.cost);
  if (priceValue) {
    priceLine.textContent = `Цена: ${priceValue}`;
    if (resource.price?.optCost) {
      priceLine.textContent += ` (opt ${formatPrice(resource.price.optCost)})`;
    }
  } else {
    priceLine.textContent = 'Цена отсутствует.';
  }
  card.appendChild(priceLine);

  const sectionNames = resource.catalogSectionNames || resource.sectionNames;
  if (Array.isArray(sectionNames) && sectionNames.length) {
    const path = document.createElement('p');
    path.className = 'path-line';
    path.textContent = 'Категории: ' + sectionNames.join(' › ');
    card.appendChild(path);
  }

  const catalogSource = resource.catalogDatabase || resource.database;
  if (catalogSource) {
    const source = document.createElement('p');
    source.className = 'text-muted';
    source.textContent = `Справочник: ${catalogSource}`;
    card.appendChild(source);
  }

  return card;
}

function renderDetailContent(detailState = {}, options = {}, handlers = {}) {
  const container = getElement('details-content');
  if (!container) {
    return;
  }
  container.innerHTML = '';

  if (options.error) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.textContent = options.error;
    container.appendChild(alert);
    return;
  }

  if (options.loading) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Загрузка...';
    container.appendChild(placeholder);
    return;
  }

  const { type, work, resource } = detailState || {};

  if (type === 'resource') {
    const card = renderResourceCard(resource);
    if (!card) {
      const placeholder = document.createElement('p');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'Ресурс не найден.';
      container.appendChild(placeholder);
      return;
    }
    container.appendChild(card);
    return;
  }

  if (!work) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Выберите элемент для просмотра.';
    container.appendChild(placeholder);
    return;
  }

  const card = document.createElement('article');
  card.className = 'details-card';

  const heading = document.createElement('h3');
  heading.textContent = work.name || work.code || '—';
  card.appendChild(heading);

  const meta = document.createElement('p');
  meta.className = 'meta';
  const metaParts = ['Код: ' + (work.code || '—')];
  if (work.measureUnit) {
    metaParts.push('Ед.изм.: ' + work.measureUnit);
  }
  meta.textContent = metaParts.join(' · ');
  card.appendChild(meta);

  const description = document.createElement('p');
  description.textContent = work.description || work.endName || 'Описание отсутствует.';
  card.appendChild(description);
  container.appendChild(card);

  if (Array.isArray(work.content) && work.content.length) {
    const contentBlock = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = 'Состав';
    contentBlock.appendChild(title);
    const list = document.createElement('ul');
    work.content.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    contentBlock.appendChild(list);
    container.appendChild(contentBlock);
  }

  container.appendChild(buildResourceTable(work.resources || [], handlers));

  if (Array.isArray(work.references) && work.references.length) {
    const refs = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = 'Ссылки';
    refs.appendChild(title);
    const list = document.createElement('ul');
    work.references.forEach((reference) => {
      const li = document.createElement('li');
      li.textContent = `${reference.nr || '—'} / ${reference.sp || '—'}`;
      list.appendChild(li);
    });
    refs.appendChild(list);
    container.appendChild(refs);
  }
}

function renderBreadcrumbTrail(names = [], onBreadcrumbClick) {
  const container = getElement('details-breadcrumbs');
  if (!container) {
    return;
  }
  container.innerHTML = '';

  if (!names || !names.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Путь появится после выбора работы.';
    container.appendChild(placeholder);
    return;
  }

  const list = document.createElement('ol');
  list.className = 'breadcrumb mb-0';

  names.forEach((name, index) => {
    const item = document.createElement('li');
    item.className = 'breadcrumb-item';
    if (index === names.length - 1) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
      item.textContent = name || '—';
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'breadcrumb-link';
      button.textContent = name || '—';
      button.addEventListener('click', () => onBreadcrumbClick?.(index));
      item.appendChild(button);
    }
    list.appendChild(item);
  });

  container.appendChild(list);
}

function renderSearchResults(state = {}, handlers = {}) {
  const container = getElement('search-results');
  if (!container) {
    return;
  }
  container.innerHTML = '';

  const query = state.query || '';
  const loading = Boolean(state.loading);
  const error = state.error;
  const groups = Array.isArray(state.groups) ? state.groups : [];
  const hasActiveContent = loading || Boolean(error) || Boolean(query) || groups.length;

  if (!hasActiveContent) {
    container.classList.remove('active');
    return;
  }

  container.classList.add('active');

  if (loading) {
    const loadingNode = document.createElement('p');
    loadingNode.className = 'placeholder';
    loadingNode.textContent = 'Ищем...';
    container.appendChild(loadingNode);
  }

  if (error) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-warning mb-0';
    alert.textContent = error;
    container.appendChild(alert);
  }

  let globalHasHits = false;
  groups.forEach((group) => {
    globalHasHits = globalHasHits || (Array.isArray(group.hits) && group.hits.length > 0);
    const groupEl = document.createElement('div');
    groupEl.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';
    const title = document.createElement('span');
    title.textContent = group.databaseName || group.databaseId || 'База';
    const counter = document.createElement('span');
    counter.textContent = `${group.hits?.length || 0} результатов`;
    header.appendChild(title);
    header.appendChild(counter);
    groupEl.appendChild(header);

    if (group.error) {
      const note = document.createElement('p');
      note.className = 'alert alert-warning mb-0';
      note.textContent = group.error;
      groupEl.appendChild(note);
    } else {
      const list = document.createElement('div');
      list.className = 'search-group-items';
      if (Array.isArray(group.hits) && group.hits.length) {
        group.hits.forEach((hit) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'search-hit';
          const title = document.createElement('div');
          title.className = 'hit-title';
          const name = document.createElement('span');
          name.textContent = hit.name || hit.code || '—';
          const code = document.createElement('span');
          code.textContent = hit.code || '';
          title.appendChild(name);
          title.appendChild(code);
          row.appendChild(title);

          const meta = document.createElement('div');
          meta.className = 'hit-meta';
          const metaParts = [];
          if (hit.measureUnit) {
            metaParts.push(hit.measureUnit);
          }
          if (Array.isArray(hit.sectionNames) && hit.sectionNames.length) {
            metaParts.push('Путь: ' + hit.sectionNames.join(' › '));
          }
          if (Array.isArray(hit.resources) && hit.resources.length) {
            metaParts.push(`Ресурсы: ${hit.resources.length}`);
          }
          metaParts.forEach((text) => {
            const crumb = document.createElement('span');
            crumb.textContent = text;
            meta.appendChild(crumb);
          });
          if (metaParts.length) {
            row.appendChild(meta);
          }

          row.addEventListener('click', () => {
            handlers.onHitSelect?.(group.databaseId, hit);
          });

          list.appendChild(row);
        });
      } else if (!group.error) {
        const empty = document.createElement('p');
        empty.className = 'placeholder mb-0';
        empty.textContent = 'Ни одного результата.';
        list.appendChild(empty);
      }
      groupEl.appendChild(list);
    }

    container.appendChild(groupEl);
  });

  if (!loading && !error && !globalHasHits) {
    const empty = document.createElement('p');
    empty.className = 'placeholder';
    empty.textContent = query ? 'По запросу ничего не найдено.' : 'Введите запрос.';
    container.appendChild(empty);
  }
}

function showLoading(visible) {
  const loader = getElement('app-loader');
  if (!loader) {
    return;
  }
  loader.style.display = visible ? 'flex' : 'none';
}

function clearDetails() {
  renderBreadcrumbTrail([], null);
  renderDetailContent(null, {});
}

export const UI = {
  setLoader(visible) {
    showLoading(visible);
  },
  clearDetails,
  renderDatabaseList(databases, activeId, onSelect) {
    const list = getElement('sections-list');
    if (!list) {
      return;
    }
    list.innerHTML = '';
    databases.forEach((db) => {
      const item = document.createElement('li');
      item.className = 'section-item';
      if (db.id === activeId) {
        item.classList.add('active');
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'd-flex flex-column';

      const title = document.createElement('span');
      title.textContent = db.name;
      wrapper.appendChild(title);

      if (db.description) {
        const meta = document.createElement('small');
        meta.className = 'text-muted';
        meta.textContent = db.description;
        wrapper.appendChild(meta);
      }

      item.appendChild(wrapper);
      item.addEventListener('click', () => {
        onSelect?.(db.id);
      });
      list.appendChild(item);
    });
  },
  renderTree(sections, expanded, selectedWorkCode, handlers = {}, error) {
    renderTreeContent(sections, expanded, selectedWorkCode, handlers, error);
  },
  renderDetails(detailState, options = {}, handlers = {}) {
    renderDetailContent(detailState, options, handlers);
  },
  renderSearchResults(state, handlers = {}) {
    renderSearchResults(state, handlers);
  },
  renderBreadcrumbs(names, handler) {
    renderBreadcrumbTrail(names, handler);
  }
};
