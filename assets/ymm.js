const initYmm = (root) => {
  if (root.dataset.ymmInitialized) return;
  root.dataset.ymmInitialized = 'true';

  // If the script is manually triggered, we might need to find config by looking for script tag inside root
  let configEl = root.querySelector(`[id^="ymm-config-"]`);
  
  const statusEl = root.querySelector('.ymm-status');
  const yearEl = root.querySelector('[data-role="ymm-year"]');
  const makeEl = root.querySelector('[data-role="ymm-make"]');
  const modelEl = root.querySelector('[data-role="ymm-model"]');
  const submodelEl = root.querySelector('[data-role="ymm-submodel"]');
  const submodelContainer = root.querySelector('[data-role="ymm-submodel-container"]');
  const engineEl = root.querySelector('[data-role="ymm-engine"]');
  const submitEl = root.querySelector('[data-role="ymm-submit"]');

  const searchContainerEl = root.querySelector('.ymm-search-container');
  const setSubmodelVisible = (visible) => {
    if (!searchContainerEl) return;
    if (visible) {
      searchContainerEl.classList.remove('ymm-search-container--no-submodel');
    } else {
      searchContainerEl.classList.add('ymm-search-container--no-submodel');
    }
  };

  // Initially hide submodel container
  if (submodelContainer) submodelContainer.style.display = 'none';
  setSubmodelVisible(false);
  // const controlsEl = root.querySelector('.ymm-controls'); // Not consistently present in snippet

  if (!configEl) return;
  const config = JSON.parse(configEl.textContent || '{}');
  const token = config.storefrontAccessToken;
  const apiVersion = config.apiVersion || '2025-01';
  // Use config collection handle first, fallback to 'all'
  const destCollection = config.collectionHandle || 'all';

  const cacheKey = 'vehicles_index_v3';
  const index = {
    all: [],
    byYear: new Map(),
    byYearMake: new Map(),
    byYearMakeModel: new Map(),
    bySelectionKey: new Map()
  };

  const gql = async (query, variables = {}) => {
    if (!token) {
      console.error('YMM: Missing Storefront Access Token');
      alert('YMM Search Error: Missing Storefront Access Token.\nPlease add it in the Theme Editor > Hero YMM Centerpiece section.');
      throw new Error('Missing Access Token');
    }
    // Add cache-busting timestamp to URL
    const cacheBuster = `_t=${Date.now()}`;
    const res = await fetch(`/api/${apiVersion}/graphql.json?${cacheBuster}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Storefront API error: ' + res.statusText);
    const json = await res.json();
    if (json.errors) {
      console.error('YMM GraphQL Errors:', json.errors);
      throw new Error('GraphQL errors');
    }
    return json.data;
  };

  const vehiclesQuery = `
    query Vehicles($first: Int!, $after: String) {
      metaobjects(type: $type, first: $first, after: $after) {
        nodes {
          id
          handle
          type
          fields {
            key
            value
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const fillSelect = (el, values) => {
    el.innerHTML = '';
    const optDefault = document.createElement('option');
    optDefault.value = '';
    optDefault.textContent = 'Select';
    el.appendChild(optDefault);
    values.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = String(v);
      el.appendChild(opt);
    });
    el.disabled = false;
  };

  const buildIndex = (items) => {
    index.all = items;
    items.forEach((node) => {
      const map = new Map(node.fields.map((f) => [f.key, f.value]));
      const year = map.get('year');
      const make = map.get('make');
      const model = map.get('model');
      const submodel = map.get('submodel') || '';
      const engine = map.get('engine') || '';
      const kYear = year;
      const kYM = `${year}::${make}`;
      const kYMM = `${year}::${make}::${model}`;
      const kSel = `${year}::${make}::${model}::${submodel}::${engine}`;

      if (!index.byYear.has(kYear)) index.byYear.set(kYear, new Set());
      index.byYear.get(kYear).add(make);

      if (!index.byYearMake.has(kYM)) index.byYearMake.set(kYM, new Set());
      index.byYearMake.get(kYM).add(model);

      if (!index.byYearMakeModel.has(kYMM)) index.byYearMakeModel.set(kYMM, []);
      index.byYearMakeModel.get(kYMM).push({ submodel, engine, id: node.id });

      index.bySelectionKey.set(kSel, node.id);
    });
  };

  const loadVehicles = async () => {
    try {
      // setStatus('Loading vehicles...');
      // Clear cache for debugging
      localStorage.removeItem(cacheKey);
      
      let after = null;
      let nodes = [];
      let fetchType = "custom.vehicle";
      
      // Helper to fetch pages
      const fetchPages = async (type) => {
        let currentAfter = null;
        let collected = [];
        for (let i = 0; i < 50; i++) {
          // Dynamic query to support fallback type
          const dynamicQuery = vehiclesQuery.replace('$type', JSON.stringify(type));
          const data = await gql(dynamicQuery, { first: 250, after: currentAfter });
          if (!data.metaobjects) break;
          
          collected = collected.concat(data.metaobjects.nodes);
          if (!data.metaobjects.pageInfo.hasNextPage) break;
          currentAfter = data.metaobjects.pageInfo.endCursor;
        }
        return collected;
      };

      // Try fetching with "vehicle" type first (this is what the admin API creates)
      console.log('YMM: Fetching vehicles with type "vehicle"...');
      nodes = await fetchPages("vehicle");
      console.log('YMM: Found', nodes.length, 'vehicles with type "vehicle"');

      // Fallback: Try "custom.vehicle" if no results
      if (nodes.length === 0) {
        console.log('YMM: No results for vehicle, trying custom.vehicle...');
        nodes = await fetchPages("custom.vehicle");
        console.log('YMM: Found', nodes.length, 'vehicles with type "custom.vehicle"');
      }

      if (nodes.length === 0) {
        setStatus('No vehicles found. Check Metaobject definitions & Storefront visibility.');
        console.error('YMM: No vehicles found with either type. Check Storefront API access on metaobject definition.');
        return;
      }

      console.log('YMM: Total vehicles loaded:', nodes.length);
      console.log('YMM: Sample vehicle:', nodes[0]);
      
      buildIndex(nodes);
      
      // Auto-hide success message after 3s
      setTimeout(() => setStatus(''), 3000);

    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  };

  const onYearChange = () => {
    const year = yearEl.value;
    makeEl.disabled = true;
    modelEl.disabled = true;
    submodelEl && (submodelEl.disabled = true);
    if (submodelContainer) submodelContainer.style.display = 'none';
    setSubmodelVisible(false);
    engineEl && (engineEl.disabled = true);
    if (!year) return;
    const makes = index.byYear.get(year) || new Set();
    fillSelect(makeEl, Array.from(makes).sort());
  };

  const onMakeChange = () => {
    const year = yearEl.value;
    const make = makeEl.value;
    modelEl.disabled = true;
    submodelEl && (submodelEl.disabled = true);
    if (submodelContainer) submodelContainer.style.display = 'none';
    setSubmodelVisible(false);
    engineEl && (engineEl.disabled = true);
    if (!year || !make) return;
    const models = index.byYearMake.get(`${year}::${make}`) || new Set();
    fillSelect(modelEl, Array.from(models).sort());
  };

  const onModelChange = () => {
    const year = yearEl.value;
    const make = makeEl.value;
    const model = modelEl.value;
    if (!year || !make || !model) return;
    const entries = index.byYearMakeModel.get(`${year}::${make}::${model}`) || [];
    const submodels = new Set();
    const engines = new Set();
    entries.forEach(({ submodel, engine }) => {
      if (submodel) submodels.add(submodel);
      if (engine) engines.add(engine);
    });
    if (submodelEl) {
      if (submodels.size) {
        fillSelect(submodelEl, Array.from(submodels).sort());
        if (submodelContainer) submodelContainer.style.display = '';
        setSubmodelVisible(true);
      } else {
        submodelEl.innerHTML = '';
        submodelEl.disabled = true;
        if (submodelContainer) submodelContainer.style.display = 'none';
        setSubmodelVisible(false);
      }
    }
    if (engineEl) {
      if (engines.size) fillSelect(engineEl, Array.from(engines).sort());
      else {
        engineEl.innerHTML = '';
        engineEl.disabled = true;
      }
    }
  };

  const resolveVehicleId = () => {
    const year = yearEl.value;
    const make = makeEl.value;
    const model = modelEl.value;
    const submodel = submodelEl && submodelEl.value ? submodelEl.value : '';
    const engine = engineEl && engineEl.value ? engineEl.value : '';
    const key = `${year}::${make}::${model}::${submodel}::${engine}`;
    return index.bySelectionKey.get(key);
  };

  const onSubmit = () => {
    const id = resolveVehicleId();
    if (!id) {
      setStatus('Select valid Year/Make/Model.');
      return;
    }
    
    // Save selection to Garage for Product Page Fitment Check
    const vehicleData = {
      id: id,
      year: yearEl.value,
      make: makeEl.value,
      model: modelEl.value,
      submodel: submodelEl ? submodelEl.value : '',
      engine: engineEl ? engineEl.value : ''
    };
    localStorage.setItem('skm_garage_vehicle', JSON.stringify(vehicleData));

    const url = `/collections/${destCollection}?filter.p.m.custom.fits_vehicles=${encodeURIComponent(id)}`;
    window.location.assign(url);
  };

  // SHOPMONKEY: inventory-sync hook
  // SHOPMONKEY: invoice middleware

  yearEl.addEventListener('change', onYearChange);
  makeEl.addEventListener('change', onMakeChange);
  modelEl.addEventListener('change', onModelChange);
  submitEl.addEventListener('click', onSubmit);

  loadVehicles().then(() => {
    const years = Array.from(index.byYear.keys()).sort();
    fillSelect(yearEl, years);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // Init sections that have data-section-id (like the hero section)
  document.querySelectorAll('[data-section-id]').forEach((root) => {
    // Only init if it contains the YMM structure
    if(root.querySelector('[data-role="ymm-year"]')) {
      initYmm(root);
    }
  });
});
