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
 * Load active dealers
 */
async function loadActiveDealers() {
  const container = document.getElementById('active-dealers-list');
  const countEl = document.getElementById('active-dealer-count');

  // Update section header to reflect we show all dealers
  const headerEl = container.parentElement.querySelector('h2');
  if (headerEl) headerEl.textContent = 'All Dealers';

  try {
    const data = await window.AdminDashboard.api.get('/dealers?status=all');

    // Handle both array response and {success, data} response formats
    const dealers = Array.isArray(data) ? data : (data.data || []);

    if (!dealers || dealers.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-gray-400">No active dealers</div>';
      countEl.textContent = '0 dealers';
      return;
    }

    countEl.textContent = `${dealers.length} dealers`;

    container.innerHTML = dealers.map(dealer => `
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

  } catch (err) {
    console.error('Failed to load dealers:', err);
    container.innerHTML = '<div class="p-8 text-center text-red-500">Failed to load dealers</div>';
  }
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
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const data = {
      name: document.getElementById('edit-dealer-name').value,
      phone: document.getElementById('edit-dealer-phone').value,
      email: document.getElementById('edit-dealer-email').value,
      address: document.getElementById('edit-dealer-address').value,
      city: document.getElementById('edit-dealer-city').value,
      state: document.getElementById('edit-dealer-state').value,
      zip: document.getElementById('edit-dealer-zip').value,
      website: document.getElementById('edit-dealer-website').value,
      hours: { display: document.getElementById('edit-dealer-hours').value },
      status: document.getElementById('edit-dealer-status').value
    };

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

  if (!confirm('Are you sure you want to delete this dealer? This action cannot be undone.')) {
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

  setTimeout(() => { toast.innerHTML = ''; }, 4000);
}
