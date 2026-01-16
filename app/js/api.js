import { CONFIG } from './config.js';

const CACHE_TTL = CONFIG.cacheTTL ?? 120_000;
const cache = new Map();

export class APIError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'APIError';
    Object.assign(this, details);
  }
}

function getCacheKey(database, xquery) {
  return `${database}|${xquery}`;
}

function getCachedResponse(key) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedResponse(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL
  });
}

function requireDatabase(database) {
  if (!database) {
    throw new APIError('Database identifier is required', { code: 'MISSING_DATABASE' });
  }
  const db = CONFIG.databases.find((item) => item.id === database);
  if (!db) {
    throw new APIError('Unknown database', { code: 'UNKNOWN_DATABASE', status: 400 });
  }
  return db;
}

let cachedBaseURL = null;

function normalizeCandidate(baseURL) {
  if (!baseURL) {
    return '';
  }
  return String(baseURL).trim().replace(/\/+$/, '');
}

function getBaseURLCandidates() {
  const seen = new Set();
  const candidates = [];
  const add = (url) => {
    const normalized = normalizeCandidate(url);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (cachedBaseURL) {
    add(cachedBaseURL);
  }
  add(CONFIG.baseURL);
  if (Array.isArray(CONFIG.baseURLFallbacks)) {
    CONFIG.baseURLFallbacks.forEach(add);
  }
  return candidates;
}

function setActiveBaseURL(baseURL) {
  const normalized = normalizeCandidate(baseURL);
  if (normalized) {
    cachedBaseURL = normalized;
  }
}

function isNetworkError(error) {
  if (error instanceof TypeError) {
    return true;
  }
  const message = error?.message || '';
  return typeof message === 'string' && /failed to fetch/i.test(message);
}

function buildQueryUrl(baseURL, database, xquery) {
  const normalizedBase = normalizeCandidate(baseURL);
  if (!normalizedBase) {
    throw new APIError('Base URL is not configured', { code: 'MISSING_BASE_URL' });
  }
  const url = new URL(`${normalizedBase}/${encodeURIComponent(database)}`);
  url.searchParams.set('query', xquery);
  return url.toString();
}

function getRequestTimeout() {
  return typeof CONFIG.requestTimeout === 'number' ? CONFIG.requestTimeout : 30_000;
}

export async function executeQuery(database, xquery, options = {}) {
  requireDatabase(database);
  if (!xquery) {
    throw new APIError('XQuery string is required', { code: 'MISSING_QUERY' });
  }

  const cacheKey = getCacheKey(database, xquery);
  if (options.cache !== false) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const baseCandidates = getBaseURLCandidates();
  if (!baseCandidates.length) {
    throw new APIError('Base URL is not configured', { code: 'MISSING_BASE_URL' });
  }

  let lastNetworkError = null;
  for (const baseURL of baseCandidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getRequestTimeout());
    try {
      const url = buildQueryUrl(baseURL, database, xquery);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/xml'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new APIError('BaseX query failed', {
          status: response.status,
          data: body
        });
      }

      const payload = await response.text();
      if (options.cache !== false) {
        setCachedResponse(cacheKey, payload);
      }
      setActiveBaseURL(baseURL);
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new APIError('BaseX request timed out', { code: 'TIMEOUT', cause: error });
      }
      if (isNetworkError(error)) {
        lastNetworkError = error;
        continue;
      }
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to execute BaseX query', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new APIError(
    `Не удалось соединиться с BaseX. Проверьте доступность одного из адресов: ${baseCandidates.join(
      ', '
    )}`,
    { code: 'ALL_BASE_URLS_UNREACHABLE', cause: lastNetworkError }
  );
}

function safeParse(xml) {
  if (typeof DOMParser !== 'function') {
    throw new APIError('DOMParser is not available', { code: 'DOMPARSER_UNAVAILABLE' });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml.trim() || '<empty/>', 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new APIError('Invalid XML response', { data: xml });
  }

  return doc;
}

function findSectionRoots(doc) {
  if (!doc || !doc.documentElement) {
    return [];
  }

  const root = doc.documentElement;
  if (root.tagName === 'Section') {
    return [root];
  }

  const direct = Array.from(root.children).filter((child) => child.tagName === 'Section');
  if (direct.length) {
    return direct;
  }

  return Array.from(doc.querySelectorAll('Section'));
}

function buildWorkSummary(node, sectionPath) {
  return {
    code: node.getAttribute('Code') || '',
    name: node.getAttribute('EndName') || node.getAttribute('Name') || '',
    measureUnit: node.getAttribute('MeasureUnit') || '',
    sectionPath: [...sectionPath]
  };
}

function buildSection(node, depth = 0, parentPath = []) {
  const code = node.getAttribute('Code') || '';
  const sectionPath = code ? [...parentPath, code] : [...parentPath];
  const section = {
    code,
    name: node.getAttribute('Name') || node.getAttribute('EndName') || '',
    type: node.getAttribute('Type') || '',
    depth,
    path: sectionPath,
    children: [],
    works: []
  };

  Array.from(node.children).forEach((child) => {
    if (child.tagName === 'Section') {
      section.children.push(buildSection(child, depth + 1, sectionPath));
    } else if (child.tagName === 'Work') {
      section.works.push(buildWorkSummary(child, sectionPath));
    }
  });

  return section;
}

function parseContentItems(node) {
  const contentNode = node.querySelector('Content');
  if (!contentNode) {
    return [];
  }

  return Array.from(contentNode.children)
    .filter((child) => child.tagName === 'Item')
    .map((item) => (item.getAttribute('Text') || item.textContent || '').trim())
    .filter(Boolean);
}

function parseResources(node) {
  const container = node.querySelector('Resources');
  if (!container) {
    return [];
  }

  return Array.from(container.children)
    .filter((child) => child.tagName === 'Resource')
    .map((resource) => ({
      code: resource.getAttribute('Code') || '',
      name: resource.getAttribute('EndName') || '',
      quantity: Number(resource.getAttribute('Quantity')) || 0,
      measureUnit: resource.getAttribute('MeasureUnit') || ''
    }));
}

function parseReferences(node) {
  return Array.from(node.querySelectorAll('NrSp > ReasonItem')).map((reason) => ({
    nr: reason.getAttribute('Nr') || '',
    sp: reason.getAttribute('Sp') || ''
  }));
}

function buildSectionPath(node) {
  const sections = [];
  let current = node.parentElement;
  while (current) {
    if (current.tagName === 'Section') {
      sections.unshift(current);
    }
    current = current.parentElement;
  }
  return sections;
}

export function parseSections(xml) {
  const doc = safeParse(xml);
  const roots = findSectionRoots(doc);
  return roots.map((section) => buildSection(section, 0, []));
}

export function parseWorkDetails(xml) {
  const doc = safeParse(xml);
  const work = doc.querySelector('Work');
  if (!work) {
    return null;
  }

  const sectionAncestors = buildSectionPath(work);
  return {
    code: work.getAttribute('Code') || '',
    name: work.getAttribute('Name') || work.getAttribute('EndName') || '',
    endName: work.getAttribute('EndName') || '',
    measureUnit: work.getAttribute('MeasureUnit') || '',
    description: work.getAttribute('EndName') || '',
    content: parseContentItems(work),
    resources: parseResources(work),
    references: parseReferences(work),
    sectionPath: sectionAncestors.map((section) => section.getAttribute('Code') || ''),
    sectionNames: sectionAncestors.map((section) => section.getAttribute('Name') || '')
  };
}

export function parseSearchResults(xml) {
  const doc = safeParse(xml);
  const root = doc.documentElement;
  const hits = root.tagName === 'Hit' ? [root] : Array.from(doc.querySelectorAll('Hit'));

  return hits.map((hit) => {
    const sectionNodes = Array.from(hit.querySelectorAll('Section'));
    const sections = sectionNodes.map((section) => ({
      code: section.getAttribute('Code') || '',
      name: section.getAttribute('Name') || '',
      type: section.getAttribute('Type') || ''
    }));
    const sectionPath = sections.map((section) => section.code).filter(Boolean);
    const sectionNames = sections.map((section) => section.name).filter(Boolean);

    return {
      code: hit.getAttribute('Code') || '',
      name: hit.getAttribute('Name') || '',
      measureUnit: hit.getAttribute('MeasureUnit') || '',
      sections,
      sectionPath,
      sectionNames,
      resources: Array.from(hit.querySelectorAll('Resource')).map((resource) => ({
        code: resource.getAttribute('Code') || '',
        name: resource.getAttribute('EndName') || resource.getAttribute('Name') || '',
        measureUnit: resource.getAttribute('MeasureUnit') || ''
      }))
    };
  });
}

function escapeXQueryString(value) {
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
}

export async function getSections(database) {
  const query = `
    <sections>{
      for $section in //Section[@Type="Сборник"]
      return $section
    }</sections>`;
  const response = await executeQuery(database, query);
  return parseSections(response);
}

export async function getChildren(database, sectionCode) {
  if (!sectionCode) {
    throw new APIError('Section code is required', { code: 'MISSING_SECTION_CODE' });
  }
  const query = `
    <sections>{
      let $node := //Section[@Code="${sectionCode}"]
      return (
        $node,
        $node/Section
      )
    }</sections>`;
  const response = await executeQuery(database, query);
  return parseSections(response);
}

export async function getWorkDetails(database, workCode) {
  if (!workCode) {
    throw new APIError('Work code is required', { code: 'MISSING_WORK_CODE' });
  }
  const query = `
    <work>{
      for $node in //Work[@Code="${workCode}"]
      return $node
    }</work>`;
  const response = await executeQuery(database, query);
  return parseWorkDetails(response);
}

export async function search(database, term) {
  const cleanTerm = (term || '').trim();
  if (!cleanTerm) {
    return [];
  }

  const query = `
    let $term := ${escapeXQueryString(cleanTerm)}
    let $limit := ${CONFIG.pageSize ?? 50}
    return
      <results>{
        subsequence((
          for $work in //Work
          let $code := string($work/@Code)
          let $title := string($work/@EndName)
          let $resources := $work/Resources/Resource
          let $resourceMatches :=
            exists(
              for $resource in $resources
              let $resourceCode := string($resource/@Code)
              let $resourceName := string($resource/@EndName)
              let $resourceTitle := string($resource/@Name)
              where
                contains(lower-case($resourceCode), lower-case($term)) or
                contains(lower-case($resourceName), lower-case($term)) or
                contains(lower-case($resourceTitle), lower-case($term))
              return $resource
            )
          let $match :=
            contains(lower-case($code), lower-case($term)) or
            contains(lower-case($title), lower-case($term)) or
            contains(lower-case(string($work/@Name)), lower-case($term)) or
            $resourceMatches
          where $match
          return
            <Hit Code="{$code}" Name="{$title}" MeasureUnit="{$work/@MeasureUnit}">
              { for $sec in reverse($work/ancestor::Section) return <Section Code="{$sec/@Code}" Name="{$sec/@Name}" Type="{$sec/@Type}" /> }
              { for $resource in $resources return <Resource Code="{$resource/@Code}" Name="{$resource/@EndName}" MeasureUnit="{$resource/@MeasureUnit}" /> }
            </Hit>
        ), 1, $limit)
      }</results>`;

  const response = await executeQuery(database, query);
  return parseSearchResults(response);
}

const resourceReferenceCache = new Map();

export function findCatalogEntryForResource(resourceCode) {
  if (!resourceCode) {
    return null;
  }
  const normalized = String(resourceCode).trim();
  if (!CONFIG.catalogMap) {
    return null;
  }
  return CONFIG.catalogMap.find((entry) => normalized.startsWith(entry.prefix)) || null;
}

function parseResourceReference(xml, database) {
  const doc = safeParse(xml);
  const node = doc.querySelector('Resource');
  if (!node) {
    return null;
  }
  const sectionNodes = Array.from(node.querySelectorAll('Section'));
  const sections = sectionNodes.map((section) => ({
    code: section.getAttribute('Code') || '',
    name: section.getAttribute('Name') || '',
    type: section.getAttribute('Type') || ''
  }));
  const sectionPath = sections.map((section) => section.code).filter(Boolean);
  const sectionNames = sections.map((section) => section.name).filter(Boolean);
  const priceNode = node.querySelector('Price');
  const price = priceNode
    ? {
        cost: Number(priceNode.getAttribute('Cost')) || null,
        optCost: Number(priceNode.getAttribute('OptCost')) || null
      }
    : null;
  return {
    code: node.getAttribute('Code') || '',
    name: node.getAttribute('Name') || node.getAttribute('EndName') || '',
    measureUnit: node.getAttribute('MeasureUnit') || '',
    database,
    sections,
    sectionPath,
    sectionNames,
    price
  };
}

async function fetchResourceReference(database, resourceCode) {
  const query = `
    let $code := ${escapeXQueryString(resourceCode)}
    return
      <resource>{
        for $item in //Resource[@Code=$code]
        return
          <Resource Code="{$item/@Code}" Name="{$item/@Name}" EndName="{$item/@EndName}" MeasureUnit="{$item/@MeasureUnit}">
            { for $section in reverse($item/ancestor::Section) return <Section Code="{$section/@Code}" Name="{$section/@Name}" Type="{$section/@Type}" /> }
            { $item/Prices/Price }
          </Resource>
      }</resource>`;
  const response = await executeQuery(database, query);
  return parseResourceReference(response, database);
}

export async function getResourceReference(resourceCode) {
  const catalogEntry = findCatalogEntryForResource(resourceCode);
  if (!catalogEntry) {
    return null;
  }
  const cacheKey = `${catalogEntry.database}|${resourceCode}`;
  if (resourceReferenceCache.has(cacheKey)) {
    return resourceReferenceCache.get(cacheKey);
  }
  try {
    const reference = await fetchResourceReference(catalogEntry.database, resourceCode);
    resourceReferenceCache.set(cacheKey, reference);
    return reference;
  } catch (error) {
    resourceReferenceCache.set(cacheKey, null);
    throw error;
  }
}

export async function enrichResourcesWithCatalog(resources = []) {
  if (!Array.isArray(resources)) {
    return resources;
  }
  const enriched = await Promise.all(
    resources.map(async (resource) => {
      if (!resource?.code) {
        return { ...resource };
      }
      try {
        const reference = await getResourceReference(resource.code);
        if (!reference) {
          return { ...resource };
        }
        return {
          ...resource,
          name: reference.name || resource.name,
          measureUnit: reference.measureUnit || resource.measureUnit,
          price: reference.price,
          catalogDatabase: reference.database,
          catalogSectionPath: reference.sectionPath,
          catalogSectionNames: reference.sectionNames,
          catalog: reference
        };
      } catch (error) {
        console.error('Failed to enrich resource', resource.code, error);
        return { ...resource };
      }
    })
  );
  return enriched;
}
