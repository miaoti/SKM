/**
 * Admin Dealers Management
 * - Pending applications list with approve/reject
 * - Active dealers CRUD
 */

const DEALERS_API = 'https://skm-inventory-api.miaotingshuo.workers.dev';

let currentAppId = null;
let currentDealerId = null;
let currentAppEmail = null;
let currentAppBusiness = null;

// Dealers cache for search/sort without refetching
let allDealers = [];
let dealerSearchTimeout = null;
let dealerEmailSearchTimeout = null;

// Initialize on tab click
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching handler
  document.querySelectorAll('.tab[data-tab="dealers"]').forEach(tab => {
    tab.addEventListener('click', () => {
      setTimeout(initDealersTab, 100);
    });
  });

  // Schema init button
  const initBtn = document.getElementById('btn-init-dealer-schema');
  if (initBtn) {
    initBtn.addEventListener('click', initDealerSchema);
  }

  // Modal close handlers
  document.getElementById('btn-close-dealer-app-modal')?.addEventListener('click', closeAppModal);
  document.getElementById('btn-close-dealer-edit-modal')?.addEventListener('click', closeEditModal);

  // Action handlers
  document.getElementById('btn-approve-app')?.addEventListener('click', () => processApp('approve'));
  document.getElementById('btn-reject-app')?.addEventListener('click', () => processApp('reject'));
  document.getElementById('btn-save-dealer')?.addEventListener('click', saveDealer);
  document.getElementById('btn-delete-dealer')?.addEventListener('click', deleteDealer);

  // Dealer search handler (debounced)
  document.getElementById('dealer-search')?.addEventListener('input', (e) => {
    clearTimeout(dealerSearchTimeout);
    dealerSearchTimeout = setTimeout(() => {
      renderDealersList();
    }, 300);
  });

  // Dealer sort handler
  document.getElementById('dealer-sort')?.addEventListener('change', () => {
    renderDealersList();
  });

  // Email autocomplete for Edit Dealer modal
  const dealerEmailInput = document.getElementById('edit-dealer-email');
  const emailSuggestions = document.getElementById('dealer-email-suggestions');

  if (dealerEmailInput) {
    // Search customers when typing in email field
    dealerEmailInput.addEventListener('input', (e) => {
      clearTimeout(dealerEmailSearchTimeout);
      const query = e.target.value.trim();

      // Hide validation message while typing
      const validationEl = document.getElementById('dealer-email-validation');
      if (validationEl) validationEl.classList.add('hidden');

      // Clear selected customer if typing new value
      document.getElementById('edit-dealer-customer-id').value = '';
      document.getElementById('dealer-email-selected')?.classList.add('hidden');

      if (query.length < 2) {
        emailSuggestions?.classList.add('hidden');
        return;
      }

      dealerEmailSearchTimeout = setTimeout(async () => {
        try {
          const result = await window.AdminDashboard.api.get(`/customers?q=${encodeURIComponent(query)}`);
          const customers = result.data || result;

          if (customers && customers.length > 0) {
            emailSuggestions.innerHTML = customers.slice(0, 8).map(cust => `
              <div class="customer-suggestion p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0" 
                   data-id="${cust.id}" data-email="${cust.email || ''}" data-name="${cust.displayName || cust.email}">
                <div class="font-medium text-sm text-gray-900">${cust.displayName || 'Customer'}</div>
                <div class="text-xs text-gray-500">${cust.email}</div>
                ${cust.tags?.includes('b2b') ? '<span class="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded mt-1 inline-block">B2B</span>' : ''}
              </div>
            `).join('');
            emailSuggestions.classList.remove('hidden');

            // Add click handlers to suggestions
            emailSuggestions.querySelectorAll('.customer-suggestion').forEach(el => {
              el.addEventListener('click', () => {
                const email = el.dataset.email;
                const id = el.dataset.id;
                const name = el.dataset.name;
                selectDealerCustomer(email, id, name);
              });
            });
          } else {
            emailSuggestions.innerHTML = '<div class="p-3 text-sm text-gray-400">No customers found</div>';
            emailSuggestions.classList.remove('hidden');
          }
        } catch (err) {
          console.error('Customer search error:', err);
          emailSuggestions.innerHTML = '<div class="p-3 text-sm text-red-400">Search failed</div>';
          emailSuggestions.classList.remove('hidden');
        }
      }, 300);
    });

    // Close suggestions on blur (with delay for click to register)
    dealerEmailInput.addEventListener('blur', () => {
      setTimeout(() => {
        emailSuggestions?.classList.add('hidden');
      }, 200);
    });
  }

  // Handle deep linking from email - check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const appId = urlParams.get('app');

  if (tabParam === 'dealers') {
    // Wait for AdminDashboard to be ready, then switch to dealers tab
    setTimeout(() => {
      // Use the exposed switchToTab function
      if (window.AdminDashboard?.switchToTab) {
        window.AdminDashboard.switchToTab('dealers');

        // Initialize the dealers tab content
        initDealersTab();

        // If an app ID was provided, open that application after tab loads
        if (appId) {
          setTimeout(() => {
            const decodedAppId = decodeURIComponent(appId);
            window.viewApplication?.(decodedAppId);
          }, 800); // Wait for tab content to load
        }
      }
    }, 300);
  }
});

/**
 * Initialize the dealers tab
 */
async function initDealersTab() {
  console.log('[Dealers] Initializing dealers tab...');
  try {
    await Promise.all([
      loadPendingApplications(),
      loadActiveDealers()
    ]);
    console.log('[Dealers] Tab initialized successfully');
  } catch (err) {
    console.error('[Dealers] Tab initialization failed:', err);
  }
}

/**
 * View dealer's connected customer account
 * Switches to Customers tab, searches for the dealer's email, and auto-selects the customer
 */
window.viewDealerAccount = async function (email) {
  if (!email) return;

  // Switch to customers tab using the exposed switchToTab function
  if (window.AdminDashboard?.switchToTab) {
    window.AdminDashboard.switchToTab('customers');

    // Populate the search field
    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
      searchInput.value = email;
    }

    try {
      // Use the API to search for the customer by email
      const result = await window.AdminDashboard.api.get(`/customers?q=${encodeURIComponent(email)}`);
      const customers = result.data || result;

      if (customers && customers.length > 0) {
        // Find exact email match first, otherwise use first result
        const exactMatch = customers.find(c => c.email?.toLowerCase() === email.toLowerCase());
        const customer = exactMatch || customers[0];

        // Store customers in state and render the list
        if (window.AdminDashboard.S) {
          window.AdminDashboard.S.customers = customers;
        }

        // Get the customer ID for selection
        const customerId = customer.id.includes('gid://')
          ? customer.id.split('/').pop()
          : customer.id;

        // Fetch full customer details and display
        const fullCustomer = await window.AdminDashboard.api.get(`/customers/${customerId}`);

        if (window.AdminDashboard.S) {
          window.AdminDashboard.S.selectedCustomer = fullCustomer;
        }

        // Trigger a re-render of the customer list to show the updated selection
        const listContainer = document.getElementById('customer-list');
        if (listContainer) {
          // Re-render with selection highlight
          listContainer.innerHTML = customers.map(cust => `
            <div class="customer-item p-3 cursor-pointer hover:bg-gray-50 ${cust.id === customer.id ? 'bg-red-50' : ''}" data-id="${cust.id}">
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">${cust.displayName || cust.email}</p>
                  <p class="text-xs text-gray-500 truncate">${cust.email}</p>
                </div>
                <div class="flex gap-1 ml-2">
                  ${cust.tags?.includes('admin') ? '<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">Admin</span>' : ''}
                  ${cust.tags?.includes('b2b') ? '<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">B2B</span>' : ''}
                </div>
              </div>
            </div>
          `).join('');

          // Update count
          const countEl = document.getElementById('customer-count');
          if (countEl) countEl.textContent = `${customers.length} customers`;
        }

        // Show the customer editor panel
        const emptyState = document.getElementById('customer-empty');
        const editor = document.getElementById('customer-editor');
        if (emptyState) emptyState.classList.add('hidden');
        if (editor) editor.classList.remove('hidden');

        // Populate the customer editor fields
        document.getElementById('cust-name').textContent = fullCustomer.displayName || `${fullCustomer.firstName || ''} ${fullCustomer.lastName || ''}`.trim() || 'Customer';
        document.getElementById('cust-email').textContent = fullCustomer.email || '-';
        document.getElementById('cust-state').textContent = fullCustomer.state || 'ENABLED';
        document.getElementById('cust-firstname').value = fullCustomer.firstName || '';
        document.getElementById('cust-lastname').value = fullCustomer.lastName || '';
        document.getElementById('cust-email-edit').value = fullCustomer.email || '';
        document.getElementById('cust-phone').value = fullCustomer.phone || '';
        document.getElementById('cust-note').value = fullCustomer.note || '';
        document.getElementById('cust-orders').textContent = fullCustomer.ordersCount || '0';
        document.getElementById('cust-spent').textContent = fullCustomer.totalSpent ? `$${parseFloat(fullCustomer.totalSpent).toFixed(2)}` : '$0.00';
        document.getElementById('cust-since').textContent = fullCustomer.createdAt ? new Date(fullCustomer.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

        // Display address
        const addressEl = document.getElementById('cust-address');
        if (addressEl && fullCustomer.address) {
          const addr = fullCustomer.address;
          addressEl.innerHTML = [addr.address1, addr.address2, `${addr.city || ''}, ${addr.province || ''} ${addr.zip || ''}`, addr.country].filter(Boolean).join('<br>');
        } else if (addressEl) {
          addressEl.innerHTML = '<p class="text-gray-400">No address on file</p>';
        }

        // Render tags
        const tagsContainer = document.getElementById('cust-tags');
        if (tagsContainer && fullCustomer.tags) {
          tagsContainer.innerHTML = fullCustomer.tags.map(tag => `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              ${tag}
              <button class="remove-tag text-gray-400 hover:text-red-500" data-tag="${tag}">&times;</button>
            </span>
          `).join('');
        }

        showToast('Customer account loaded', 'success');
      } else {
        showToast('No customer found with that email', 'error');
      }
    } catch (err) {
      console.error('[viewDealerAccount] Error loading customer:', err);
      showToast('Failed to load customer: ' + err.message, 'error');
    }
  }
}

/**
 * Select a customer for dealer email field
 * Called when user clicks a customer from the autocomplete dropdown
 */
function selectDealerCustomer(email, customerId, name) {
  // Set the email input value
  const emailInput = document.getElementById('edit-dealer-email');
  if (emailInput) emailInput.value = email;

  // Store the customer ID
  const customerIdInput = document.getElementById('edit-dealer-customer-id');
  if (customerIdInput) customerIdInput.value = customerId;

  // Show the selected customer info
  const selectedEl = document.getElementById('dealer-email-selected');
  const selectedNameEl = document.getElementById('dealer-email-selected-name');
  if (selectedEl && selectedNameEl) {
    selectedNameEl.textContent = `${name} (${email})`;
    selectedEl.classList.remove('hidden');
  }

  // Hide the suggestions dropdown
  document.getElementById('dealer-email-suggestions')?.classList.add('hidden');

  // Hide validation error if any
  document.getElementById('dealer-email-validation')?.classList.add('hidden');
}

/**
 * Initialize dealer schemas
 */
async function initDealerSchema() {
  const btn = document.getElementById('btn-init-dealer-schema');
  if (btn) {
    btn.textContent = 'Initializing...';
    btn.disabled = true;
  }

  try {
    // Use the AdminDashboard api helper to include auth headers
    const data = await window.AdminDashboard.api.post('/schema/init-dealers', {});

    if (data.success) {
      showToast('Schema initialized successfully!', 'success');
      await initDealersTab();
    } else {
      throw new Error(data.error || 'Failed to initialize schema');
    }
  } catch (err) {
    console.error('Schema init error:', err);
    showToast('Failed to initialize schema: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.textContent = 'Initialize Schema';
      btn.disabled = false;
    }
  }
}

/**
 * Load pending applications
 */
async function loadPendingApplications() {
  const container = document.getElementById('pending-applications-list');
  const countEl = document.getElementById('pending-app-count');

  try {
    console.log('[Dealers] Loading pending applications...');
    const data = await window.AdminDashboard.api.get('/dealer-applications?status=pending');
    console.log('[Dealers] Applications response:', data);

    // Handle both array response and {success, data} response formats
    const apps = Array.isArray(data) ? data : (data.data || []);

    if (!apps || apps.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-gray-400">No pending applications</div>';
      countEl.textContent = '0 pending';
      return;
    }

    countEl.textContent = `${apps.length} pending`;

    container.innerHTML = apps.map(app => `
      <div class="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onclick="viewApplication('${app.id}')">
        <div>
          <h3 class="font-medium text-gray-900">${app.business_name || 'Unnamed'}</h3>
          <p class="text-sm text-gray-500">${app.customer_email || 'No email'}</p>
          <p class="text-xs text-gray-400">${formatDate(app.submitted_at)}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Pending</span>
          <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load applications:', err);
    container.innerHTML = '<div class="p-8 text-center text-red-500">Failed to load applications</div>';
  }
}

/**
 * Load active dealers (fetches from API and caches)
 */
async function loadActiveDealers() {
  const container = document.getElementById('active-dealers-list');
  const countEl = document.getElementById('active-dealer-count');

  try {
    const data = await window.AdminDashboard.api.get('/dealers?status=all');

    // Handle both array response and {success, data} response formats
    allDealers = Array.isArray(data) ? data : (data.data || []);

    // Render the dealers list
    renderDealersList();

  } catch (err) {
    console.error('Failed to load dealers:', err);
    container.innerHTML = '<div class="p-8 text-center text-red-500">Failed to load dealers</div>';
  }
}

/**
 * Render dealers list with search and sort applied
 */
function renderDealersList() {
  const container = document.getElementById('active-dealers-list');
  const countEl = document.getElementById('active-dealer-count');
  const searchInput = document.getElementById('dealer-search');
  const sortSelect = document.getElementById('dealer-sort');

  const searchQuery = (searchInput?.value || '').toLowerCase().trim();
  const sortBy = sortSelect?.value || 'name-asc';

  // Filter dealers by search query (fuzzy match on name, email, city, state)
  let filteredDealers = allDealers;
  if (searchQuery) {
    filteredDealers = allDealers.filter(dealer => {
      const name = (dealer.name || '').toLowerCase();
      const email = (dealer.email || '').toLowerCase();
      const city = (dealer.city || '').toLowerCase();
      const state = (dealer.state || '').toLowerCase();
      const location = `${city} ${state}`;

      return name.includes(searchQuery) ||
        email.includes(searchQuery) ||
        city.includes(searchQuery) ||
        state.includes(searchQuery) ||
        location.includes(searchQuery);
    });
  }

  // Sort dealers
  filteredDealers = [...filteredDealers].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'location-asc':
        const locA = [a.city, a.state].filter(Boolean).join(', ');
        const locB = [b.city, b.state].filter(Boolean).join(', ');
        return locA.localeCompare(locB);
      case 'location-desc':
        const locA2 = [a.city, a.state].filter(Boolean).join(', ');
        const locB2 = [b.city, b.state].filter(Boolean).join(', ');
        return locB2.localeCompare(locA2);
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      default:
        return 0;
    }
  });

  // Update count (showing filtered count if searching)
  if (searchQuery) {
    countEl.textContent = `${filteredDealers.length} of ${allDealers.length} dealers`;
  } else {
    countEl.textContent = `${filteredDealers.length} dealers`;
  }

  if (!filteredDealers.length) {
    container.innerHTML = searchQuery
      ? '<div class="p-8 text-center text-gray-400">No dealers match your search</div>'
      : '<div class="p-8 text-center text-gray-400">No dealers found</div>';
    return;
  }

  container.innerHTML = filteredDealers.map(dealer => `
    <div class="p-4 flex items-center justify-between hover:bg-gray-50">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
          ${dealer.logo
      ? `<img src="${dealer.logo}" alt="${dealer.name}" class="w-full h-full object-cover">`
      : dealer.website
        ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(dealer.website.replace(/^https?:\/\//, '').split('/')[0])}&sz=64" alt="${dealer.name}" class="w-8 h-8" onerror="this.parentElement.innerHTML='<svg class=\\'w-6 h-6 text-gray-400\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4\\'/></svg>'">`
        : `<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>`
    }
        </div>
        <div>
          <h3 class="font-medium text-gray-900">${dealer.name}</h3>
          <p class="text-sm text-gray-500">${[dealer.city, dealer.state].filter(Boolean).join(', ') || 'No location'}</p>
          ${dealer.email ? `
            <button onclick="viewDealerAccount('${dealer.email}')" class="text-xs text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 mt-1">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              ${dealer.email}
            </button>
          ` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 text-xs font-medium rounded-full ${dealer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${dealer.status || 'active'}</span>
        <button onclick="editDealer('${dealer.id}')" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * View application details
 */
window.viewApplication = async function (appId) {
  currentAppId = appId;

  try {
    const data = await window.AdminDashboard.api.get(`/dealer-applications/${encodeURIComponent(appId)}`);

    // Handle both array and object response formats
    const app = Array.isArray(data) ? data[0] : (data.data || data);
    if (!app) throw new Error('Application not found');

    // Store email/name for rejection mailto
    currentAppEmail = app.customer_email;
    currentAppBusiness = app.business_name || 'Business';

    const rawData = app.raw_data || {};

    const content = document.getElementById('dealer-app-content');
    content.innerHTML = `
      <!-- Business Info Card -->
      <div class="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-5 border border-gray-100">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h4 class="font-semibold text-gray-900">Business Information</h4>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
              ${rawData.favicon_url
        ? `<img src="${rawData.favicon_url}" alt="Favicon" class="w-6 h-6" onerror="this.parentElement.innerHTML='<svg class=\\'w-4 h-4 text-gray-500\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4\\' /></svg>'" />`
        : rawData.website
          ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(rawData.website.replace(/^https?:\/\//, '').split('/')[0])}&sz=64" alt="Favicon" class="w-6 h-6" onerror="this.parentElement.innerHTML='<svg class=\\'w-4 h-4 text-gray-500\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4\\' /></svg>'" />`
          : `<svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>`}
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Business Name</p>
              <p class="text-sm font-semibold text-gray-900 mt-0.5">${app.business_name || '-'}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Website</p>
              <a href="${rawData.website || '#'}" target="_blank" class="text-sm font-medium text-red-600 hover:text-red-700 mt-0.5 block truncate max-w-[200px]">${rawData.website || 'Not provided'}</a>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Contact Info Card -->
      <div class="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl p-5 border border-blue-100/50">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h4 class="font-semibold text-gray-900">Contact Details</h4>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
              <p class="text-sm font-medium text-gray-900 mt-0.5">${app.customer_email || '-'}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
              <p class="text-sm font-medium text-gray-900 mt-0.5">${rawData.phone || 'Not provided'}</p>
            </div>
          </div>
        </div>
        <div class="mt-5 flex items-start gap-3">
          <div class="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</p>
            <p class="text-sm font-medium text-gray-900 mt-0.5">${[rawData.address, rawData.city, rawData.state, rawData.zip].filter(Boolean).join(', ') || 'Not provided'}</p>
          </div>
        </div>
      </div>
      
      ${rawData.reason ? `
      <!-- Reason Card -->
      <div class="bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-xl p-5 border border-amber-100/50">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 class="font-semibold text-gray-900">Reason for Applying</h4>
        </div>
        <p class="text-sm text-gray-700 leading-relaxed bg-white/60 rounded-lg p-3">${rawData.reason}</p>
      </div>
      ` : ''}
      
      <!-- Application Status Bar -->
      <div class="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-gray-700">Pending Review</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Submitted ${formatDate(app.submitted_at)}</span>
        </div>
      </div>
    `;

    document.getElementById('dealer-app-modal').classList.remove('hidden');

  } catch (err) {
    console.error('Failed to load application:', err);
    showToast('Failed to load application details', 'error');
  }
}

/**
 * Process application (approve/reject)
 */
async function processApp(action) {
  if (!currentAppId) return;

  const btn = document.getElementById(action === 'approve' ? 'btn-approve-app' : 'btn-reject-app');
  const originalText = btn.textContent;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    const notes = document.getElementById('app-admin-notes')?.value || '';

    const data = await window.AdminDashboard.api.post('/process-application', {
      applicationId: currentAppId,
      action: action,
      processedBy: 'Admin'
    });

    if (data.success) {
      showToast(action === 'approve' ? 'Application approved! Dealer created.' : 'Application rejected.', 'success');
      closeAppModal();
      await initDealersTab();
    } else {
      throw new Error(data.error || 'Failed to process application');
    }

  } catch (err) {
    console.error('Process error:', err);
    showToast('Failed to process: ' + err.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/**
 * Edit dealer
 */
window.editDealer = async function (dealerId) {
  currentDealerId = dealerId;

  try {
    // api.get already checks success and returns d.data directly
    const dealer = await window.AdminDashboard.api.get(`/dealers/${encodeURIComponent(dealerId)}`);

    document.getElementById('edit-dealer-id').value = dealerId;
    document.getElementById('edit-dealer-name').value = dealer.name || '';
    document.getElementById('edit-dealer-phone').value = dealer.phone || '';
    document.getElementById('edit-dealer-email').value = dealer.email || '';
    document.getElementById('edit-dealer-address').value = dealer.address || '';
    document.getElementById('edit-dealer-city').value = dealer.city || '';
    document.getElementById('edit-dealer-state').value = dealer.state || '';
    document.getElementById('edit-dealer-zip').value = dealer.zip || '';
    document.getElementById('edit-dealer-website').value = dealer.website || '';

    // Store original email and customer ID for tracking changes
    document.getElementById('edit-dealer-original-email').value = dealer.email || '';
    document.getElementById('edit-dealer-original-customer-id').value = dealer.customer_id || '';
    document.getElementById('edit-dealer-customer-id').value = dealer.customer_id || '';

    // Show currently linked customer info if email exists
    const selectedEl = document.getElementById('dealer-email-selected');
    const selectedNameEl = document.getElementById('dealer-email-selected-name');
    if (selectedEl && selectedNameEl && dealer.email) {
      selectedNameEl.textContent = dealer.email;
      selectedEl.classList.remove('hidden');
    } else if (selectedEl) {
      selectedEl.classList.add('hidden');
    }

    // Clear any validation messages
    document.getElementById('dealer-email-validation')?.classList.add('hidden');

    // Populate hours (handle object or string)
    let hoursText = '';
    if (typeof dealer.hours === 'string') hoursText = dealer.hours;
    else if (dealer.hours?.display) hoursText = dealer.hours.display;
    else if (dealer.hours?.text) hoursText = dealer.hours.text;

    document.getElementById('edit-dealer-hours').value = hoursText;
    document.getElementById('edit-dealer-status').value = dealer.status || 'active';

    document.getElementById('dealer-edit-modal').classList.remove('hidden');

  } catch (err) {
    console.error('Failed to load dealer:', err);
    showToast('Failed to load dealer details', 'error');
  }
}

/**
 * Save dealer changes
 */
async function saveDealer() {
  if (!currentDealerId) return;

  const btn = document.getElementById('btn-save-dealer');
  const originalText = btn.textContent;

  // Get email values
  const newEmail = document.getElementById('edit-dealer-email')?.value || '';
  const originalEmail = document.getElementById('edit-dealer-original-email')?.value || '';
  const newCustomerId = document.getElementById('edit-dealer-customer-id')?.value || '';
  const originalCustomerId = document.getElementById('edit-dealer-original-customer-id')?.value || '';

  // Check if email is changing
  const emailChanged = newEmail.toLowerCase() !== originalEmail.toLowerCase();

  if (emailChanged) {
    // If email changed but no customer selected from autocomplete, show validation error
    if (!newCustomerId) {
      const validationEl = document.getElementById('dealer-email-validation');
      if (validationEl) {
        validationEl.textContent = 'Please select a valid customer account from the suggestions';
        validationEl.classList.remove('hidden');
      }
      return;
    }

    // Confirm the account switch
    const confirmed = await window.showConfirmModal(
      `This will change the linked B2B account from "${originalEmail}" to "${newEmail}". The old account will lose B2B access. Continue?`,
      'Change Linked Account'
    );
    if (!confirmed) {
      return;
    }
  }

  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const data = {
      name: document.getElementById('edit-dealer-name').value,
      phone: document.getElementById('edit-dealer-phone').value,
      email: newEmail,
      address: document.getElementById('edit-dealer-address').value,
      city: document.getElementById('edit-dealer-city').value,
      state: document.getElementById('edit-dealer-state').value,
      zip: document.getElementById('edit-dealer-zip').value,
      website: document.getElementById('edit-dealer-website').value,
      hours: { display: document.getElementById('edit-dealer-hours').value },
      status: document.getElementById('edit-dealer-status').value
    };

    // If email changed, include account switching data for the API to handle B2B tags
    if (emailChanged) {
      data.accountSwitch = {
        oldEmail: originalEmail,
        oldCustomerId: originalCustomerId,
        newEmail: newEmail,
        newCustomerId: newCustomerId
      };
    }

    const result = await window.AdminDashboard.api.put(`/dealers/${encodeURIComponent(currentDealerId)}`, data);

    if (result.success) {
      showToast('Dealer updated successfully!', 'success');
      closeEditModal();
      await loadActiveDealers();
    } else {
      throw new Error(result.error || 'Failed to update dealer');
    }

  } catch (err) {
    console.error('Save error:', err);
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/**
 * Delete dealer
 */
async function deleteDealer() {
  if (!currentDealerId) return;

  const confirmed = await window.showConfirmModal(
    'Are you sure you want to delete this dealer? This action cannot be undone.',
    'Delete Dealer'
  );
  if (!confirmed) {
    return;
  }

  const btn = document.getElementById('btn-delete-dealer');
  const originalText = btn.textContent;
  btn.textContent = 'Deleting...';
  btn.disabled = true;

  try {
    const result = await window.AdminDashboard.api.del(`/dealers/${encodeURIComponent(currentDealerId)}`);

    if (result.success) {
      showToast('Dealer deleted successfully!', 'success');
      closeEditModal();
      await loadActiveDealers();
    } else {
      throw new Error(result.error || 'Failed to delete dealer');
    }

  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete: ' + err.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/**
 * Close modals
 */
function closeAppModal() {
  document.getElementById('dealer-app-modal').classList.add('hidden');
  currentAppId = null;
}

function closeEditModal() {
  document.getElementById('dealer-edit-modal').classList.add('hidden');
  currentDealerId = null;
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';

  toast.innerHTML = `
    <div class="${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
      ${type === 'success' ? '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
      ${type === 'error' ? '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' : ''}
      <span>${message}</span>
    </div>
  `;

  setTimeout(() => { toast.innerHTML = ''; }, 5000);
}
