(function () {
  'use strict';

  const API_BASE = 'https://skm-inventory-api.miaotingshuo.workers.dev';
  let API_KEY = localStorage.getItem('skm_admin_key') || '';

  // State
  const S = {
    products: [],
    allProducts: [], // Unfiltered products for YMM filtering
    vehicles: [],
    customers: [],
    orders: [],
    selectedOrder: null,
    selectedOrderFull: null, // Full order details
    selected: null,
    selectedCustomer: null,
    selectedVehicles: new Set(),
    filters: { year: '', make: '', model: '', submodel: '' },
    vFilters: { year: '', make: '', model: '' }, // Vehicle list filters
    productYmmFilter: { year: '', make: '', model: '' }, // Product sidebar YMM filter
    orderFilters: { status: '', fulfillment: '', financial: '', query: '' },
    create: { year: '', make: '', model: '', submodel: '' },
    pendingMedia: []
  };

  // API
  const api = {
    headers: () => ({ 'Content-Type': 'application/json', 'X-Admin-Key': API_KEY }),

    async get(path) {
      const r = await fetch(`${API_BASE}${path}`, { headers: this.headers() });
      if (r.status === 401) throw new Error('Unauthorized');
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      return d.data;
    },

    async post(path, body) {
      const r = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
      if (r.status === 401) throw new Error('Unauthorized');
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      return d;
    },

    async put(path, body) {
      const r = await fetch(`${API_BASE}${path}`, { method: 'PUT', headers: this.headers(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      return d;
    },

    async del(path, body) {
      const r = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: this.headers(), body: body ? JSON.stringify(body) : undefined });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      return d;
    }
  };

  /**
   * Show custom confirm modal (replaces browser's native confirm())
   * @param {string} message - The message to display
   * @param {string} title - Optional title (defaults to "Confirm Action")
   * @returns {Promise<boolean>} - Resolves true if OK, false if Cancel
   */
  function showConfirmModal(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const messageEl = document.getElementById('confirm-modal-message');
      const okBtn = document.getElementById('confirm-modal-ok');
      const cancelBtn = document.getElementById('confirm-modal-cancel');

      if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
        // Fallback to native confirm if modal elements not found
        resolve(confirm(message));
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.classList.remove('hidden');

      // Focus the cancel button for safety
      cancelBtn.focus();

      const cleanup = () => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleKeydown);
      };

      const handleOk = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter') {
          handleOk();
        }
      };

      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleKeydown);
    });
  }

  // Expose showConfirmModal globally for other scripts
  window.showConfirmModal = showConfirmModal;

  // UI Helpers
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `px-4 py-3 rounded-lg shadow-lg text-sm text-white mb-2 ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-gray-800'}`;
    t.textContent = msg;
    document.getElementById('toast').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function $(id) { return document.getElementById(id); }

  // Expose context for external scripts - switchToTab added after function is defined
  window.AdminDashboard = { API_BASE, api, toast, S };

  // ==========================================
  // MOBILE SIDEBAR TOGGLE
  // ==========================================
  const mobileMenuBtn = $('mobile-menu-btn');
  const mobileSidebar = $('mobile-sidebar');
  const sidebarOverlay = $('sidebar-overlay');

  function openMobileSidebar() {
    mobileSidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    mobileSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', openMobileSidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  // Tab Switching Function (reusable)
  function switchToTab(tabName) {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('tab-active'));
    const targetTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (targetTab) targetTab.classList.add('tab-active');

    $('tab-product').classList.toggle('hidden', tabName !== 'product');
    $('tab-orders').classList.toggle('hidden', tabName !== 'orders');
    $('tab-vehicles').classList.toggle('hidden', tabName !== 'vehicles');
    $('tab-customers').classList.toggle('hidden', tabName !== 'customers');
    if ($('tab-dealers')) $('tab-dealers').classList.toggle('hidden', tabName !== 'dealers');
    if ($('tab-profile')) $('tab-profile').classList.toggle('hidden', tabName !== 'profile');

    // Hide product sidebar when on orders, vehicles, or customers tab
    const desktopSidebar = document.querySelector('.desktop-sidebar');
    const mobileSidebar = $('mobile-sidebar');
    const mobileMenuBtn = $('mobile-menu-btn');

    if (tabName === 'product') {
      // Show sidebar for product tab
      if (desktopSidebar) desktopSidebar.classList.remove('lg:hidden');
      if (desktopSidebar) desktopSidebar.classList.add('lg:flex');
      if (mobileMenuBtn) mobileMenuBtn.classList.remove('hidden');
    } else {
      // Hide sidebar for orders, vehicles, customers tabs
      if (desktopSidebar) desktopSidebar.classList.add('lg:hidden');
      if (desktopSidebar) desktopSidebar.classList.remove('lg:flex');
      if (mobileMenuBtn) mobileMenuBtn.classList.add('hidden');
      closeMobileSidebar();
    }

    // Load customers when tab is first visited
    if (tabName === 'customers' && S.customers.length === 0) {
      loadCustomers();
    }

    // Load orders when tab is first visited
    if (tabName === 'orders' && S.orders.length === 0) {
      loadOrders();
    }
  }

  // Expose switchToTab for external scripts (deep linking from email)
  window.AdminDashboard.switchToTab = switchToTab;

  // Tab Click Handlers
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchToTab(t.dataset.tab));
  });

  // ==========================================
  // PRODUCT LIST
  // ==========================================
  async function loadProducts(q = '') {
    try {
      const products = await api.get(`/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      S.allProducts = products;
      applyProductYmmFilter();
    } catch (e) {
      if (e.message === 'Unauthorized') showAuth();
      else toast(e.message, 'error');
    }
  }

  // Apply YMM filter to products
  function applyProductYmmFilter() {
    const { year, make, model } = S.productYmmFilter;

    if (!year && !make && !model) {
      // No filter active
      S.products = S.allProducts;
      updateYmmFilterBadge(false);
    } else {
      // Build a set of matching vehicle IDs based on filter
      const matchingVehicleIds = new Set();
      S.vehicles.forEach(v => {
        const matchYear = !year || String(v.year) === String(year);
        const matchMake = !make || v.make?.toLowerCase() === make.toLowerCase();
        const matchModel = !model || v.model?.toLowerCase() === model.toLowerCase();
        if (matchYear && matchMake && matchModel) {
          matchingVehicleIds.add(v.id);
        }
      });

      console.log('[YMM Filter] Matching vehicles:', matchingVehicleIds.size);

      // Filter products that have any of the matching vehicle IDs in their fitments
      S.products = S.allProducts.filter(p => {
        if (!p.fitments || p.fitments.length === 0) return false;

        // Fitments can be either vehicle IDs (strings) or vehicle objects
        return p.fitments.some(f => {
          // If fitment is a string (vehicle ID)
          if (typeof f === 'string') {
            return matchingVehicleIds.has(f);
          }
          // If fitment is an object with id property
          if (f.id) {
            return matchingVehicleIds.has(f.id);
          }
          // If fitment has year/make/model directly
          if (f.year || f.make || f.model) {
            const matchYear = !year || String(f.year) === String(year);
            const matchMake = !make || f.make?.toLowerCase() === make.toLowerCase();
            const matchModel = !model || f.model?.toLowerCase() === model.toLowerCase();
            return matchYear && matchMake && matchModel;
          }
          return false;
        });
      });

      console.log('[YMM Filter] Filtered products:', S.products.length);
      updateYmmFilterBadge(true);
    }

    renderProducts();
  }

  // Update YMM filter badge visibility
  function updateYmmFilterBadge(active) {
    const badge = $('ymm-filter-badge');
    const badgeMobile = $('ymm-filter-badge-mobile');
    if (badge) badge.classList.toggle('hidden', !active);
    if (badgeMobile) badgeMobile.classList.toggle('hidden', !active);
  }

  function renderProducts() {
    const c = $('product-list');
    $('product-count').textContent = `${S.products.length} products`;

    if (!S.products.length) {
      c.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">No products</div>';
      return;
    }

    c.innerHTML = S.products.map(p => `
      <div class="product-item p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${S.selected?.id === p.id ? 'bg-red-50 border-l-2 border-red-500' : ''}" data-id="${p.id}">
        ${p.image ? `<img src="${p.image}" class="w-10 h-10 object-cover rounded bg-gray-100">` : '<div class="w-10 h-10 bg-gray-100 rounded"></div>'}
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${p.title}</p>
          <p class="text-xs text-gray-500">$${p.price || '0'} | ${p.inventory || 0} in stock</p>
        </div>
      </div>
    `).join('');

    c.querySelectorAll('.product-item').forEach(el => {
      el.addEventListener('click', () => selectProduct(el.dataset.id));
    });

    // Update mobile sidebar
    const cm = $('product-list-mobile');
    if (cm) {
      cm.innerHTML = S.products.length ? S.products.map(p => `
        <div class="product-item p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${S.selected?.id === p.id ? 'bg-red-50 border-l-2 border-red-500' : ''}" data-id="${p.id}">
          ${p.image ? `<img src="${p.image}" class="w-10 h-10 object-cover rounded bg-gray-100">` : '<div class="w-10 h-10 bg-gray-100 rounded"></div>'}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">${p.title}</p>
            <p class="text-xs text-gray-500">${p.price || '0'} | ${p.inventory || 0} in stock</p>
          </div>
        </div>
      `).join('') : '<div class="p-4 text-center text-sm text-gray-400">No products</div>';

      cm.querySelectorAll('.product-item').forEach(el => {
        el.addEventListener('click', () => {
          selectProduct(el.dataset.id);
          closeMobileSidebar();
        });
      });
    }
    if ($('product-count-mobile')) $('product-count-mobile').textContent = `${S.products.length} products`;
  }

  async function selectProduct(id) {
    try {
      // Clear pending media when switching products (with warning if any)
      if (S.pendingMedia.length > 0) {
        const confirmed = await showConfirmModal(`You have ${S.pendingMedia.length} unsaved media. Switch anyway?`, 'Unsaved Media');
        if (!confirmed) return;
        S.pendingMedia.forEach(item => URL.revokeObjectURL(item.preview));
        S.pendingMedia = [];
      }

      // Switch to Products tab if not already there
      switchToTab('product');

      const numId = id.includes('gid://') ? id.split('/').pop() : id;
      const p = await api.get(`/products/${numId}`);
      S.selected = p;

      // Update product in list to keep sidebar in sync
      const idx = S.products.findIndex(prod => prod.id === p.id || prod.id.endsWith(`/${numId}`));
      if (idx !== -1) {
        // Merge the fresh detailed data into the list item
        S.products[idx] = { ...S.products[idx], ...p };
      }

      renderProducts();
      showEditor(p);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function showEditor(p) {
    $('product-empty').classList.add('hidden');
    $('new-product-form').classList.add('hidden');
    $('product-editor').classList.remove('hidden');

    $('editor-title').textContent = p.title;
    $('editor-handle').textContent = `/products/${p.handle}`;
    $('editor-status').value = p.status;
    $('edit-title').value = p.title;
    $('edit-description').value = (p.description || '').replace(/<[^>]+>/g, '');
    $('edit-vendor').value = p.vendor || '';
    $('edit-type').value = p.productType || '';
    // Also refresh product type combo-box if available
    if (window.AdminCategories) {
      window.AdminCategories.refreshProductTypeComboBox('edit-type', p.productType || '');
    }
    $('edit-tags').value = (p.tags || []).join(', ');
    $('edit-price').value = p.price || '';
    $('edit-compare-price').value = p.variants?.[0]?.compareAtPrice || '';
    $('edit-b2b-price').value = p.b2bPrice || '';
    $('edit-discount-price').value = p.discountPrice || '';
    $('edit-sku').value = p.variants?.[0]?.sku || '';

    // Check discount price warning
    validateDiscountPrice();
    $('edit-inventory').value = p.inventory || 0;

    // Check if inventory is tracked
    const isTracked = p.inventoryTracked !== false;
    $('inventory-not-tracked').classList.toggle('hidden', isTracked);
    $('inventory-tracked-section').classList.toggle('opacity-50', !isTracked);
    $('edit-inventory').disabled = !isTracked;
    $('btn-update-inventory').disabled = !isTracked;

    const pid = p.id.includes('gid://') ? p.id.split('/').pop() : p.id;
    $('link-shopify').href = `https://admin.shopify.com/store/skm-ex/products/${pid}`;
    $('link-view').href = `/products/${p.handle}`;

    // Media - use 'media' field (not 'images') for proper delete support
    renderMedia(p.media || p.images || []);

    // Fitments
    renderFitments(p.fitments || []);
    renderFitmentFilters();

    // Shipping
    loadProductShipping(p);

    // Variants & Options
    loadProductVariants(p);
  }

  // Discount Price UI State
  function validateDiscountPrice() {
    const discountPrice = parseFloat($('edit-discount-price').value) || 0;
    const activeNotice = $('discount-active');
    const removeBtn = $('btn-remove-discount');

    // Show/hide remove button and active notice based on discount being set
    if (discountPrice > 0) {
      removeBtn.classList.remove('hidden');
      activeNotice.classList.remove('hidden');
    } else {
      removeBtn.classList.add('hidden');
      activeNotice.classList.add('hidden');
    }
  }

  // Add event listeners for discount validation
  $('edit-price').addEventListener('input', validateDiscountPrice);
  $('edit-discount-price').addEventListener('input', validateDiscountPrice);

  // Remove Discount Handler
  $('btn-remove-discount').addEventListener('click', async () => {
    if (!S.selected) return;

    const confirmRemove = confirm('Remove discount?\n\nThis will:\nâ€¢ Clear the discount price\nâ€¢ Restore variant price to original\nâ€¢ Remove compare-at price');
    if (!confirmRemove) return;

    const btn = $('btn-remove-discount');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Removing...';

    try {
      const pid = S.selected.id.split('/').pop();

      // Get the compare_at_price (which should be the original price when discount was set)
      // or use the current price if no compare_at exists
      const compareAtPrice = parseFloat($('edit-compare-price').value) || 0;
      const currentPrice = parseFloat($('edit-price').value) || 0;
      const originalPrice = compareAtPrice > currentPrice ? compareAtPrice : currentPrice;

      // Update product: clear discount, restore original price, clear compare_at
      const result = await api.put(`/products/${pid}`, {
        price: originalPrice,
        compareAtPrice: null, // Clear compare_at
        discountPrice: null, // Clear discount metafield
        variantId: S.selected.variants?.[0]?.id
      });

      console.log('[Remove Discount] API response:', result);
      console.log('[Remove Discount] Metafield debug:', result.metafieldDebug);

      // Update UI immediately
      $('edit-price').value = originalPrice;
      $('edit-compare-price').value = '';
      $('edit-discount-price').value = '';
      validateDiscountPrice();

      if (result.metafieldDeleted) {
        toast('Discount removed & metafield deleted. Price: $' + originalPrice.toFixed(2), 'success');
      } else if (result.metafieldDeleted === false) {
        const debug = result.metafieldDebug || {};
        if (debug.notFound) {
          toast('Warning: Discount metafield not found in Shopify', 'error');
        } else if (debug.error) {
          toast('Error deleting metafield: ' + debug.error, 'error');
        } else {
          toast('Warning: Metafield deletion failed. Check console for details.', 'error');
        }
        console.error('[Remove Discount] Debug info:', debug);
      } else {
        toast('Discount removed, price restored to $' + originalPrice.toFixed(2), 'success');
      }

      // Wait for Shopify to process the metafield deletion, then refresh
      await new Promise(r => setTimeout(r, 1500));
      await selectProduct(S.selected.id);

    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  function renderMedia(images) {
    const g = $('media-grid');
    const hasExisting = images && images.length > 0;
    const hasPending = S.pendingMedia && S.pendingMedia.length > 0;

    if (!hasExisting && !hasPending) {
      g.innerHTML = '<div class="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No media</div>';
      return;
    }

    let html = '';

    // Render existing media
    if (hasExisting) {
      html += images.map(img => {
        const isVideo = img.mediaContentType === 'VIDEO' || img.type === 'VIDEO' || img.media_type === 'video' || (img.sources && img.sources.length > 0);
        if (isVideo) {
          // Get video source URL
          const videoSrc = img.sources?.[0]?.url || img.url;
          const posterUrl = img.preview_image?.url || img.previewImage?.url || img.url || '';
          return `
            <div class="aspect-square bg-gray-900 rounded-lg overflow-hidden relative group">
              <video src="${videoSrc}" poster="${posterUrl}" class="w-full h-full object-cover" muted loop playsinline preload="metadata"></video>
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span class="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </span>
              </div>
              <button class="delete-media absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center" data-id="${img.id}">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            </div>
          `;
        } else {
          return `
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group">
              <img src="${img.url}" class="w-full h-full object-cover">
              <button class="delete-media absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center" data-id="${img.id}">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            </div>
          `;
        }
      }).join('');
    }

    // Render pending uploads with preview
    if (hasPending) {
      html += S.pendingMedia.map((item, idx) => `
        <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group ring-2 ring-yellow-400">
          <img src="${item.preview}" class="w-full h-full object-cover opacity-70">
          <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span class="text-xs text-white bg-yellow-500 px-2 py-0.5 rounded">Pending</span>
          </div>
          <button class="remove-pending absolute top-1 right-1 w-6 h-6 bg-gray-600 text-white rounded-full opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center" data-idx="${idx}">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        </div>
      `).join('');
    }

    g.innerHTML = html;

    // Bind delete existing media
    g.querySelectorAll('.delete-media').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirmModal('Delete this image?', 'Delete Image');
        if (!confirmed) return;
        try {
          const pid = S.selected.id.split('/').pop();
          // Extract just the numeric ID from the full GID
          const mediaIdFull = btn.dataset.id;
          const mediaIdNum = mediaIdFull.split('/').pop();
          console.log('Deleting media:', { pid, mediaIdFull, mediaIdNum });
          await api.del(`/products/${pid}/media/${mediaIdNum}`);
          toast('Media deleted', 'success');
          await selectProduct(S.selected.id);
        } catch (e) {
          console.error('Delete error:', e);
          toast(e.message, 'error');
        }
      });
    });

    // Bind remove pending media
    g.querySelectorAll('.remove-pending').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        URL.revokeObjectURL(S.pendingMedia[idx].preview); // Clean up preview URL
        S.pendingMedia.splice(idx, 1);
        renderMedia(S.selected?.media || S.selected?.images || []);
        toast('Pending upload removed', 'info');
      });
    });
  }

  function renderFitments(fitments) {
    const c = $('current-fitments');
    const countEl = $('current-fitments-count');

    // Update count
    if (countEl) countEl.textContent = `${fitments.length} vehicle${fitments.length !== 1 ? 's' : ''}`;

    if (!fitments.length) {
      c.innerHTML = '<span class="text-sm text-gray-400">No fitments</span>';
      return;
    }
    c.innerHTML = fitments.map(f => `
      <span class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded shadow-sm">
        ${f.full_name || `${f.year} ${f.make} ${f.model} ${f.submodel || ''}`}
        <button class="remove-fit text-gray-400 hover:text-red-500 ml-1 flex items-center justify-center p-0.5" data-id="${f.id}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      </span>
    `).join('');

    c.querySelectorAll('.remove-fit').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const pid = S.selected.id.split('/').pop();
          await api.del(`/products/${pid}/fitment`, { vehicle_id: btn.dataset.id });
          toast('Fitment removed', 'success');
          selectProduct(S.selected.id);
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  // ==========================================
  // FITMENT FILTERS
  // ==========================================
  function renderFitmentFilters() {
    const years = [...new Set(S.vehicles.map(v => v.year))].sort((a, b) => b - a);
    $('fit-year').innerHTML = `<option value="">All Years</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}`;
    updateFitmentOptions();
  }

  function updateFitmentOptions() {
    const { year, make, model } = S.filters;

    const makes = [...new Set(S.vehicles.filter(v => !year || v.year == year).map(v => v.make))].sort();
    $('fit-make').innerHTML = `<option value="">All Makes</option>${makes.map(m => `<option value="${m}">${m}</option>`).join('')}`;
    if (make) $('fit-make').value = make;

    const models = [...new Set(S.vehicles.filter(v => (!year || v.year == year) && (!make || v.make === make)).map(v => v.model))].sort();
    $('fit-model').innerHTML = `<option value="">All Models</option>${models.map(m => `<option value="${m}">${m}</option>`).join('')}`;
    if (model) $('fit-model').value = model;

    const subs = [...new Set(S.vehicles.filter(v => (!year || v.year == year) && (!make || v.make === make) && (!model || v.model === model)).map(v => v.submodel).filter(Boolean))].sort();
    $('fit-submodel').innerHTML = `<option value="">All Submodels</option>${subs.map(s => `<option value="${s}">${s}</option>`).join('')}`;

    renderVehicleCheckboxes();
  }

  function renderVehicleCheckboxes() {
    const { year, make, model, submodel } = S.filters;
    let filtered = S.vehicles.filter(v => {
      if (year && v.year != year) return false;
      if (make && v.make !== make) return false;
      if (model && v.model !== model) return false;
      if (submodel && v.submodel !== submodel) return false;
      return true;
    });

    const c = $('vehicle-checkboxes');
    if (!filtered.length) {
      c.innerHTML = '<div class="p-3 text-sm text-gray-400 text-center">No matches</div>';
      return;
    }

    // Exclude already added fitments
    const existingIds = (S.selected?.fitments || []).map(f => f.id);
    filtered = filtered.filter(v => !existingIds.includes(v.id));

    if (!filtered.length) {
      c.innerHTML = '<div class="p-3 text-sm text-gray-400 text-center">All matching vehicles already added</div>';
      return;
    }

    c.innerHTML = filtered.slice(0, 50).map(v => `
      <label class="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
        <input type="checkbox" class="fit-cb w-4 h-4 rounded border-gray-300 text-red-600" data-id="${v.id}">
        <span class="text-sm text-gray-700">${v.full_name || `${v.year} ${v.make} ${v.model} ${v.submodel || ''}`}</span>
      </label>
    `).join('');

    c.querySelectorAll('.fit-cb').forEach(cb => {
      cb.checked = S.selectedVehicles.has(cb.dataset.id);
      cb.addEventListener('change', () => {
        if (cb.checked) S.selectedVehicles.add(cb.dataset.id);
        else S.selectedVehicles.delete(cb.dataset.id);
        updateFitCount();
      });
    });
  }

  function updateFitCount() {
    $('fit-count').textContent = `${S.selectedVehicles.size} selected`;
    $('btn-add-fitments').disabled = S.selectedVehicles.size === 0;
  }

  ['fit-year', 'fit-make', 'fit-model', 'fit-submodel'].forEach(id => {
    $(id).addEventListener('change', (e) => {
      S.filters[id.replace('fit-', '')] = e.target.value;
      updateFitmentOptions();
    });
  });

  $('btn-add-fitments').addEventListener('click', async () => {
    if (!S.selected || S.selectedVehicles.size === 0) return;
    try {
      const pid = S.selected.id.split('/').pop();
      await api.post('/products/update-fitment', { product_id: pid, vehicle_ids: [...S.selectedVehicles] });
      toast('Fitments added', 'success');
      S.selectedVehicles.clear();
      updateFitCount();
      selectProduct(S.selected.id);
    } catch (e) { toast(e.message, 'error'); }
  });

  // ==========================================
  // SAVE PRODUCT
  // ==========================================
  $('btn-save-product').addEventListener('click', async () => {
    if (!S.selected) return;
    const btn = $('btn-save-product');
    const spinner = $('save-spinner');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const pid = S.selected.id.split('/').pop();
      const hadPendingMedia = S.pendingMedia.length > 0;

      // Upload any pending media first
      if (hadPendingMedia) {
        toast(`Uploading ${S.pendingMedia.length} media files...`, 'info');
        await uploadPendingMedia(pid);
      }

      // Save product details
      await api.put(`/products/${pid}`, {
        title: $('edit-title').value,
        description: $('edit-description').value,
        vendor: $('edit-vendor').value,
        productType: $('edit-type').value,
        tags: $('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        status: $('editor-status').value,
        price: $('edit-price').value,
        compareAtPrice: $('edit-compare-price').value,
        b2bPrice: $('edit-b2b-price').value || null,
        discountPrice: $('edit-discount-price').value || null,
        variantId: S.selected.variants?.[0]?.id
      });

      // Also update inventory if changed
      const newQty = $('edit-inventory').value;
      const currentQty = S.selected.inventory || 0;
      if (newQty !== '' && parseInt(newQty) !== currentQty) {
        console.log('[Save Changes] Updating inventory from', currentQty, 'to', newQty);
        try {
          const invResult = await api.put(`/products/${pid}/inventory`, { quantity: parseInt(newQty) });
          console.log('[Save Changes] Inventory result:', invResult);
          S.selected.inventory = parseInt(newQty);
          toast('Product & inventory saved', 'success');
        } catch (invErr) {
          console.error('[Save Changes] Inventory update failed:', invErr);
          if (invErr.message.includes('not tracked')) {
            toast('Product saved. Note: Inventory not tracked for this product.', 'info');
          } else {
            toast('Product saved, but inventory failed: ' + invErr.message, 'error');
          }
        }
      } else {
        toast('Product saved', 'success');
      }

      // Refresh product data from API to get actual saved values
      const savedProductId = S.selected.id;
      await selectProduct(savedProductId);

      // Update the list item in S.products
      if (S.selected) {
        const idx = S.products.findIndex(p => p.id === S.selected.id);
        if (idx !== -1) {
          S.products[idx] = {
            ...S.products[idx],
            title: S.selected.title,
            price: S.selected.price,
            inventory: S.selected.inventory
          };
          renderProducts();
        }
      }

      // Extra delay for media processing if needed
      if (hadPendingMedia) {
        toast('Refreshing media...', 'info');
        await new Promise(r => setTimeout(r, 2500));
        await selectProduct(savedProductId);
      }

    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; spinner.classList.add('hidden'); }
  });

  // ==========================================
  // DELETE PRODUCT
  // ==========================================
  $('btn-delete-product').addEventListener('click', async () => {
    if (!S.selected) return;
    const confirmed = await showConfirmModal('Delete this product? This cannot be undone.', 'Delete Product');
    if (!confirmed) return;
    try {
      const pid = S.selected.id.split('/').pop();
      await api.del(`/products/${pid}`);
      toast('Product deleted', 'success');
      S.selected = null;
      $('product-editor').classList.add('hidden');
      $('product-empty').classList.remove('hidden');
      loadProducts();
    } catch (e) { toast(e.message, 'error'); }
  });

  // ==========================================
  // ENABLE INVENTORY TRACKING
  // ==========================================
  $('btn-enable-tracking').addEventListener('click', async () => {
    if (!S.selected) return;

    const btn = $('btn-enable-tracking');
    btn.disabled = true;
    btn.textContent = 'Enabling...';

    try {
      const pid = S.selected.id.split('/').pop();
      await api.post(`/products/${pid}/enable-tracking`);
      toast('Inventory tracking enabled!', 'success');

      // Refresh product data
      await selectProduct(S.selected.id);
    } catch (e) {
      toast('Failed to enable tracking: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enable Tracking';
    }
  });

  // ==========================================
  // UPDATE INVENTORY
  // ==========================================
  $('btn-update-inventory').addEventListener('click', async () => {
    console.log('[Inventory Button] Clicked');
    if (!S.selected) {
      toast('No product selected', 'error');
      return;
    }

    const btn = $('btn-update-inventory');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      const pid = S.selected.id.split('/').pop();
      const qty = parseInt($('edit-inventory').value) || 0;
      console.log('[Inventory Button] Updating product', pid, 'to quantity', qty);

      const result = await api.put(`/products/${pid}/inventory`, { quantity: qty });
      console.log('[Inventory Button] Result:', result);

      toast('Inventory updated to ' + qty, 'success');

      // Update local state
      S.selected.inventory = qty;

      // Update sidebar list
      const idx = S.products.findIndex(p => p.id === S.selected.id);
      if (idx !== -1) {
        S.products[idx].inventory = qty;
        renderProducts();
      }

    } catch (e) {
      console.error('[Inventory Button] Error:', e);
      toast('Inventory update failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // ==========================================
  // MEDIA UPLOAD
  // ==========================================
  const dropzone = $('media-dropzone');
  const fileInput = $('media-file-input');
  const progressEl = $('media-upload-progress');
  const uploadBar = $('upload-bar');
  const uploadFilename = $('upload-filename');
  const uploadPercent = $('upload-percent');

  $('btn-add-media').addEventListener('click', () => {
    $('media-upload').classList.remove('hidden');
  });

  $('btn-cancel-media').addEventListener('click', () => {
    $('media-upload').classList.add('hidden');
    $('media-url').value = '';
    fileInput.value = '';
  });

  // Dropzone click -> open file picker
  dropzone.addEventListener('click', () => fileInput.click());

  // Drag & Drop handlers
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-red-400', 'bg-red-50');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-red-400', 'bg-red-50');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-red-400', 'bg-red-50');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files);
  });

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleFileUpload(fileInput.files);
  });

  // Immediate file upload (uploads right away)
  async function handleFileUpload(files) {
    if (!S.selected) { toast('Select a product first', 'error'); return; }

    const pid = S.selected.id.split('/').pop();

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast(`${file.name} is not an image or video`, 'error');
        continue;
      }

      try {
        // Show progress
        progressEl.classList.remove('hidden');
        uploadFilename.textContent = `Uploading ${file.name}...`;
        uploadPercent.textContent = '0%';
        uploadBar.style.width = '0%';

        // Step 1: Get staged upload URL
        const stagedRes = await api.post('/media/staged-upload', {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size
        });

        if (!stagedRes.success || !stagedRes.data) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadUrl, resourceUrl, parameters } = stagedRes.data;
        uploadBar.style.width = '30%';

        // Step 2: Upload to Shopify storage
        const formData = new FormData();
        parameters.forEach(p => formData.append(p.name, p.value));
        formData.append('file', file);

        const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Storage upload failed');

        uploadBar.style.width = '70%';
        uploadPercent.textContent = 'Attaching...';

        // Step 3: Attach to product
        const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
        await api.post(`/products/${pid}/media`, {
          resourceUrl,
          mediaContentType: mediaType,
          alt: ''
        });

        uploadBar.style.width = '100%';
        uploadPercent.textContent = 'Done!';
        toast(`${file.name} uploaded`, 'success');

      } catch (e) {
        toast(`Failed: ${e.message}`, 'error');
      }
    }

    // Hide progress and refresh
    setTimeout(async () => {
      progressEl.classList.add('hidden');
      uploadBar.style.width = '0%';
      fileInput.value = '';
      $('media-upload').classList.add('hidden');
      // Wait for Shopify to process, then refresh
      await new Promise(r => setTimeout(r, 2000));
      await selectProduct(S.selected.id);
    }, 500);
  }

  // Legacy function for save (not used anymore but kept for compatibility)
  async function uploadPendingMedia(productId) {
    if (S.pendingMedia.length === 0) return true;

    const total = S.pendingMedia.length;
    let uploaded = 0;

    progressEl.classList.remove('hidden');

    for (const item of S.pendingMedia) {
      try {
        uploadFilename.textContent = `Uploading ${item.name} (${uploaded + 1}/${total})`;
        uploadPercent.textContent = '0%';
        uploadBar.style.width = '0%';

        // Step 1: Get staged upload URL
        const stagedRes = await api.post('/media/staged-upload', {
          filename: item.name,
          mimeType: item.type || 'application/octet-stream',
          fileSize: item.file.size
        });

        if (!stagedRes.success || !stagedRes.data) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadUrl, resourceUrl, parameters } = stagedRes.data;
        uploadBar.style.width = '30%';

        // Step 2: Upload to Shopify storage
        const formData = new FormData();
        parameters.forEach(p => formData.append(p.name, p.value));
        formData.append('file', item.file);

        const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Storage upload failed');

        uploadBar.style.width = '70%';

        // Step 3: Attach to product
        const mediaType = item.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
        await api.post(`/products/${productId}/media`, {
          resourceUrl,
          mediaContentType: mediaType,
          alt: ''
        });

        uploadBar.style.width = '100%';
        uploaded++;

        // Clean up preview URL
        URL.revokeObjectURL(item.preview);

      } catch (e) {
        toast(`Failed to upload ${item.name}: ${e.message}`, 'error');
      }
    }

    // Clear pending media
    S.pendingMedia = [];
    progressEl.classList.add('hidden');
    uploadBar.style.width = '0%';

    return uploaded > 0;
  }

  // URL-based upload
  $('btn-upload-url').addEventListener('click', async () => {
    const url = $('media-url').value.trim();
    if (!url || !S.selected) return;
    try {
      const pid = S.selected.id.split('/').pop();
      await api.post(`/products/${pid}/media`, { urls: [url] });
      toast('Media added', 'success');
      $('media-upload').classList.add('hidden');
      $('media-url').value = '';
      selectProduct(S.selected.id);
    } catch (e) { toast(e.message, 'error'); }
  });

  // ==========================================
  // NEW PRODUCT (Full Featured)
  // ==========================================

  // Pending data for new product
  const newProductPending = {
    media: [], // Array of { file: File, preview: string }
    fitments: new Set(), // Set of vehicle IDs
    filters: { year: '', make: '', model: '', submodel: '' },
    options: [], // Array of { name: string, values: string[], isAddOn: boolean, priceModifiers: {} }
    variants: [], // Generated variant combinations
    mediaTags: {} // Map of media index to array of option values
  };

  function showNewProduct() {
    $('product-empty').classList.add('hidden');
    $('product-editor').classList.add('hidden');
    $('new-product-form').classList.remove('hidden');

    // Reset all fields
    $('new-title').value = '';
    $('new-description').value = '';
    $('new-vendor').value = '';
    $('new-type').value = '';
    $('new-tags').value = '';
    $('new-price').value = '';
    $('new-compare-price').value = '';
    $('new-b2b-price').value = '';
    $('new-discount-price').value = '';
    $('new-sku').value = '';
    $('new-inventory').value = '0';
    $('new-status').value = 'DRAFT';

    // Clear pending data
    newProductPending.media.forEach(m => URL.revokeObjectURL(m.preview));
    newProductPending.media = [];
    newProductPending.fitments.clear();
    newProductPending.filters = { year: '', make: '', model: '', submodel: '' };
    newProductPending.options = [];
    newProductPending.variants = [];
    newProductPending.mediaTags = {};

    renderNewMediaGrid();
    renderNewFitmentsList();
    initNewFitmentFilters();
    renderNewOptionsEditor();

    $('new-title').focus();
  }

  function renderNewMediaGrid() {
    const g = $('new-media-grid');
    $('new-media-count').textContent = newProductPending.media.length;

    if (newProductPending.media.length === 0) {
      g.innerHTML = '<div class="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No media</div>';
      return;
    }

    g.innerHTML = newProductPending.media.map((item, idx) => {
      const isVideo = item.file?.type?.startsWith('video/') || item.name?.match(/\.(mp4|mov|webm|avi)$/i);
      if (isVideo) {
        return `
          <div class="aspect-square bg-gray-900 rounded-lg overflow-hidden relative group ring-2 ring-amber-400">
            <video src="${item.preview}" class="w-full h-full object-cover" muted preload="metadata"></video>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </span>
            </div>
            <div class="absolute top-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded">Pending</div>
            <button class="remove-new-media absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center" data-idx="${idx}">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          </div>
        `;
      } else {
        return `
          <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group ring-2 ring-amber-400">
            <img src="${item.preview}" class="w-full h-full object-cover">
            <div class="absolute top-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded">Pending</div>
            <button class="remove-new-media absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center" data-idx="${idx}">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          </div>
        `;
      }
    }).join('');

    g.querySelectorAll('.remove-new-media').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        URL.revokeObjectURL(newProductPending.media[idx].preview);
        newProductPending.media.splice(idx, 1);
        renderNewMediaGrid();
      });
    });
  }

  function renderNewFitmentsList() {
    const c = $('new-fitments-list');
    const count = newProductPending.fitments.size;

    // Update both count displays
    $('new-fitment-count').textContent = count;
    const countEl = $('new-fitments-count');
    if (countEl) countEl.textContent = `${count} vehicle${count !== 1 ? 's' : ''}`;

    if (count === 0) {
      c.innerHTML = '<span class="text-sm text-gray-400">No vehicles selected</span>';
      return;
    }

    const selectedVehicles = S.vehicles.filter(v => newProductPending.fitments.has(v.id));
    c.innerHTML = selectedVehicles.map(v => `
      <span class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded shadow-sm">
        ${v.full_name}
        <button class="remove-new-fit text-gray-400 hover:text-red-500 ml-1 flex items-center justify-center p-0.5" data-id="${v.id}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      </span>
    `).join('');

    c.querySelectorAll('.remove-new-fit').forEach(btn => {
      btn.addEventListener('click', () => {
        newProductPending.fitments.delete(btn.dataset.id);
        renderNewFitmentsList();
        renderNewFilteredVehicles();
      });
    });
  }

  function initNewFitmentFilters() {
    if (S.vehicles.length === 0) {
      $('new-filtered-vehicles').innerHTML = '<div class="p-3 text-sm text-gray-400 text-center">Loading vehicles...</div>';
      return;
    }

    const years = [...new Set(S.vehicles.map(v => v.year))].sort((a, b) => b - a);
    $('new-fit-year').innerHTML = `<option value="">Year</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}`;

    updateNewFitmentFilters();
  }

  function updateNewFitmentFilters() {
    const { year, make, model } = newProductPending.filters;

    // Filter makes based on year
    const filteredMakes = [...new Set(S.vehicles.filter(v => !year || v.year == year).map(v => v.make))].sort();
    $('new-fit-make').innerHTML = `<option value="">Make</option>${filteredMakes.map(m => `<option value="${m}">${m}</option>`).join('')}`;
    $('new-fit-make').value = make;

    // Filter models based on year and make
    const filteredModels = [...new Set(S.vehicles.filter(v =>
      (!year || v.year == year) && (!make || v.make == make)
    ).map(v => v.model))].sort();
    $('new-fit-model').innerHTML = `<option value="">Model</option>${filteredModels.map(m => `<option value="${m}">${m}</option>`).join('')}`;
    $('new-fit-model').value = model;

    // Filter submodels
    const filteredSubs = [...new Set(S.vehicles.filter(v =>
      (!year || v.year == year) && (!make || v.make == make) && (!model || v.model == model)
    ).map(v => v.submodel).filter(Boolean))].sort();
    $('new-fit-submodel').innerHTML = `<option value="">Submodel</option>${filteredSubs.map(s => `<option value="${s}">${s}</option>`).join('')}`;
    $('new-fit-submodel').value = newProductPending.filters.submodel;

    renderNewFilteredVehicles();
  }

  function renderNewFilteredVehicles() {
    const c = $('new-filtered-vehicles');
    const { year, make, model, submodel } = newProductPending.filters;

    // Need at least one filter
    if (!year && !make && !model) {
      c.innerHTML = '<div class="p-3 text-sm text-gray-400 text-center">Select filters above</div>';
      updateNewFitCount();
      return;
    }

    // Filter vehicles
    const filtered = S.vehicles.filter(v =>
      (!year || v.year == year) &&
      (!make || v.make == make) &&
      (!model || v.model == model) &&
      (!submodel || v.submodel == submodel)
    );

    if (!filtered.length) {
      c.innerHTML = '<div class="p-3 text-sm text-gray-400 text-center">No vehicles found</div>';
      updateNewFitCount();
      return;
    }

    c.innerHTML = filtered.map(v => {
      const isAlreadySelected = newProductPending.fitments.has(v.id);
      return `
        <label class="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer ${isAlreadySelected ? 'bg-green-50' : ''}">
          <input type="checkbox" class="new-vehicle-cb form-checkbox h-4 w-4 text-red-600 rounded" value="${v.id}" ${isAlreadySelected ? 'checked disabled' : ''}>
          <span class="text-sm text-gray-700 flex-1">${v.full_name}</span>
          ${isAlreadySelected ? '<span class="text-xs text-green-600">Added</span>' : ''}
        </label>
      `;
    }).join('');

    // Bind checkbox change events to update count
    c.querySelectorAll('.new-vehicle-cb:not(:disabled)').forEach(cb => {
      cb.addEventListener('change', updateNewFitCount);
    });

    updateNewFitCount();
  }

  function updateNewFitCount() {
    const checkboxes = document.querySelectorAll('.new-vehicle-cb:checked:not(:disabled)');
    const count = checkboxes.length;
    $('new-fit-count').textContent = `${count} selected`;
    $('btn-add-new-fitments').disabled = count === 0;
  }

  // New product filter listeners
  ['new-fit-year', 'new-fit-make', 'new-fit-model', 'new-fit-submodel'].forEach(id => {
    $(id).addEventListener('change', (e) => {
      const key = id.replace('new-fit-', '');
      newProductPending.filters[key] = e.target.value;
      // Reset downstream filters when parent changes
      if (key === 'year') { newProductPending.filters.make = ''; newProductPending.filters.model = ''; newProductPending.filters.submodel = ''; }
      if (key === 'make') { newProductPending.filters.model = ''; newProductPending.filters.submodel = ''; }
      if (key === 'model') { newProductPending.filters.submodel = ''; }
      updateNewFitmentFilters();
    });
  });

  // Add selected fitments button
  $('btn-add-new-fitments').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.new-vehicle-cb:checked:not(:disabled)');
    checkboxes.forEach(cb => {
      newProductPending.fitments.add(cb.value);
    });
    renderNewFitmentsList();
    renderNewFilteredVehicles();
    toast(`Added ${checkboxes.length} vehicle(s)`, 'success');
  });

  // New product media upload
  const newDropzone = $('new-media-dropzone');
  const newFileInput = $('new-media-file-input');

  newDropzone.addEventListener('click', () => newFileInput.click());
  newDropzone.addEventListener('dragover', (e) => { e.preventDefault(); newDropzone.classList.add('border-red-400', 'bg-red-50'); });
  newDropzone.addEventListener('dragleave', (e) => { e.preventDefault(); newDropzone.classList.remove('border-red-400', 'bg-red-50'); });
  newDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    newDropzone.classList.remove('border-red-400', 'bg-red-50');
    if (e.dataTransfer.files.length > 0) handleNewMediaFiles(e.dataTransfer.files);
  });
  newFileInput.addEventListener('change', () => {
    if (newFileInput.files.length > 0) handleNewMediaFiles(newFileInput.files);
    newFileInput.value = '';
  });

  function handleNewMediaFiles(files) {
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      newProductPending.media.push({ file, preview, name: file.name });
    }
    renderNewMediaGrid();
    renderNewMediaMapping();
    toast(`${files.length} file(s) added to pending`, 'info');
  }

  // ==========================================
  // NEW PRODUCT OPTIONS EDITOR
  // ==========================================

  // Add new option button
  if ($('btn-add-new-option')) {
    $('btn-add-new-option').addEventListener('click', () => {
      newProductPending.options.push({ name: '', values: [], isAddOn: false, priceModifiers: {} });
      renderNewOptionsEditor();
    });
  }

  function renderNewOptionsEditor() {
    const container = $('new-options-editor');
    if (!container) return;

    if (newProductPending.options.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">No options defined. Add options like "Material" or "Size" to create variants.</p>';
      $('new-variants-section').classList.add('hidden');
      $('new-media-option-mapping').classList.add('hidden');
      updateNewPricingFieldsState();
      return;
    }

    container.innerHTML = newProductPending.options.map((opt, idx) => `
      <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 ${opt.isAddOn ? 'border-blue-300 bg-blue-50' : ''}" data-option-idx="${idx}">
        <div class="flex items-center gap-2 mb-2">
          <input type="text" class="new-option-name flex-1 h-8 px-2 text-sm border border-gray-200 rounded" 
                 placeholder="Option name (e.g., Material)" value="${opt.name}" data-idx="${idx}">
          <button class="btn-remove-new-option text-xs text-red-500 hover:text-red-700 px-2" data-idx="${idx}">&#10005;</button>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" class="new-option-addon-toggle rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                   data-idx="${idx}" ${opt.isAddOn ? 'checked' : ''}>
            <span>Add-on option</span>
          </label>
          <span class="text-xs text-gray-400">${opt.isAddOn ? '(Does not affect inventory - price modifier only)' : '(Affects inventory count)'}</span>
        </div>
        <div class="flex flex-wrap gap-1 mb-2 new-option-values-container" data-idx="${idx}">
          ${opt.values.map((v, vi) => {
      const priceModifier = opt.priceModifiers?.[v] || 0;
      return `
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 text-xs rounded ${opt.isAddOn && priceModifier ? 'border-blue-200' : ''}">
                ${v}${opt.isAddOn && priceModifier ? ` (+$${priceModifier})` : ''}
                <button class="btn-remove-new-value text-gray-400 hover:text-red-500" data-opt-idx="${idx}" data-val-idx="${vi}">&#215;</button>
              </span>
            `;
    }).join('')}
        </div>
        ${opt.isAddOn ? `
          <div class="mb-2 p-2 bg-white rounded border border-blue-100">
            <p class="text-xs text-gray-500 mb-2">Price modifiers for add-on values:</p>
            <div class="grid grid-cols-2 gap-2">
              ${opt.values.map((v, vi) => `
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-600 truncate flex-1">${v}:</span>
                  <span class="text-xs text-gray-400">+$</span>
                  <input type="number" step="0.01" class="new-addon-price-modifier w-16 h-6 px-1 text-xs border border-gray-200 rounded" 
                         data-opt-idx="${idx}" data-value="${v}" value="${opt.priceModifiers?.[v] || 0}">
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="flex gap-2">
          <input type="text" class="new-option-value-input flex-1 h-7 px-2 text-xs border border-gray-200 rounded" 
                 placeholder="Add value (press Enter)" data-idx="${idx}">
          <button class="btn-add-new-value h-7 px-2 text-xs text-white bg-gray-700 rounded" data-idx="${idx}">Add</button>
        </div>
      </div>
    `).join('');

    // Bind option name change
    container.querySelectorAll('.new-option-name').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        newProductPending.options[idx].name = e.target.value;
        generateNewVariantsPreview();
        renderNewMediaMapping();
      });
    });

    // Bind add-on toggle
    container.querySelectorAll('.new-option-addon-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        newProductPending.options[idx].isAddOn = e.target.checked;
        if (e.target.checked && !newProductPending.options[idx].priceModifiers) {
          newProductPending.options[idx].priceModifiers = {};
        }
        renderNewOptionsEditor();
        generateNewVariantsPreview();
      });
    });

    // Bind price modifier inputs
    container.querySelectorAll('.new-addon-price-modifier').forEach(input => {
      input.addEventListener('change', (e) => {
        const optIdx = parseInt(e.target.dataset.optIdx);
        const value = e.target.dataset.value;
        const price = parseFloat(e.target.value) || 0;
        if (!newProductPending.options[optIdx].priceModifiers) {
          newProductPending.options[optIdx].priceModifiers = {};
        }
        newProductPending.options[optIdx].priceModifiers[value] = price;
        renderNewOptionsEditor();
      });
    });

    // Bind remove option
    container.querySelectorAll('.btn-remove-new-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        newProductPending.options.splice(idx, 1);
        renderNewOptionsEditor();
        generateNewVariantsPreview();
      });
    });

    // Bind remove value
    container.querySelectorAll('.btn-remove-new-value').forEach(btn => {
      btn.addEventListener('click', () => {
        const optIdx = parseInt(btn.dataset.optIdx);
        const valIdx = parseInt(btn.dataset.valIdx);
        newProductPending.options[optIdx].values.splice(valIdx, 1);
        renderNewOptionsEditor();
        generateNewVariantsPreview();
      });
    });

    // Bind add value button
    container.querySelectorAll('.btn-add-new-value').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const input = container.querySelector(`.new-option-value-input[data-idx="${idx}"]`);
        addNewOptionValue(idx, input.value);
        input.value = '';
      });
    });

    // Bind enter key on value input
    container.querySelectorAll('.new-option-value-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const idx = parseInt(input.dataset.idx);
          addNewOptionValue(idx, input.value);
          input.value = '';
        }
      });
    });

    // Show variants section if we have options with values
    const hasValidOptions = newProductPending.options.some(o => o.name && o.values.length > 0 && !o.isAddOn);
    $('new-variants-section').classList.toggle('hidden', !hasValidOptions);

    // Update media mapping
    renderNewMediaMapping();
  }

  function addNewOptionValue(optIdx, value) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (newProductPending.options[optIdx].values.includes(trimmed)) {
      toast('Value already exists', 'error');
      return;
    }
    newProductPending.options[optIdx].values.push(trimmed);
    renderNewOptionsEditor();
    generateNewVariantsPreview();
  }

  function generateNewVariantsPreview() {
    // Filter out add-on options for variant generation
    const validOptions = newProductPending.options.filter(o => o.name && o.values.length > 0 && !o.isAddOn);

    if (validOptions.length === 0) {
      $('new-variants-tbody').innerHTML = '<tr><td colspan="5" class="px-3 py-4 text-center text-gray-400 text-sm">Add options to generate variants</td></tr>';
      $('new-variants-count').textContent = '0';
      newProductPending.variants = [];
      return;
    }

    // Generate all combinations
    const combinations = [];
    const basePrice = parseFloat($('new-price').value) || 0;
    const baseSku = $('new-sku').value || '';
    const baseInventory = parseInt($('new-inventory').value) || 0;

    function generateCombinations(optionIndex, current) {
      if (optionIndex >= validOptions.length) {
        combinations.push([...current]);
        return;
      }
      for (const value of validOptions[optionIndex].values) {
        current.push({ option: validOptions[optionIndex].name, value });
        generateCombinations(optionIndex + 1, current);
        current.pop();
      }
    }

    generateCombinations(0, []);
    newProductPending.variants = combinations;

    $('new-variants-count').textContent = combinations.length;
    $('new-variants-tbody').innerHTML = combinations.map((combo, idx) => {
      const title = combo.map(c => c.value).join(' / ');
      const skuSuffix = combo.map(c => c.value.substring(0, 3).toUpperCase()).join('-');
      return `
        <tr>
          <td class="px-3 py-2 text-sm text-gray-900">${title}</td>
          <td class="px-3 py-2">
            <input type="number" step="0.01" class="new-variant-price w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   data-idx="${idx}" value="${basePrice.toFixed(2)}">
          </td>
          <td class="px-3 py-2">
            <input type="number" step="0.01" class="new-variant-b2b-price w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   data-idx="${idx}" value="" placeholder="Optional">
          </td>
          <td class="px-3 py-2">
            <input type="text" class="new-variant-sku w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   data-idx="${idx}" value="${baseSku ? baseSku + '-' + skuSuffix : ''}">
          </td>
          <td class="px-3 py-2">
            <input type="number" class="new-variant-inventory w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   data-idx="${idx}" value="${baseInventory}">
          </td>
        </tr>
      `;
    }).join('');

    // Update pricing fields state based on variants
    updateNewPricingFieldsState();
  }

  // Update new product pricing fields based on variants
  function updateNewPricingFieldsState() {
    const notice = $('new-pricing-variant-notice');
    const container = $('new-pricing-fields-container');
    if (!notice || !container) return;

    // Check if there are inventory-affecting options (non-add-on options with values)
    const hasInventoryOptions = newProductPending.options.some(o => o.name && o.values.length > 0 && !o.isAddOn);

    if (hasInventoryOptions) {
      // Show notice and disable pricing fields
      notice.classList.remove('hidden');
      container.classList.add('opacity-60');

      ['new-price', 'new-compare-price', 'new-b2b-price', 'new-discount-price'].forEach(id => {
        const el = $(id);
        if (el) {
          el.disabled = true;
          el.classList.add('bg-gray-100', 'cursor-not-allowed');
        }
      });
    } else {
      // Hide notice and enable pricing fields
      notice.classList.add('hidden');
      container.classList.remove('opacity-60');

      ['new-price', 'new-compare-price', 'new-b2b-price', 'new-discount-price'].forEach(id => {
        const el = $(id);
        if (el) {
          el.disabled = false;
          el.classList.remove('bg-gray-100', 'cursor-not-allowed');
        }
      });
    }
  }

  function renderNewMediaMapping() {
    const container = $('new-media-mapping-grid');
    if (!container) return;

    const media = newProductPending.media;
    const hasOptions = newProductPending.options.some(o => o.name && o.values.length > 0);
    const hasMedia = media.length > 0;

    $('new-media-option-mapping').classList.toggle('hidden', !hasOptions || !hasMedia);

    if (!hasOptions || !hasMedia) {
      container.innerHTML = '<p class="col-span-full text-sm text-gray-400 text-center">Add options and media to enable mapping</p>';
      return;
    }

    // Get all option values for checkboxes
    const allValues = [];
    newProductPending.options.forEach(opt => {
      if (opt.name && opt.values.length > 0) {
        opt.values.forEach(val => {
          allValues.push({ option: opt.name, value: val, label: `${opt.name}: ${val}` });
        });
      }
    });

    if (allValues.length === 0) {
      container.innerHTML = '<p class="col-span-full text-sm text-gray-400 text-center">Add option values to tag images</p>';
      return;
    }

    container.innerHTML = media.map((m, idx) => {
      const currentTags = newProductPending.mediaTags[idx] || [];
      const isVideo = m.file?.type?.startsWith('video/') || m.name?.match(/\.(mp4|mov|webm|avi)$/i);

      let mediaHtml;
      if (isVideo) {
        mediaHtml = `
          <div class="w-full aspect-square bg-gray-900 relative">
            <video src="${m.preview}" class="w-full h-full object-cover" muted preload="metadata"></video>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </span>
            </div>
          </div>
        `;
      } else {
        mediaHtml = `<img src="${m.preview}" alt="" class="w-full aspect-square object-cover">`;
      }

      return `
        <div class="relative group bg-white rounded-lg border border-gray-200 overflow-hidden">
          ${mediaHtml}
          <div class="p-2 bg-gray-50 border-t border-gray-200">
            <p class="text-xs text-gray-500 mb-2">Tag with options:</p>
            <div class="space-y-1 max-h-24 overflow-y-auto">
              ${allValues.map(v => `
                <label class="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
                  <input type="checkbox" class="new-media-tag-checkbox rounded border-gray-300 text-red-600 focus:ring-red-500" 
                         data-media-idx="${idx}" data-value="${v.value}" 
                         ${currentTags.includes(v.value) ? 'checked' : ''}>
                  <span class="truncate">${v.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind checkbox change events
    container.querySelectorAll('.new-media-tag-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const mediaIdx = parseInt(e.target.dataset.mediaIdx);
        const value = e.target.dataset.value;

        if (!newProductPending.mediaTags[mediaIdx]) {
          newProductPending.mediaTags[mediaIdx] = [];
        }

        if (e.target.checked) {
          if (!newProductPending.mediaTags[mediaIdx].includes(value)) {
            newProductPending.mediaTags[mediaIdx].push(value);
          }
        } else {
          newProductPending.mediaTags[mediaIdx] = newProductPending.mediaTags[mediaIdx].filter(v => v !== value);
        }
      });
    });
  }

  $('btn-new-product').addEventListener('click', showNewProduct);
  $('btn-new-product-2').addEventListener('click', showNewProduct);
  $('btn-cancel-create').addEventListener('click', () => {
    // Clean up pending media previews
    newProductPending.media.forEach(m => URL.revokeObjectURL(m.preview));
    newProductPending.media = [];
    newProductPending.fitments.clear();
    newProductPending.options = [];
    newProductPending.variants = [];
    newProductPending.mediaTags = {};
    $('new-product-form').classList.add('hidden');
    $('product-empty').classList.remove('hidden');
  });

  $('btn-create-product').addEventListener('click', async () => {
    const title = $('new-title').value.trim();
    if (!title) { toast('Title is required', 'error'); return; }

    const price = $('new-price').value;
    if (!price || parseFloat(price) <= 0) { toast('Valid price is required', 'error'); return; }

    const btn = $('btn-create-product');
    const spinner = $('create-spinner');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      // Step 1: Create the product
      toast('Creating product...', 'info');
      const createResult = await api.post('/products/create', {
        title,
        description: $('new-description').value,
        vendor: $('new-vendor').value,
        productType: $('new-type').value,
        tags: $('new-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        status: $('new-status').value,
        price: price,
        compareAtPrice: $('new-compare-price').value || null,
        b2bPrice: $('new-b2b-price').value || null,
        discountPrice: $('new-discount-price').value || null,
        sku: $('new-sku').value,
        inventory: parseInt($('new-inventory').value) || 0,
        trackInventory: $('new-track-inventory').checked,
        requiresShipping: $('new-requires-shipping').checked,
        weight: parseFloat($('new-weight').value) || 0,
        weightUnit: $('new-weight-unit').value
      });

      const newProductId = createResult.data?.id?.split('/').pop() || createResult.productId;
      if (!newProductId) throw new Error('Failed to get new product ID');

      // Step 2: Upload pending media
      if (newProductPending.media.length > 0) {
        toast(`Uploading ${newProductPending.media.length} media file(s)...`, 'info');
        for (const item of newProductPending.media) {
          try {
            // Get staged upload URL
            const stagedRes = await api.post('/media/staged-upload', {
              filename: item.file.name,
              mimeType: item.file.type || 'application/octet-stream',
              fileSize: item.file.size
            });

            if (stagedRes.success && stagedRes.data) {
              const { uploadUrl, resourceUrl, parameters } = stagedRes.data;

              // Upload to Shopify storage
              const formData = new FormData();
              parameters.forEach(p => formData.append(p.name, p.value));
              formData.append('file', item.file);
              await fetch(uploadUrl, { method: 'POST', body: formData });

              // Attach to product
              const mediaType = item.file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
              await api.post(`/products/${newProductId}/media`, {
                resourceUrl: resourceUrl,
                mediaContentType: mediaType,
                alt: ''
              });
            }
          } catch (mediaErr) {
            console.error('Media upload error:', mediaErr);
          }
        }
      }

      // Step 3: Add pending fitments
      if (newProductPending.fitments.size > 0) {
        toast(`Adding ${newProductPending.fitments.size} fitment(s)...`, 'info');
        try {
          await api.post('/products/update-fitment', {
            product_id: newProductId,
            vehicle_ids: [...newProductPending.fitments]
          });
        } catch (fitErr) {
          console.error('Fitment error:', fitErr);
        }
      }

      // Step 4: Create variants if options defined (non-addon options only)
      const variantOptions = newProductPending.options.filter(o => o.name && o.values.length > 0 && !o.isAddOn);
      console.log('[CreateProduct] Variant options:', variantOptions);
      console.log('[CreateProduct] Pending variants:', newProductPending.variants);

      if (variantOptions.length > 0 && newProductPending.variants.length > 0) {
        toast(`Creating ${newProductPending.variants.length} variant(s)...`, 'info');
        try {
          // Get variant data from the table inputs
          const variantData = newProductPending.variants.map((combo, idx) => {
            const priceInput = document.querySelector(`.new-variant-price[data-idx="${idx}"]`);
            const b2bPriceInput = document.querySelector(`.new-variant-b2b-price[data-idx="${idx}"]`);
            const skuInput = document.querySelector(`.new-variant-sku[data-idx="${idx}"]`);
            const invInput = document.querySelector(`.new-variant-inventory[data-idx="${idx}"]`);
            const b2bValue = b2bPriceInput?.value ? parseFloat(b2bPriceInput.value) : null;
            return {
              options: combo.map(c => c.value),
              price: parseFloat(priceInput?.value) || parseFloat(price),
              b2bPrice: b2bValue,
              sku: skuInput?.value || '',
              inventory: parseInt(invInput?.value) || 0
            };
          });

          const variantPayload = {
            options: variantOptions.map(o => ({ name: o.name, values: o.values })),
            variants: variantData
          };
          console.log('[CreateProduct] Sending variant payload:', variantPayload);

          const variantResult = await api.post(`/products/${newProductId}/variants`, variantPayload);
          console.log('[CreateProduct] Variant creation result:', variantResult);
        } catch (varErr) {
          console.error('Variant creation error:', varErr);
          toast('Warning: Some variants may not have been created - ' + varErr.message, 'warning');
        }
      } else {
        console.log('[CreateProduct] Skipping variant creation - no valid options or variants');
      }

      // Step 5: Save add-on options if any
      const addOnOptions = newProductPending.options.filter(o => o.name && o.values.length > 0 && o.isAddOn);
      if (addOnOptions.length > 0) {
        toast('Saving add-on options...', 'info');
        try {
          const addOnData = addOnOptions.map(o => ({
            name: o.name,
            values: o.values,
            priceModifiers: o.priceModifiers || {}
          }));
          await api.put(`/products/${newProductId}/addons`, { addOnOptions: addOnData });
        } catch (addOnErr) {
          console.error('Add-on options error:', addOnErr);
        }
      }

      // Step 6: Update media alt text for option mapping (after media is uploaded)
      if (newProductPending.media.length > 0 && Object.keys(newProductPending.mediaTags).length > 0) {
        toast('Applying media tags...', 'info');
        // Wait a bit for media to be processed
        await new Promise(r => setTimeout(r, 2000));
        try {
          // Fetch the product to get media IDs
          const productData = await api.get(`/products/${newProductId}`);
          const uploadedMedia = productData.media || [];

          for (const [idx, tags] of Object.entries(newProductPending.mediaTags)) {
            const mediaIdx = parseInt(idx);
            if (uploadedMedia[mediaIdx] && tags.length > 0) {
              const mediaId = uploadedMedia[mediaIdx].id;
              const altText = tags.join(', ');
              try {
                await api.put(`/products/${newProductId}/media/${encodeURIComponent(mediaId)}/alt`, { alt: altText });
              } catch (altErr) {
                console.error('Media alt update error:', altErr);
              }
            }
          }
        } catch (mediaTagErr) {
          console.error('Media tagging error:', mediaTagErr);
        }
      }

      // Clean up
      const hadMedia = newProductPending.media.length > 0;
      newProductPending.media.forEach(m => URL.revokeObjectURL(m.preview));
      newProductPending.media = [];
      newProductPending.fitments.clear();
      newProductPending.options = [];
      newProductPending.variants = [];
      newProductPending.mediaTags = {};

      toast('Product created successfully!', 'success');
      $('new-product-form').classList.add('hidden');
      $('product-empty').classList.remove('hidden');

      // Wait for Shopify to process media before reloading (if media was uploaded)
      if (hadMedia) {
        toast('Processing media...', 'info');
        await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds for Shopify
      }

      // Reload and select new product
      await loadProducts();
      setTimeout(() => selectProduct(newProductId), 500);

    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  // ==========================================
  // VEHICLES
  // ==========================================
  async function loadVehicles() {
    try {
      S.vehicles = await api.get('/vehicles');
      renderVehicleTable();
      populateVehicleSelects();
      populateVehicleFilters();
      populateProductYmmDropdowns(); // Populate product sidebar YMM filter
    } catch (e) {
      if (e.message === 'Unauthorized') showAuth();
    }
  }

  function populateVehicleFilters() {
    const years = [...new Set(S.vehicles.map(v => v.year))].sort((a, b) => b - a);
    const makes = [...new Set(S.vehicles.map(v => v.make))].sort();
    const models = [...new Set(S.vehicles.map(v => v.model))].sort();

    $('vf-year').innerHTML = `<option value="">All Years</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}`;
    $('vf-make').innerHTML = `<option value="">All Makes</option>${makes.map(m => `<option value="${m}">${m}</option>`).join('')}`;
    $('vf-model').innerHTML = `<option value="">All Models</option>${models.map(m => `<option value="${m}">${m}</option>`).join('')}`;
  }

  function getFilteredVehicles() {
    return S.vehicles.filter(v => {
      if (S.vFilters.year && v.year != S.vFilters.year) return false;
      if (S.vFilters.make && v.make !== S.vFilters.make) return false;
      if (S.vFilters.model && v.model !== S.vFilters.model) return false;
      return true;
    });
  }

  let editingVehicleId = null;

  function renderVehicleTable() {
    const filtered = getFilteredVehicles();
    const tbody = $('vehicle-table');
    $('vehicle-count').textContent = `${filtered.length} of ${S.vehicles.length} vehicles`;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No vehicles found</td></tr>';
      return;
    }

    // Sort by year desc, then make, then model
    filtered.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (a.make !== b.make) return a.make.localeCompare(b.make);
      return a.model.localeCompare(b.model);
    });

    tbody.innerHTML = filtered.map(v => {
      const isEditing = editingVehicleId === v.id;
      return `
        <tr class="hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}" data-vehicle-id="${v.id}">
          <td class="px-4 py-2.5">${v.year}</td>
          <td class="px-4 py-2.5">${v.make}</td>
          <td class="px-4 py-2.5">${v.model}</td>
          <td class="px-4 py-2.5 text-gray-500">${v.submodel || '-'}</td>
          <td class="px-4 py-2.5">
            <button class="edit-vehicle text-xs ${isEditing ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'} mr-2" data-id="${v.id}" ${isEditing ? 'disabled' : ''}>
              ${isEditing ? 'Editing...' : 'Edit'}
            </button>
            <button class="del-vehicle text-xs text-red-600 hover:text-red-800" data-id="${v.id}">Delete</button>
          </td>
        </tr>
        ${isEditing ? `
        <tr class="vehicle-edit-row bg-gray-50">
          <td colspan="5" class="p-4">
            <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-gray-900">Edit Vehicle</h4>
                <button class="cancel-edit text-xs text-gray-500 hover:text-gray-700" data-id="${v.id}">&#10005; Cancel</button>
              </div>
              <div class="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">Year</label>
                  <input type="number" class="ve-year w-full h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" value="${v.year}" data-id="${v.id}">
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">Make</label>
                  <input type="text" class="ve-make w-full h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" value="${v.make}" data-id="${v.id}">
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">Model</label>
                  <input type="text" class="ve-model w-full h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" value="${v.model}" data-id="${v.id}">
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">Submodel</label>
                  <input type="text" class="ve-submodel w-full h-9 px-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" value="${v.submodel || ''}" data-id="${v.id}" placeholder="Optional">
                </div>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-400">Full name will be auto-generated</p>
                <div class="flex gap-2">
                  <button class="cancel-edit h-8 px-3 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50" data-id="${v.id}">Cancel</button>
                  <button class="save-vehicle h-8 px-4 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium" data-id="${v.id}">Save Changes</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
        ` : ''}
      `;
    }).join('');

    // Bind edit buttons
    tbody.querySelectorAll('.edit-vehicle').forEach(btn => {
      btn.addEventListener('click', () => {
        editingVehicleId = btn.dataset.id;
        renderVehicleTable();
      });
    });

    // Bind cancel buttons
    tbody.querySelectorAll('.cancel-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        editingVehicleId = null;
        renderVehicleTable();
      });
    });

    // Bind save buttons
    tbody.querySelectorAll('.save-vehicle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const row = tbody.querySelector(`tr[data-vehicle-id="${id}"]`);
        const editRow = row.nextElementSibling;

        const year = editRow.querySelector('.ve-year').value;
        const make = editRow.querySelector('.ve-make').value;
        const model = editRow.querySelector('.ve-model').value;
        const submodel = editRow.querySelector('.ve-submodel').value;

        if (!year || !make || !model) {
          toast('Year, Make, and Model are required', 'error');
          return;
        }

        const fullName = [year, make, model, submodel].filter(Boolean).join(' ');

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          await api.put(`/vehicles/${id.split('/').pop()}`, {
            year: parseInt(year),
            make,
            model,
            submodel: submodel || '',
            full_name: fullName
          });
          toast('Vehicle updated', 'success');
          editingVehicleId = null;
          loadVehicles();
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save Changes';
        }
      });
    });

    // Bind delete buttons
    tbody.querySelectorAll('.del-vehicle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirmModal('Delete this vehicle?', 'Delete Vehicle');
        if (!confirmed) return;
        try {
          await api.del(`/vehicles/${btn.dataset.id.split('/').pop()}`);
          toast('Vehicle deleted', 'success');
          loadVehicles();
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  // Vehicle filter handlers
  ['vf-year', 'vf-make', 'vf-model'].forEach(id => {
    $(id).addEventListener('change', (e) => {
      const field = id.replace('vf-', '');
      S.vFilters[field] = e.target.value;
      editingVehicleId = null; // Close any open edit form
      renderVehicleTable();
    });
  });

  $('btn-clear-vfilters').addEventListener('click', () => {
    S.vFilters = { year: '', make: '', model: '' };
    $('vf-year').value = '';
    $('vf-make').value = '';
    $('vf-model').value = '';
    editingVehicleId = null;
    renderVehicleTable();
  });

  // Track which fields are in "new" mode (to prevent dropdown rebuild)
  const newMode = { year: false, make: false, model: false, submodel: false };

  function populateVehicleSelects() {
    const years = [...new Set(S.vehicles.map(v => v.year))].sort((a, b) => b - a);
    $('v-year').innerHTML = `<option value="">Select</option><option value="__new">+ New Year</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}`;
  }

  function updateVehicleSelects() {
    const { year, make, model, submodel } = S.create;

    // Get input values if in new mode
    const yearVal = newMode.year ? $('v-year-input').value : year;
    const makeVal = newMode.make ? $('v-make-input').value : make;
    const modelVal = newMode.model ? $('v-model-input').value : model;
    const submodelVal = newMode.submodel ? $('v-submodel-input').value : submodel;

    // All makes available for any year
    const makes = [...new Set(S.vehicles.map(v => v.make))].sort();
    const makeEl = $('v-make');
    const yearHasValue = yearVal && yearVal.length > 0;
    makeEl.disabled = !yearHasValue;

    // Only rebuild make dropdown if not in "new make" mode
    if (!newMode.make) {
      makeEl.innerHTML = yearHasValue
        ? `<option value="">Select</option><option value="__new">+ New Make</option>${makes.map(m => `<option value="${m}">${m}</option>`).join('')}`
        : '<option value="">Select Year first</option>';
      if (make) makeEl.value = make;
    }

    // Models filtered by make
    const models = [...new Set(S.vehicles.filter(v => v.make === makeVal).map(v => v.model))].sort();
    const modelEl = $('v-model');
    const makeHasValue = makeVal && makeVal.length > 0;
    modelEl.disabled = !makeHasValue;

    // Only rebuild model dropdown if not in "new model" mode
    if (!newMode.model) {
      modelEl.innerHTML = makeHasValue
        ? `<option value="">Select</option><option value="__new">+ New Model</option>${models.map(m => `<option value="${m}">${m}</option>`).join('')}`
        : '<option value="">Select Make first</option>';
      if (model) modelEl.value = model;
    }

    // Submodels filtered by make+model
    const subs = [...new Set(S.vehicles.filter(v => v.make === makeVal && v.model === modelVal).map(v => v.submodel).filter(Boolean))].sort();
    const subEl = $('v-submodel');
    const modelHasValue = modelVal && modelVal.length > 0;
    subEl.disabled = !modelHasValue;

    // Only rebuild submodel dropdown if not in "new submodel" mode
    if (!newMode.submodel) {
      subEl.innerHTML = modelHasValue
        ? `<option value="">None</option><option value="__new">+ New Submodel</option>${subs.map(s => `<option value="${s}">${s}</option>`).join('')}`
        : '<option value="">Select Model first</option>';
      if (submodel) subEl.value = submodel;
    }

    // Preview
    const parts = [yearVal, makeVal, modelVal, submodelVal].filter(Boolean);
    $('vehicle-preview').textContent = parts.length ? parts.join(' ') : 'Select options below...';

    // Enable create button
    $('btn-create-vehicle').disabled = !(yearVal && makeVal && modelVal);
  }

  ['year', 'make', 'model', 'submodel'].forEach(f => {
    const sel = $(`v-${f}`);
    const inp = $(`v-${f}-input`);

    sel.addEventListener('change', (e) => {
      if (e.target.value === '__new') {
        newMode[f] = true;
        inp.classList.remove('hidden');
        inp.focus();
        S.create[f] = '';
      } else {
        newMode[f] = false;
        inp.classList.add('hidden');
        inp.value = '';
        S.create[f] = e.target.value;
      }
      // Reset downstream
      const order = ['year', 'make', 'model', 'submodel'];
      const idx = order.indexOf(f);
      for (let i = idx + 1; i < order.length; i++) {
        S.create[order[i]] = '';
        newMode[order[i]] = false;
        $(`v-${order[i]}`).value = '';
        $(`v-${order[i]}-input`).classList.add('hidden');
        $(`v-${order[i]}-input`).value = '';
      }
      updateVehicleSelects();
    });

    inp.addEventListener('input', (e) => {
      S.create[f] = e.target.value;
      updateVehicleSelects();
    });
  });

  $('btn-reset-vehicle').addEventListener('click', () => {
    S.create = { year: '', make: '', model: '', submodel: '' };
    ['year', 'make', 'model', 'submodel'].forEach(f => {
      newMode[f] = false;
      $(`v-${f}`).value = '';
      $(`v-${f}-input`).classList.add('hidden');
      $(`v-${f}-input`).value = '';
    });
    populateVehicleSelects();
    updateVehicleSelects();
  });

  $('btn-create-vehicle').addEventListener('click', async () => {
    const { year, make, model, submodel } = S.create;
    if (!year || !make || !model) return;

    const fullName = [year, make, model, submodel].filter(Boolean).join(' ');
    try {
      await api.post('/vehicles/create', { year: parseInt(year), make, model, submodel: submodel || '', full_name: fullName });
      toast(`Created: ${fullName}`, 'success');
      S.create = { year: '', make: '', model: '', submodel: '' };
      $('btn-reset-vehicle').click();
      loadVehicles();
    } catch (e) { toast(e.message, 'error'); }
  });

  // ==========================================
  // VEHICLE MODAL (Mobile)
  // ==========================================
  const vehicleModalOverlay = $('vehicle-modal-overlay');
  const modalCreate = { year: '', make: '', model: '', submodel: '' };
  const modalNewMode = { year: false, make: false, model: false, submodel: false };

  function openVehicleModal() {
    vehicleModalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    populateModalSelects();
  }

  function closeVehicleModal() {
    vehicleModalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function populateModalSelects() {
    const yearEl = $('vm-year');
    yearEl.innerHTML = '<option value="">Select</option><option value="__new">+ New Year</option>' +
      [...new Set(S.vehicles.map(v => v.year))].sort((a, b) => b - a).map(y => `<option value="${y}">${y}</option>`).join('');
    updateModalSelects();
  }

  function updateModalSelects() {
    const { year, make, model, submodel } = modalCreate;
    const yearVal = modalNewMode.year ? modalCreate.year : year;
    const makeVal = modalNewMode.make ? modalCreate.make : make;
    const modelVal = modalNewMode.model ? modalCreate.model : model;
    const submodelVal = modalNewMode.submodel ? modalCreate.submodel : submodel;

    // Make dropdown
    const makeEl = $('vm-make');
    if (yearVal) {
      makeEl.disabled = false;
      const makes = [...new Set(S.vehicles.filter(v => String(v.year) === String(yearVal)).map(v => v.make))].sort();
      makeEl.innerHTML = '<option value="">Select</option><option value="__new">+ New Make</option>' + makes.map(m => `<option value="${m}">${m}</option>`).join('');
      if (make) makeEl.value = make;
    } else {
      makeEl.disabled = true;
      makeEl.innerHTML = '<option value="">Select Year first</option>';
    }

    // Model dropdown
    const modelEl = $('vm-model');
    if (yearVal && makeVal) {
      modelEl.disabled = false;
      const models = [...new Set(S.vehicles.filter(v => String(v.year) === String(yearVal) && v.make === makeVal).map(v => v.model))].sort();
      modelEl.innerHTML = '<option value="">Select</option><option value="__new">+ New Model</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
      if (model) modelEl.value = model;
    } else {
      modelEl.disabled = true;
      modelEl.innerHTML = '<option value="">Select Make first</option>';
    }

    // Submodel dropdown
    const subEl = $('vm-submodel');
    if (yearVal && makeVal && modelVal) {
      subEl.disabled = false;
      const subs = [...new Set(S.vehicles.filter(v => String(v.year) === String(yearVal) && v.make === makeVal && v.model === modelVal && v.submodel).map(v => v.submodel))].sort();
      subEl.innerHTML = subs.length
        ? `<option value="">None</option><option value="__new">+ New Submodel</option>${subs.map(s => `<option value="${s}">${s}</option>`).join('')}`
        : '<option value="">None</option><option value="__new">+ New Submodel</option>';
      if (submodel) subEl.value = submodel;
    } else {
      subEl.disabled = true;
      subEl.innerHTML = '<option value="">Select Model first</option>';
    }

    // Preview
    const parts = [yearVal, makeVal, modelVal, submodelVal].filter(Boolean);
    $('vehicle-preview-modal').textContent = parts.length ? parts.join(' ') : 'Select options below...';

    // Enable create button
    $('btn-create-vehicle-modal').disabled = !(yearVal && makeVal && modelVal);
  }

  // Modal event listeners
  if ($('btn-create-vehicle-mobile')) {
    $('btn-create-vehicle-mobile').addEventListener('click', openVehicleModal);
  }
  if ($('btn-close-vehicle-modal')) {
    $('btn-close-vehicle-modal').addEventListener('click', closeVehicleModal);
  }
  if (vehicleModalOverlay) {
    vehicleModalOverlay.addEventListener('click', (e) => {
      if (e.target === vehicleModalOverlay) closeVehicleModal();
    });
  }

  ['year', 'make', 'model', 'submodel'].forEach(f => {
    const sel = $(`vm-${f}`);
    const inp = $(`vm-${f}-input`);
    if (!sel || !inp) return;

    sel.addEventListener('change', (e) => {
      if (e.target.value === '__new') {
        modalNewMode[f] = true;
        inp.classList.remove('hidden');
        inp.focus();
        modalCreate[f] = '';
      } else {
        modalNewMode[f] = false;
        inp.classList.add('hidden');
        inp.value = '';
        modalCreate[f] = e.target.value;
      }
      // Reset downstream
      const order = ['year', 'make', 'model', 'submodel'];
      const idx = order.indexOf(f);
      for (let i = idx + 1; i < order.length; i++) {
        modalCreate[order[i]] = '';
        modalNewMode[order[i]] = false;
        $(`vm-${order[i]}`).value = '';
        $(`vm-${order[i]}-input`).classList.add('hidden');
        $(`vm-${order[i]}-input`).value = '';
      }
      updateModalSelects();
    });

    inp.addEventListener('input', (e) => {
      modalCreate[f] = e.target.value;
      updateModalSelects();
    });
  });

  if ($('btn-reset-vehicle-modal')) {
    $('btn-reset-vehicle-modal').addEventListener('click', () => {
      Object.keys(modalCreate).forEach(k => modalCreate[k] = '');
      Object.keys(modalNewMode).forEach(k => modalNewMode[k] = false);
      ['year', 'make', 'model', 'submodel'].forEach(f => {
        $(`vm-${f}`).value = '';
        $(`vm-${f}-input`).classList.add('hidden');
        $(`vm-${f}-input`).value = '';
      });
      populateModalSelects();
    });
  }

  if ($('btn-create-vehicle-modal')) {
    $('btn-create-vehicle-modal').addEventListener('click', async () => {
      const year = modalNewMode.year ? modalCreate.year : modalCreate.year;
      const make = modalNewMode.make ? modalCreate.make : modalCreate.make;
      const model = modalNewMode.model ? modalCreate.model : modalCreate.model;
      const submodel = modalNewMode.submodel ? modalCreate.submodel : modalCreate.submodel;

      if (!year || !make || !model) return;

      const fullName = [year, make, model, submodel].filter(Boolean).join(' ');
      try {
        await api.post('/vehicles/create', { year: parseInt(year), make, model, submodel: submodel || '', full_name: fullName });
        toast(`Created: ${fullName}`, 'success');
        closeVehicleModal();
        $('btn-reset-vehicle-modal').click();
        loadVehicles();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  // ==========================================
  // CUSTOMERS
  // ==========================================
  let customerSearchTimeout;

  async function loadCustomers(query = '') {
    try {
      S.customers = await api.get(`/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      renderCustomerList();
    } catch (e) {
      if (e.message === 'Unauthorized') showAuth();
      else toast(e.message, 'error');
    }
  }

  function renderCustomerList() {
    const c = $('customer-list');
    const tagFilter = $('cf-tag').value;

    let filtered = S.customers;
    if (tagFilter) {
      filtered = S.customers.filter(cust => cust.tags && cust.tags.includes(tagFilter));
    }

    $('customer-count').textContent = `${filtered.length} customers`;

    if (!filtered.length) {
      c.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">No customers found</div>';
      return;
    }

    c.innerHTML = filtered.map(cust => `
      <div class="customer-item p-3 cursor-pointer hover:bg-gray-50 ${S.selectedCustomer?.id === cust.id ? 'bg-red-50' : ''}" data-id="${cust.id}">
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

    c.querySelectorAll('.customer-item').forEach(el => {
      el.addEventListener('click', () => selectCustomer(el.dataset.id));
    });
  }

  async function selectCustomer(id) {
    try {
      const cust = await api.get(`/customers/${id.split('/').pop()}`);
      S.selectedCustomer = cust;
      renderCustomerList();
      showCustomerEditor(cust);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function showCustomerEditor(c) {
    $('customer-empty').classList.add('hidden');
    $('customer-editor').classList.remove('hidden');

    // Header info
    $('cust-name').textContent = c.displayName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown';
    $('cust-email').textContent = c.email;
    $('cust-state').textContent = c.state || 'ENABLED';
    $('cust-state').className = `px-2 py-1 text-xs font-medium rounded ${c.state === 'DISABLED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;

    // Tags
    renderCustomerTags(c.tags || []);

    // Form fields
    $('cust-firstname').value = c.firstName || '';
    $('cust-lastname').value = c.lastName || '';
    $('cust-email-edit').value = c.email || '';
    $('cust-phone').value = c.phone || '';
    $('cust-note').value = c.note || '';

    // Address
    const addr = c.defaultAddress;
    if (addr) {
      $('cust-address').innerHTML = `
        <p>${addr.address1 || ''}</p>
        ${addr.address2 ? `<p>${addr.address2}</p>` : ''}
        <p>${addr.city || ''}, ${addr.province || ''} ${addr.zip || ''}</p>
        <p>${addr.country || ''}</p>
        ${addr.phone ? `<p class="mt-2 text-gray-500">${addr.phone}</p>` : ''}
      `;
    } else {
      $('cust-address').innerHTML = '<p class="text-gray-400">No address on file</p>';
    }

    // Stats - Total Orders = all orders, Total Spent = only non-refunded
    // Always use recentOrders length for order count (includes all orders)
    const ordersCount = c.recentOrders?.length || c.ordersCount || 0;
    // For total spent: use Shopify's amountSpent (excludes refunded), 
    // or calculate from non-refunded orders in recentOrders
    const totalSpent = parseFloat(c.totalSpent || 0) ||
      (c.recentOrders?.filter(o => o.financial !== 'REFUNDED')
        .reduce((sum, o) => sum + parseFloat(o.total || 0), 0) || 0);

    $('cust-orders').textContent = ordersCount;
    $('cust-spent').textContent = `$${totalSpent.toFixed(2)}`;
    $('cust-since').textContent = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-';

    // Recent orders
    // Recent orders
    const ordersEl = $('cust-recent-orders');
    if (c.recentOrders && c.recentOrders.length > 0) {
      ordersEl.innerHTML = c.recentOrders.map(o => `
      <div class="recent-order-item flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors" data-order="${o.name}">
        <div>
          <span class="text-sm font-medium text-gray-900">${o.name}</span>
          <span class="text-xs text-gray-500 ml-2">${new Date(o.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="text-right">
          <span class="text-sm text-gray-900">$${parseFloat(o.total || 0).toFixed(2)}</span>
          <span class="text-xs ml-2 ${o.financial === 'PAID' ? 'text-green-600' : 'text-yellow-600'}">${o.financial}</span>
        </div>
      </div>
    `).join('');

      // Add click listeners to navigate to order
      ordersEl.querySelectorAll('.recent-order-item').forEach(el => {
        el.addEventListener('click', () => {
          const orderName = el.dataset.order;
          if (typeof orderMgmt !== 'undefined' && orderMgmt) {
            switchToTab('orders');
            // Pass clean order number (strip #) as selectOrderByNumber adds it back
            orderMgmt.selectOrderByNumber(orderName.replace('#', ''));
          } else {
            toast('Order management not loaded', 'error');
          }
        });
      });
    } else {
      ordersEl.innerHTML = '<p class="text-sm text-gray-400">No orders yet</p>';
    }
  }

  function renderCustomerTags(tags) {
    const container = $('cust-tags');
    container.innerHTML = tags.map(tag => `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${tag === 'admin' ? 'bg-purple-100 text-purple-700' :
        tag === 'b2b' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
      }">
        ${tag}
        <button class="remove-tag hover:text-red-500 flex items-center justify-center p-0.5" data-tag="${tag}">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </span>
    `).join('');

    if (!tags.length) {
      container.innerHTML = '<span class="text-xs text-gray-400">No tags</span>';
    }

    container.querySelectorAll('.remove-tag').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirmModal(`Remove tag "${btn.dataset.tag}"?`, 'Remove Tag');
        if (!confirmed) return;
        try {
          const custId = S.selectedCustomer.id.split('/').pop();
          await api.del(`/customers/${custId}/tags`, { tags: [btn.dataset.tag] });
          toast('Tag removed', 'success');
          selectCustomer(S.selectedCustomer.id);
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  // Customer search
  $('customer-search').addEventListener('input', (e) => {
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
      loadCustomers(e.target.value);
    }, 300);
  });

  // Customer tag filter
  $('cf-tag').addEventListener('change', () => {
    renderCustomerList();
  });

  // Add tag dropdown
  $('btn-add-tag').addEventListener('click', (e) => {
    e.stopPropagation();
    $('tag-dropdown').classList.toggle('hidden');
  });

  document.querySelectorAll('.tag-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      $('tag-dropdown').classList.add('hidden');
      if (!S.selectedCustomer) return;
      try {
        const custId = S.selectedCustomer.id.split('/').pop();
        await api.post(`/customers/${custId}/tags`, { tags: [btn.dataset.tag] });
        toast('Tag added', 'success');
        selectCustomer(S.selectedCustomer.id);
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', () => {
    $('tag-dropdown').classList.add('hidden');
  });

  // Save customer
  $('btn-save-customer').addEventListener('click', async () => {
    if (!S.selectedCustomer) return;
    try {
      const custId = S.selectedCustomer.id.split('/').pop();
      await api.put(`/customers/${custId}`, {
        firstName: $('cust-firstname').value,
        lastName: $('cust-lastname').value,
        email: $('cust-email-edit').value,
        phone: $('cust-phone').value,
        note: $('cust-note').value
      });
      toast('Customer updated', 'success');
      loadCustomers();
      selectCustomer(S.selectedCustomer.id);
    } catch (e) { toast(e.message, 'error'); }
  });

  // ==========================================
  // SHIPPING MANAGEMENT
  // ==========================================
  const shippingState = {
    packages: { custom: [], carrier: [] },
    defaultPackageId: null
  };

  // Load packages from API
  async function loadPackages() {
    try {
      const result = await api.get('/shipping/packages');
      shippingState.packages.custom = result.customPackages || [];
      shippingState.packages.carrier = result.carrierPackages || [];
      shippingState.defaultPackageId = result.defaultPackageId;
      populatePackageDropdowns();
      renderPackageLists();
    } catch (e) {
      console.error('Failed to load packages:', e);
    }
  }

  // Populate package dropdowns in product editor
  function populatePackageDropdowns() {
    const allPackages = [...shippingState.packages.custom, ...shippingState.packages.carrier];
    const defaultId = shippingState.defaultPackageId;

    const options = allPackages.map(p => {
      const isDefault = p.id === defaultId;
      const dims = `${p.length} x ${p.width} x ${p.height} ${p.sizeUnit}`;
      return `<option value="${p.id}" ${isDefault ? 'data-default="true"' : ''}>${p.name}${isDefault ? ' (Default)' : ''} - ${dims}</option>`;
    }).join('');

    const editPkg = $('edit-package');
    if (editPkg) {
      editPkg.innerHTML = `<option value="">Select a package...</option>${options}`;
    }
  }

  // Render package lists in modal
  function renderPackageLists() {
    // Custom packages
    const customList = $('custom-packages-list');
    if (customList) {
      if (shippingState.packages.custom.length === 0) {
        customList.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">No custom packages</p>';
      } else {
        customList.innerHTML = shippingState.packages.custom.map(p => {
          const isDefault = p.id === shippingState.defaultPackageId;
          const typeLabel = p.type === 'soft_package' ? 'Soft Package' : p.type.charAt(0).toUpperCase() + p.type.slice(1);
          return `
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-900">${p.name}</span>
                  ${isDefault ? '<span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Default</span>' : ''}
                </div>
                <p class="text-xs text-gray-500">${typeLabel} Â· ${p.length} x ${p.width} x ${p.height} ${p.sizeUnit}</p>
              </div>
              <div class="flex items-center gap-1">
                ${!isDefault ? `<button class="set-default-pkg text-xs text-blue-600 hover:text-blue-800 px-2 py-1" data-id="${p.id}">Set Default</button>` : ''}
                <button class="delete-pkg text-xs text-red-600 hover:text-red-800 px-2 py-1" data-id="${p.id}">Delete</button>
              </div>
            </div>
          `;
        }).join('');

        // Bind events
        customList.querySelectorAll('.set-default-pkg').forEach(btn => {
          btn.addEventListener('click', () => setDefaultPackage(btn.dataset.id));
        });
        customList.querySelectorAll('.delete-pkg').forEach(btn => {
          btn.addEventListener('click', () => deletePackage(btn.dataset.id));
        });
      }
    }

    // Carrier packages
    const carrierList = $('carrier-packages-list');
    if (carrierList) {
      if (shippingState.packages.carrier.length === 0) {
        carrierList.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">No carrier packages available</p>';
      } else {
        // Group by carrier
        const byCarrier = {};
        shippingState.packages.carrier.forEach(p => {
          if (!byCarrier[p.carrier]) byCarrier[p.carrier] = [];
          byCarrier[p.carrier].push(p);
        });

        carrierList.innerHTML = Object.entries(byCarrier).map(([carrier, packages]) => `
          <div class="mb-3">
            <h4 class="text-xs font-semibold text-gray-700 mb-2">${carrier}</h4>
            <div class="space-y-1">
              ${packages.map(p => {
          const isDefault = p.id === shippingState.defaultPackageId;
          return `
                  <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span class="text-sm text-gray-900">${p.name}</span>
                      ${isDefault ? '<span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-2">Default</span>' : ''}
                      <p class="text-xs text-gray-500">${p.length} x ${p.width} x ${p.height} ${p.sizeUnit}</p>
                    </div>
                    ${!isDefault ? `<button class="set-default-carrier-pkg text-xs text-blue-600 hover:text-blue-800" data-id="${p.id}">Set Default</button>` : ''}
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        `).join('');

        carrierList.querySelectorAll('.set-default-carrier-pkg').forEach(btn => {
          btn.addEventListener('click', () => setDefaultPackage(btn.dataset.id));
        });
      }
    }
  }

  // Create custom package
  async function createPackage() {
    const name = $('pkg-name').value.trim();
    const type = $('pkg-type').value;
    const length = $('pkg-length').value;
    const width = $('pkg-width').value;
    const height = $('pkg-height').value;
    const sizeUnit = $('pkg-size-unit').value;
    const weight = $('pkg-weight').value || 0;
    const weightUnit = $('pkg-weight-unit').value;
    const setAsDefault = $('pkg-default').checked;

    if (!name) { toast('Package name is required', 'error'); return; }
    if (!length || !width || !height) { toast('Dimensions are required', 'error'); return; }

    try {
      await api.post('/shipping/packages', {
        name, type, length, width, height, sizeUnit, weight, weightUnit, setAsDefault
      });
      toast('Package created', 'success');

      // Reset form
      $('pkg-name').value = '';
      $('pkg-length').value = '';
      $('pkg-width').value = '';
      $('pkg-height').value = '';
      $('pkg-weight').value = '';
      $('pkg-default').checked = false;

      await loadPackages();
    } catch (e) {
      toast('Failed to create package: ' + e.message, 'error');
    }
  }

  // Delete custom package
  async function deletePackage(packageId) {
    const confirmed = await showConfirmModal('Delete this package?', 'Delete Package');
    if (!confirmed) return;
    try {
      await api.del(`/shipping/packages/${packageId}`);
      toast('Package deleted', 'success');
      await loadPackages();
    } catch (e) {
      toast('Failed to delete package: ' + e.message, 'error');
    }
  }

  // Set default package
  async function setDefaultPackage(packageId) {
    try {
      await api.put('/shipping/packages/default', { packageId });
      toast('Default package updated', 'success');
      shippingState.defaultPackageId = packageId;
      populatePackageDropdowns();
      renderPackageLists();
    } catch (e) {
      toast('Failed to set default: ' + e.message, 'error');
    }
  }

  // Load shipping info for a product
  function loadProductShipping(product) {
    const requiresShipping = product.requiresShipping !== false;
    const weight = product.weight || 0;
    const weightUnit = product.weightUnit || 'POUNDS';

    $('edit-requires-shipping').checked = requiresShipping;
    $('edit-weight').value = weight;
    $('edit-weight-unit').value = weightUnit;

    // Toggle weight section visibility
    const weightSection = $('shipping-weight-section');
    const packageSection = $('shipping-package-section');
    if (weightSection) weightSection.style.display = requiresShipping ? 'block' : 'none';
    if (packageSection) packageSection.style.display = requiresShipping ? 'block' : 'none';
  }

  // Save shipping info
  async function saveProductShipping() {
    if (!S.selected) return;

    const btn = $('btn-save-shipping');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const pid = S.selected.id.split('/').pop();
      const requiresShipping = $('edit-requires-shipping').checked;
      const weight = parseFloat($('edit-weight').value) || 0;
      const weightUnit = $('edit-weight-unit').value;

      await api.put(`/products/${pid}/shipping`, {
        requiresShipping,
        weight,
        weightUnit
      });

      toast('Shipping info saved', 'success');

      // Update local state
      S.selected.requiresShipping = requiresShipping;
      S.selected.weight = weight;
      S.selected.weightUnit = weightUnit;

    } catch (e) {
      toast('Failed to save shipping: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // Toggle shipping sections based on "requires shipping" checkbox
  $('edit-requires-shipping').addEventListener('change', (e) => {
    const show = e.target.checked;
    const weightSection = $('shipping-weight-section');
    const packageSection = $('shipping-package-section');
    if (weightSection) weightSection.style.display = show ? 'block' : 'none';
    if (packageSection) packageSection.style.display = show ? 'block' : 'none';
  });

  // New product shipping toggle
  if ($('new-requires-shipping')) {
    $('new-requires-shipping').addEventListener('change', (e) => {
      const show = e.target.checked;
      const weightSection = $('new-shipping-weight-section');
      if (weightSection) weightSection.style.display = show ? 'block' : 'none';
    });
  }

  // Package dropdown change - show dimensions
  $('edit-package').addEventListener('change', (e) => {
    const packageId = e.target.value;
    const dimsEl = $('package-dimensions');
    if (!packageId) {
      dimsEl.textContent = '';
      return;
    }

    const allPackages = [...shippingState.packages.custom, ...shippingState.packages.carrier];
    const pkg = allPackages.find(p => p.id === packageId);
    if (pkg) {
      const typeLabel = pkg.type === 'soft_package' ? 'Soft Package' : pkg.type.charAt(0).toUpperCase() + pkg.type.slice(1);
      dimsEl.textContent = `${typeLabel} Â· ${pkg.length} x ${pkg.width} x ${pkg.height} ${pkg.sizeUnit}${pkg.weight ? ` Â· Empty: ${pkg.weight} ${pkg.weightUnit}` : ''}`;
    }
  });

  // Save shipping button
  $('btn-save-shipping').addEventListener('click', saveProductShipping);

  // Manage packages button
  $('btn-manage-packages').addEventListener('click', () => {
    $('package-modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  // Close package modal
  $('btn-close-package-modal').addEventListener('click', () => {
    $('package-modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
  });

  $('package-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('package-modal-overlay')) {
      $('package-modal-overlay').classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // Package modal tabs
  document.querySelectorAll('.pkg-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pkg-tab').forEach(t => {
        t.classList.remove('border-red-600', 'text-red-600');
        t.classList.add('border-transparent', 'text-gray-500');
      });
      tab.classList.remove('border-transparent', 'text-gray-500');
      tab.classList.add('border-red-600', 'text-red-600');

      const tabName = tab.dataset.tab;
      $('pkg-tab-custom').classList.toggle('hidden', tabName !== 'custom');
      $('pkg-tab-carrier').classList.toggle('hidden', tabName !== 'carrier');
    });
  });

  // Create package button
  $('btn-create-package').addEventListener('click', createPackage);

  // ==========================================
  // PRODUCT OPTIONS & VARIANTS
  // ==========================================
  const variantState = {
    options: [], // [{ name: string, values: string[] }]
    variants: [], // From API
    pendingChanges: false
  };

  // Add new option
  $('btn-add-option').addEventListener('click', () => {
    variantState.options.push({ name: '', values: [] });
    renderOptionsEditor();
  });

  // Render options editor
  function renderOptionsEditor() {
    const container = $('options-editor');

    if (variantState.options.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">No options defined. Add options like "Material" or "Size" to create variants.</p>';
      $('variants-section').classList.add('hidden');
      $('media-option-mapping').classList.add('hidden');
      updatePricingFieldsState(); // Re-enable pricing fields when no options
      return;
    }

    container.innerHTML = variantState.options.map((opt, idx) => `
      <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 ${opt.isAddOn ? 'border-blue-300 bg-blue-50' : ''}" data-option-idx="${idx}">
        <div class="flex items-center gap-2 mb-2">
          <input type="text" class="option-name flex-1 h-8 px-2 text-sm border border-gray-200 rounded" 
                 placeholder="Option name (e.g., Material)" value="${opt.name}" data-idx="${idx}">
          <button class="btn-remove-option text-xs text-red-500 hover:text-red-700 px-2 flex items-center justify-center" data-idx="${idx}">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" class="option-addon-toggle rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                   data-idx="${idx}" ${opt.isAddOn ? 'checked' : ''}>
            <span>Add-on option</span>
          </label>
          <span class="text-xs text-gray-400">${opt.isAddOn ? '(Does not affect inventory - price modifier only)' : '(Affects inventory count)'}</span>
        </div>
        <div class="flex flex-wrap gap-1 mb-2 option-values-container" data-idx="${idx}">
          ${opt.values.map((v, vi) => {
      const priceModifier = opt.priceModifiers?.[v] || 0;
      return `
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 text-xs rounded ${opt.isAddOn && priceModifier ? 'border-blue-200' : ''}">
                ${v}${opt.isAddOn && priceModifier ? ` (+$${priceModifier})` : ''}
                <button class="btn-remove-value text-gray-400 hover:text-red-500 flex items-center justify-center p-0.5" data-opt-idx="${idx}" data-val-idx="${vi}">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </span>
            `;
    }).join('')}
        </div>
        ${opt.isAddOn ? `
          <div class="mb-2 p-2 bg-white rounded border border-blue-100">
            <p class="text-xs text-gray-500 mb-2">Price modifiers for add-on values:</p>
            <div class="grid grid-cols-2 gap-2">
              ${opt.values.map((v, vi) => `
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-600 truncate flex-1">${v}:</span>
                  <span class="text-xs text-gray-400">+$</span>
                  <input type="number" step="0.01" class="addon-price-modifier w-16 h-6 px-1 text-xs border border-gray-200 rounded" 
                         data-opt-idx="${idx}" data-value="${v}" value="${opt.priceModifiers?.[v] || 0}">
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="flex gap-2">
          <input type="text" class="option-value-input flex-1 h-7 px-2 text-xs border border-gray-200 rounded" 
                 placeholder="Add value (press Enter)" data-idx="${idx}">
          <button class="btn-add-value h-7 px-2 text-xs text-white bg-gray-700 rounded" data-idx="${idx}">Add</button>
        </div>
      </div>
    `).join('');

    // Bind option name change
    container.querySelectorAll('.option-name').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        variantState.options[idx].name = e.target.value;
        variantState.pendingChanges = true;
      });
    });

    // Bind add-on toggle
    container.querySelectorAll('.option-addon-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        variantState.options[idx].isAddOn = e.target.checked;
        if (e.target.checked && !variantState.options[idx].priceModifiers) {
          variantState.options[idx].priceModifiers = {};
        }
        variantState.pendingChanges = true;
        renderOptionsEditor();
        generateVariantsPreview();
      });
    });

    // Bind price modifier inputs
    container.querySelectorAll('.addon-price-modifier').forEach(input => {
      input.addEventListener('change', (e) => {
        const optIdx = parseInt(e.target.dataset.optIdx);
        const value = e.target.dataset.value;
        const price = parseFloat(e.target.value) || 0;
        if (!variantState.options[optIdx].priceModifiers) {
          variantState.options[optIdx].priceModifiers = {};
        }
        variantState.options[optIdx].priceModifiers[value] = price;
        variantState.pendingChanges = true;
        renderOptionsEditor();
      });
    });

    // Bind remove option
    container.querySelectorAll('.btn-remove-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        variantState.options.splice(idx, 1);
        variantState.pendingChanges = true;
        renderOptionsEditor();
        generateVariantsPreview();
      });
    });

    // Bind remove value
    container.querySelectorAll('.btn-remove-value').forEach(btn => {
      btn.addEventListener('click', () => {
        const optIdx = parseInt(btn.dataset.optIdx);
        const valIdx = parseInt(btn.dataset.valIdx);
        variantState.options[optIdx].values.splice(valIdx, 1);
        variantState.pendingChanges = true;
        renderOptionsEditor();
        generateVariantsPreview();
      });
    });

    // Bind add value button
    container.querySelectorAll('.btn-add-value').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const input = container.querySelector(`.option-value-input[data-idx="${idx}"]`);
        addOptionValue(idx, input.value);
        input.value = '';
      });
    });

    // Bind enter key on value input
    container.querySelectorAll('.option-value-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const idx = parseInt(input.dataset.idx);
          addOptionValue(idx, input.value);
          input.value = '';
        }
      });
    });

    // Show variants section if we have options with values
    const hasValidOptions = variantState.options.some(o => o.name && o.values.length > 0);
    $('variants-section').classList.toggle('hidden', !hasValidOptions);

    // Update media mapping with new option values
    if (S.selected) {
      renderMediaMapping(S.selected);
    }
  }

  function addOptionValue(optIdx, value) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (variantState.options[optIdx].values.includes(trimmed)) {
      toast('Value already exists', 'error');
      return;
    }
    variantState.options[optIdx].values.push(trimmed);
    variantState.pendingChanges = true;
    renderOptionsEditor();
    generateVariantsPreview();
  }

  // Generate variant combinations preview
  function generateVariantsPreview() {
    const validOptions = variantState.options.filter(o => o.name && o.values.length > 0);

    if (validOptions.length === 0) {
      $('variants-tbody').innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 text-sm">Add options to generate variants</td></tr>';
      $('variants-count').textContent = '0';
      return;
    }

    // Separate inventory options from add-on options
    const inventoryOptions = validOptions.filter(o => !o.isAddOn);
    const addOnOptions = validOptions.filter(o => o.isAddOn);

    // Generate combinations only for inventory-affecting options
    // If no inventory options, use all options (fallback)
    const optionsForVariants = inventoryOptions.length > 0 ? inventoryOptions : validOptions;
    const combinations = generateCombinations(optionsForVariants);

    $('variants-count').textContent = combinations.length;

    // Show add-on info if there are add-on options
    const addOnInfo = addOnOptions.length > 0
      ? `<div class="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
           <strong>Add-on options:</strong> ${addOnOptions.map(o => o.name).join(', ')} 
           <span class="text-blue-500">(price modifiers applied at checkout, don't affect inventory)</span>
         </div>`
      : '';

    // Update table header to show add-on column if needed
    const hasAddOns = addOnOptions.length > 0;

    // Match with existing variants if available
    const tbody = $('variants-tbody');
    tbody.innerHTML = combinations.map((combo, idx) => {
      const title = combo.map(c => c.value).join(' / ');
      const existingVariant = findMatchingVariant(combo);

      // Calculate base price (without add-ons)
      const basePrice = existingVariant?.price || '';
      const hasDiscount = existingVariant?.discountPrice && existingVariant.discountPrice !== '';

      return `
        <tr data-combo='${JSON.stringify(combo)}' data-variant-id="${existingVariant?.id || ''}" data-is-inventory="true">
          <td class="px-3 py-2 text-xs text-gray-700">
            ${title}
            ${inventoryOptions.length < validOptions.length ? '<span class="text-gray-400 ml-1">(base)</span>' : ''}
          </td>
          <td class="px-3 py-2">
            <input type="number" step="0.01" class="variant-price w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   value="${basePrice}" placeholder="0.00">
          </td>
          <td class="px-3 py-2">
            <input type="number" step="0.01" class="variant-b2b-price w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   value="${existingVariant?.b2bPrice || ''}" placeholder="B2B">
          </td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-1">
              <input type="number" step="0.01" class="variant-discount-price w-full h-7 px-2 text-xs border border-gray-200 rounded ${hasDiscount ? 'border-green-400 bg-green-50' : ''}" 
                     value="${existingVariant?.discountPrice || ''}" placeholder="Sale">
              ${hasDiscount ? `<button type="button" class="remove-discount-btn flex-shrink-0 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Remove discount"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>` : ''}
            </div>
          </td>
          <td class="px-3 py-2">
            <input type="text" class="variant-sku w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   value="${existingVariant?.sku || ''}" placeholder="SKU">
          </td>
          <td class="px-3 py-2">
            <input type="number" class="variant-inventory w-full h-7 px-2 text-xs border border-gray-200 rounded" 
                   value="${existingVariant?.inventory || 0}">
          </td>
        </tr>
      `;
    }).join('');

    // Add event listeners for remove discount buttons
    tbody.querySelectorAll('.remove-discount-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const row = this.closest('tr');
        const discountInput = row.querySelector('.variant-discount-price');
        discountInput.value = '';
        discountInput.classList.remove('border-green-400', 'bg-green-50');
        this.remove();
      });
    });

    // Add event listeners for discount input changes
    tbody.querySelectorAll('.variant-discount-price').forEach(input => {
      input.addEventListener('input', function () {
        const row = this.closest('tr');
        const hasValue = this.value && this.value !== '';
        let removeBtn = row.querySelector('.remove-discount-btn');

        if (hasValue) {
          this.classList.add('border-green-400', 'bg-green-50');
          if (!removeBtn) {
            removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-discount-btn flex-shrink-0 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded';
            removeBtn.title = 'Remove discount';
            removeBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            removeBtn.addEventListener('click', function () {
              input.value = '';
              input.classList.remove('border-green-400', 'bg-green-50');
              this.remove();
            });
            this.parentElement.appendChild(removeBtn);
          }
        } else {
          this.classList.remove('border-green-400', 'bg-green-50');
          if (removeBtn) removeBtn.remove();
        }
      });
    });

    // Add info section before table
    const variantsSection = $('variants-section');
    let infoDiv = variantsSection.querySelector('.addon-info');
    if (addOnInfo) {
      if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.className = 'addon-info';
        variantsSection.insertBefore(infoDiv, variantsSection.querySelector('.overflow-x-auto'));
      }
      infoDiv.innerHTML = addOnInfo;
    } else if (infoDiv) {
      infoDiv.remove();
    }

    // Update pricing fields state based on variants
    updatePricingFieldsState();
  }

  function generateCombinations(options) {
    if (options.length === 0) return [];
    if (options.length === 1) {
      return options[0].values.map(v => [{ name: options[0].name, value: v }]);
    }

    const [first, ...rest] = options;
    const restCombos = generateCombinations(rest);
    const result = [];

    for (const val of first.values) {
      for (const combo of restCombos) {
        result.push([{ name: first.name, value: val }, ...combo]);
      }
    }

    return result;
  }

  function findMatchingVariant(combo) {
    if (!variantState.variants || variantState.variants.length === 0) return null;

    return variantState.variants.find(v => {
      if (!v.selectedOptions || v.selectedOptions.length !== combo.length) return false;
      return combo.every(c =>
        v.selectedOptions.some(so => so.name === c.name && so.value === c.value)
      );
    });
  }

  // Save variants
  $('btn-save-variants').addEventListener('click', async () => {
    if (!S.selected) return;

    const btn = $('btn-save-variants');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const pid = S.selected.id.split('/').pop();

      // Separate inventory options from add-on options
      const allOptions = variantState.options.filter(o => o.name && o.values.length > 0);
      const inventoryOptions = allOptions.filter(o => !o.isAddOn);
      const addOnOptions = allOptions.filter(o => o.isAddOn);

      // Step 1: Update options if changed (only inventory-affecting options go to Shopify)
      if (variantState.pendingChanges) {
        toast('Updating options...', 'info');

        // Only send inventory options to Shopify for variant creation
        const optionsForShopify = inventoryOptions.length > 0 ? inventoryOptions : allOptions;

        const optionsResult = await api.put(`/products/${pid}/options`, {
          options: optionsForShopify,
          addOnOptions: addOnOptions // Send add-on options separately for metafield storage
        });

        // Update variant IDs from the result
        if (optionsResult.data?.variants) {
          variantState.variants = optionsResult.data.variants;
        }

        variantState.pendingChanges = false;
      }

      // Step 2: Collect variant data from table
      const rows = $('variants-tbody').querySelectorAll('tr[data-variant-id]');
      const variantsToUpdate = [];

      // Re-fetch product to get updated variant IDs
      const refreshedProduct = await api.get(`/products/${pid}`);
      const freshVariants = refreshedProduct.variants || [];

      rows.forEach((row, idx) => {
        const combo = JSON.parse(row.dataset.combo || '[]');
        const title = combo.map(c => c.value).join(' / ');

        // Find matching variant by title or options
        const matchingVariant = freshVariants.find(v => {
          if (v.title === title) return true;
          if (!v.selectedOptions) return false;
          return combo.every(c =>
            v.selectedOptions.some(so => so.name === c.name && so.value === c.value)
          );
        });

        if (matchingVariant) {
          variantsToUpdate.push({
            id: matchingVariant.id,
            price: row.querySelector('.variant-price').value || '0',
            b2bPrice: row.querySelector('.variant-b2b-price').value || null,
            discountPrice: row.querySelector('.variant-discount-price').value || null,
            sku: row.querySelector('.variant-sku').value || '',
            inventory: parseInt(row.querySelector('.variant-inventory').value) || 0
          });
        }
      });

      // Step 3: Bulk update variants
      if (variantsToUpdate.length > 0) {
        toast(`Updating ${variantsToUpdate.length} variants...`, 'info');
        await api.put(`/products/${pid}/variants`, { variants: variantsToUpdate });
      }

      // Step 4: Save add-on options as product metafield (always call API to handle deletions)
      console.log('[Save Variants] Saving add-on options:', JSON.stringify(addOnOptions));
      toast(`Saving ${addOnOptions.length} add-on options...`, 'info');
      const addonsResult = await api.put(`/products/${pid}/addons`, { addOnOptions });
      console.log('[Save Variants] Add-ons result:', JSON.stringify(addonsResult));

      toast('Variants saved successfully!', 'success');

      // Refresh product data
      await selectProduct(S.selected.id);

    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Variants';
    }
  });

  // Load options and variants when product is selected
  function loadProductVariants(product) {
    // Load Shopify options (inventory-affecting)
    const shopifyOptions = (product.options || [])
      .filter(o => o.name !== 'Title') // Filter out default "Title" option
      .map(o => ({ name: o.name, values: o.values || [], isAddOn: false }));

    // Load add-on options from metafield
    const addOnOptions = (product.addonOptions || []).map(o => ({
      name: o.name,
      values: o.values || [],
      isAddOn: true,
      priceModifiers: o.priceModifiers || {}
    }));

    // Merge options - add-ons that match Shopify options should be marked as add-ons
    variantState.options = [...shopifyOptions];

    // Add any add-on options that aren't already in Shopify options
    addOnOptions.forEach(addon => {
      const existingIdx = variantState.options.findIndex(o => o.name === addon.name);
      if (existingIdx >= 0) {
        // Mark existing option as add-on and add price modifiers
        variantState.options[existingIdx].isAddOn = true;
        variantState.options[existingIdx].priceModifiers = addon.priceModifiers;
      } else {
        // Add new add-on option
        variantState.options.push(addon);
      }
    });

    // Load variants
    variantState.variants = product.variants || [];
    variantState.pendingChanges = false;

    renderOptionsEditor();
    generateVariantsPreview();
    renderMediaMapping(product);
    updatePricingFieldsState();
  }

  // Update pricing fields based on whether product has variants
  function updatePricingFieldsState() {
    const hasVariants = variantState.options.some(o => o.name && o.values.length > 0 && !o.isAddOn);
    const hasMultipleVariants = variantState.variants && variantState.variants.length > 1;
    const shouldDisable = hasVariants || hasMultipleVariants;

    const notice = $('pricing-variant-notice');
    const container = $('pricing-fields-container');

    // Show/hide notice
    if (notice) notice.classList.toggle('hidden', !shouldDisable);

    // Disable/enable fields
    const priceFields = ['edit-price', 'edit-compare-price', 'edit-b2b-price', 'edit-discount-price'];
    priceFields.forEach(id => {
      const field = $(id);
      if (field) {
        field.disabled = shouldDisable;
        field.classList.toggle('bg-gray-100', shouldDisable);
        field.classList.toggle('cursor-not-allowed', shouldDisable);
      }
    });

    // Hide remove discount button when disabled
    if (shouldDisable) {
      const removeBtn = $('btn-remove-discount');
      if (removeBtn) removeBtn.classList.add('hidden');
    }

    // Add opacity to container
    if (container) container.classList.toggle('opacity-60', shouldDisable);
  }

  // Media-Option Mapping
  function renderMediaMapping(product) {
    const container = $('media-mapping-grid');
    const media = product.media || [];

    // Check visibility first
    const hasOptions = variantState.options.some(o => o.name && o.values.length > 0);
    const hasMedia = media.length > 0;
    $('media-option-mapping').classList.toggle('hidden', !hasOptions || !hasMedia);

    if (!hasOptions || !hasMedia) {
      container.innerHTML = '<p class="col-span-full text-sm text-gray-400 text-center">Add options and media to enable mapping</p>';
      return;
    }

    // Get all option values for checkboxes
    const allValues = [];
    variantState.options.forEach(opt => {
      if (opt.name && opt.values.length > 0) {
        opt.values.forEach(val => {
          allValues.push({ option: opt.name, value: val, label: `${opt.name}: ${val}` });
        });
      }
    });

    if (allValues.length === 0) {
      container.innerHTML = '<p class="col-span-full text-sm text-gray-400 text-center">Add option values to tag images</p>';
      return;
    }

    container.innerHTML = media.map(m => {
      const currentAlt = m.alt || '';
      // Parse current tags (comma-separated in alt text)
      const currentTags = currentAlt.split(',').map(t => t.trim()).filter(t => t);
      const isVideo = m.mediaContentType === 'VIDEO' || m.type === 'VIDEO' || m.media_type === 'video' || (m.sources && m.sources.length > 0);

      let mediaHtml;
      if (isVideo) {
        const videoSrc = m.sources?.[0]?.url || m.url;
        const posterUrl = m.preview_image?.url || m.previewImage?.url || m.url || '';
        mediaHtml = `
          <div class="w-full aspect-square bg-gray-900 relative">
            <video src="${videoSrc}" poster="${posterUrl}" class="w-full h-full object-cover" muted loop playsinline preload="metadata"></video>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </span>
            </div>
          </div>
        `;
      } else {
        mediaHtml = `<img src="${m.url}" alt="${currentAlt}" class="w-full aspect-square object-cover">`;
      }

      return `
        <div class="relative group bg-white rounded-lg border border-gray-200 overflow-hidden">
          ${mediaHtml}
          <div class="p-2 bg-gray-50 border-t border-gray-200">
            <p class="text-xs text-gray-500 mb-2">Tag with options:</p>
            <div class="space-y-1 max-h-24 overflow-y-auto">
              ${allValues.map(v => `
                <label class="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
                  <input type="checkbox" class="media-tag-checkbox rounded border-gray-300 text-red-600 focus:ring-red-500" 
                         data-media-id="${m.id}" data-value="${v.value}" 
                         ${currentTags.includes(v.value) ? 'checked' : ''}>
                  <span class="truncate">${v.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind checkbox change events
    container.querySelectorAll('.media-tag-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const mediaId = e.target.dataset.mediaId;
        const mediaCard = e.target.closest('[data-media-id]')?.closest('.relative') || e.target.closest('.relative');

        // Collect all checked values for this media
        const checkedBoxes = mediaCard.querySelectorAll('.media-tag-checkbox:checked');
        const tags = Array.from(checkedBoxes).map(cb => cb.dataset.value);
        const newAlt = tags.join(', ');

        try {
          const pid = S.selected.id.split('/').pop();
          await api.put(`/products/${pid}/media/${encodeURIComponent(mediaId)}/alt`, { alt: newAlt });

          // Update the image alt attribute
          const img = mediaCard.querySelector('img');
          if (img) img.alt = newAlt;

          // Update product data
          const mediaItem = S.selected.media?.find(m => m.id === mediaId);
          if (mediaItem) mediaItem.alt = newAlt;

          toast('Media tags updated', 'success');
        } catch (err) {
          toast('Failed to update: ' + err.message, 'error');
          // Revert checkbox
          e.target.checked = !e.target.checked;
        }
      });
    });
  }

  // ==========================================
  // AUTH
  // ==========================================
  function showAuth() {
    $('auth-modal').classList.remove('hidden');
    $('auth-key').focus();
  }

  $('auth-submit').addEventListener('click', async () => {
    const key = $('auth-key').value.trim();
    if (!key) { $('auth-error').textContent = 'Enter API key'; $('auth-error').classList.remove('hidden'); return; }
    API_KEY = key;
    localStorage.setItem('skm_admin_key', key);
    try {
      await loadVehicles();
      await loadProducts();
      await loadPackages();
      $('auth-modal').classList.add('hidden');
      toast('Authenticated', 'success');

      // Check URL for order parameter after successful auth
      const urlParams = new URLSearchParams(window.location.search);
      const orderParam = urlParams.get('order');
      const tabParam = urlParams.get('tab');

      if (orderParam || tabParam === 'orders') {
        switchToTab('orders');
        if (orderParam && orderMgmt) {
          setTimeout(() => {
            if (orderMgmt.selectOrderByNumber) {
              orderMgmt.selectOrderByNumber(orderParam);
            }
          }, 1500);
        }
      }
    } catch (e) {
      $('auth-error').textContent = 'Invalid key';
      $('auth-error').classList.remove('hidden');
    }
  });

  $('auth-key').addEventListener('keypress', (e) => { if (e.key === 'Enter') $('auth-submit').click(); });

  // Search - Desktop
  let searchTimeout;
  $('product-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadProducts(e.target.value), 300);
    // Sync to mobile search
    if ($('product-search-mobile')) $('product-search-mobile').value = e.target.value;
  });

  // Search - Mobile
  if ($('product-search-mobile')) {
    $('product-search-mobile').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadProducts(e.target.value), 300);
      // Sync to desktop search
      if ($('product-search')) $('product-search').value = e.target.value;
    });
  }

  // ==========================================
  // YMM FILTER FOR PRODUCT SIDEBAR
  // ==========================================

  // Populate YMM dropdowns from vehicles data
  function populateProductYmmDropdowns() {
    const years = new Set();
    const makes = new Set();
    const models = new Set();

    S.vehicles.forEach(v => {
      if (v.year) years.add(v.year);
      if (v.make) makes.add(v.make);
      if (v.model) models.add(v.model);
    });

    // Sort years descending, makes/models alphabetically
    const sortedYears = [...years].sort((a, b) => b - a);
    const sortedMakes = [...makes].sort();
    const sortedModels = [...models].sort();

    // Populate desktop dropdowns
    populateSelect('ymm-year', sortedYears, 'All Years');
    populateSelect('ymm-make', sortedMakes, 'All Makes');
    populateSelect('ymm-model', sortedModels, 'All Models');

    // Populate mobile dropdowns
    populateSelect('ymm-year-mobile', sortedYears, 'All Years');
    populateSelect('ymm-make-mobile', sortedMakes, 'All Makes');
    populateSelect('ymm-model-mobile', sortedModels, 'All Models');
  }

  function populateSelect(id, options, defaultText) {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${defaultText}</option>` +
      options.map(o => `<option value="${o}">${o}</option>`).join('');
  }

  // Update models dropdown based on selected make
  function updateProductYmmModels() {
    const make = S.productYmmFilter.make;
    const models = new Set();

    S.vehicles.forEach(v => {
      if (!make || v.make?.toLowerCase() === make.toLowerCase()) {
        if (v.model) models.add(v.model);
      }
    });

    const sortedModels = [...models].sort();
    populateSelect('ymm-model', sortedModels, 'All Models');
    populateSelect('ymm-model-mobile', sortedModels, 'All Models');
  }

  // Handle YMM filter changes
  function handleYmmFilterChange(field, value, isMobile = false) {
    S.productYmmFilter[field] = value;

    // Sync between desktop and mobile
    const desktopId = `ymm-${field}`;
    const mobileId = `ymm-${field}-mobile`;
    if (isMobile && $(desktopId)) $(desktopId).value = value;
    if (!isMobile && $(mobileId)) $(mobileId).value = value;

    // If make changed, update models dropdown
    if (field === 'make') {
      S.productYmmFilter.model = '';
      updateProductYmmModels();
      if ($('ymm-model')) $('ymm-model').value = '';
      if ($('ymm-model-mobile')) $('ymm-model-mobile').value = '';
    }

    applyProductYmmFilter();
  }

  // Clear YMM filter
  function clearProductYmmFilter() {
    S.productYmmFilter = { year: '', make: '', model: '' };

    // Reset dropdowns
    ['ymm-year', 'ymm-make', 'ymm-model', 'ymm-year-mobile', 'ymm-make-mobile', 'ymm-model-mobile'].forEach(id => {
      if ($(id)) $(id).value = '';
    });

    // Repopulate models with all options
    updateProductYmmModels();
    applyProductYmmFilter();
  }

  // Bind YMM filter events - Desktop
  if ($('ymm-year')) {
    $('ymm-year').addEventListener('change', (e) => handleYmmFilterChange('year', e.target.value));
  }
  if ($('ymm-make')) {
    $('ymm-make').addEventListener('change', (e) => handleYmmFilterChange('make', e.target.value));
  }
  if ($('ymm-model')) {
    $('ymm-model').addEventListener('change', (e) => handleYmmFilterChange('model', e.target.value));
  }
  if ($('btn-clear-ymm')) {
    $('btn-clear-ymm').addEventListener('click', clearProductYmmFilter);
  }

  // Bind YMM filter events - Mobile
  if ($('ymm-year-mobile')) {
    $('ymm-year-mobile').addEventListener('change', (e) => handleYmmFilterChange('year', e.target.value, true));
  }
  if ($('ymm-make-mobile')) {
    $('ymm-make-mobile').addEventListener('change', (e) => handleYmmFilterChange('make', e.target.value, true));
  }
  if ($('ymm-model-mobile')) {
    $('ymm-model-mobile').addEventListener('change', (e) => handleYmmFilterChange('model', e.target.value, true));
  }
  if ($('btn-clear-ymm-mobile')) {
    $('btn-clear-ymm-mobile').addEventListener('click', clearProductYmmFilter);
  }

  // New Product button - Mobile
  if ($('btn-new-product-mobile')) {
    $('btn-new-product-mobile').addEventListener('click', () => {
      closeMobileSidebar();
      showNewProductForm();
    });
  }

  // ==========================================
  // ORDER MANAGEMENT (loaded from external file)
  // ==========================================
  let orderMgmt = null;
  function loadOrders() {
    if (orderMgmt) orderMgmt.loadOrders();
  }

  // Initialize order management when script loads
  if (window.initOrderManagement) {
    orderMgmt = window.initOrderManagement(API_BASE, api, S, $, toast, showAuth);
  }

  // ==========================================
  // INIT
  // ==========================================
  async function init() {
    try {
      const r = await fetch(`${API_BASE}/health`);
      const d = await r.json();
      if (d.status !== 'ok') throw new Error('API offline');

      if (API_KEY) {
        await loadVehicles();
        await loadProducts();
        await loadPackages();

        // Check URL for order parameter (e.g., ?order=1002 or ?tab=orders&order=1002)
        const urlParams = new URLSearchParams(window.location.search);
        const orderParam = urlParams.get('order');
        const tabParam = urlParams.get('tab');

        if (orderParam || tabParam === 'orders') {
          // Switch to orders tab
          switchToTab('orders');

          // If specific order requested, select it after orders load
          if (orderParam && orderMgmt) {
            // Wait for orders to load then select the specific order
            setTimeout(() => {
              if (orderMgmt.selectOrderByNumber) {
                orderMgmt.selectOrderByNumber(orderParam);
              }
            }, 1500);
          }
        }
      } else {
        showAuth();
      }
    } catch (e) {
      toast('Cannot connect to API', 'error');
    }
  }

  init();
})();