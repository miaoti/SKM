// ==========================================
// ORDER MANAGEMENT - Admin Dashboard
// ==========================================
// Extracted to separate file to reduce template size

(function (window) {
  'use strict';

  // Wait for main admin script to initialize
  function initOrderManagement(API_BASE, api, S, $, toast, showAuth) {

    async function loadOrders() {
      const list = $('orders-list');
      list.innerHTML = '<div class="p-8 text-center"><div class="w-5 h-5 border-2 border-gray-200 border-t-red-600 rounded-full spinner mx-auto"></div><p class="text-sm text-gray-400 mt-2">Loading orders...</p></div>';

      try {
        const params = new URLSearchParams();
        if (S.orderFilters.status) params.set('status', S.orderFilters.status);
        if (S.orderFilters.fulfillment) params.set('fulfillment', S.orderFilters.fulfillment);
        if (S.orderFilters.financial) params.set('financial', S.orderFilters.financial);
        if (S.orderFilters.query) params.set('q', S.orderFilters.query);
        params.set('limit', '50');

        const response = await fetch(`${API_BASE}/orders?${params.toString()}`, { headers: api.headers() });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        S.orders = data.orders || [];
        renderOrdersList();
      } catch (e) {
        if (e.message === 'Unauthorized') showAuth();
        else {
          list.innerHTML = `<div class="p-8 text-center text-sm text-red-500">${e.message}</div>`;
          toast(e.message, 'error');
        }
      }
    }

    function renderOrdersList() {
      const list = $('orders-list');
      $('orders-count').textContent = `${S.orders.length} orders`;

      if (S.orders.length === 0) {
        list.innerHTML = '<div class="p-8 text-center text-sm text-gray-400">No orders found</div>';
        return;
      }

      list.innerHTML = S.orders.map(order => {
        const financialClass = getFinancialStatusClass(order.financialStatus);
        const fulfillmentClass = getFulfillmentStatusClass(order.fulfillmentStatus);
        const isSelected = S.selectedOrder?.id === order.id;

        return `
          <div class="order-item p-3 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-red-50 border-l-2 border-red-600' : ''}" data-order-id="${order.id}">
            <div class="flex items-start justify-between mb-1">
              <span class="text-sm font-medium text-gray-900">${order.name}</span>
              <span class="text-xs text-gray-500">${formatDate(order.createdAt)}</span>
            </div>
            <div class="flex items-center gap-1 mb-1">
              <span class="px-1.5 py-0.5 text-[10px] font-medium rounded ${financialClass}">${order.financialStatus || 'PENDING'}</span>
              <span class="px-1.5 py-0.5 text-[10px] font-medium rounded ${fulfillmentClass}">${order.fulfillmentStatus || 'UNFULFILLED'}</span>
              ${order.test ? '<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-100 text-yellow-700">TEST</span>' : ''}
            </div>
            <div class="text-xs text-gray-500">${order.customer?.displayName || order.email || 'Guest'}</div>
            <div class="text-sm font-medium text-gray-900 mt-1">$${parseFloat(order.totalPrice || 0).toFixed(2)}</div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.order-item').forEach(item => {
        item.addEventListener('click', () => selectOrder(item.dataset.orderId));
      });
    }

    function getFinancialStatusClass(status) {
      const s = (status || '').toUpperCase();
      if (s.includes('PAID')) return 'bg-green-100 text-green-700';
      if (s.includes('PENDING')) return 'bg-yellow-100 text-yellow-700';
      if (s.includes('REFUND')) return 'bg-orange-100 text-orange-700';
      if (s.includes('VOID') || s.includes('EXPIRED') || s.includes('CANCEL')) return 'bg-red-100 text-red-700';
      return 'bg-gray-100 text-gray-600';
    }

    function getFulfillmentStatusClass(status) {
      const s = (status || '').toUpperCase();
      if (s.includes('FULFILLED') && !s.includes('UNFULFILLED')) return 'bg-green-100 text-green-700';
      if (s.includes('PARTIAL')) return 'bg-blue-100 text-blue-700';
      if (s.includes('UNFULFILLED') || !s) return 'bg-yellow-100 text-yellow-700';
      if (s.includes('CANCEL')) return 'bg-red-100 text-red-700';
      return 'bg-gray-100 text-gray-600';
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function formatRelativeTime(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
      if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
      if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getDateGroup(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (eventDate.getTime() === today.getTime()) return 'Today';
      if (eventDate.getTime() === yesterday.getTime()) return 'Yesterday';
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    async function selectOrder(orderId) {
      S.selectedOrder = S.orders.find(o => o.id === orderId);
      renderOrdersList();

      $('order-empty').classList.add('hidden');
      $('order-detail').classList.remove('hidden');
      $('order-line-items').innerHTML = '<div class="text-center py-4"><div class="w-5 h-5 border-2 border-gray-200 border-t-red-600 rounded-full spinner mx-auto"></div></div>';

      try {
        const numericId = orderId.split('/').pop();
        const response = await fetch(`${API_BASE}/orders/${numericId}`, { headers: api.headers() });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        S.selectedOrderFull = data.order;
        renderOrderDetail();
      } catch (e) {
        toast('Failed to load order: ' + e.message, 'error');
      }
    }

    function renderOrderDetail() {
      const order = S.selectedOrderFull;
      if (!order) return;

      $('order-name').textContent = order.name;
      $('order-date').textContent = formatDateTime(order.createdAt);
      $('order-test-badge').classList.toggle('hidden', !order.test);

      const financialBadge = $('order-financial-badge');
      financialBadge.textContent = order.displayFinancialStatus || 'PENDING';
      financialBadge.className = `px-2 py-1 text-xs font-medium rounded ${getFinancialStatusClass(order.displayFinancialStatus)}`;

      const fulfillmentBadge = $('order-fulfillment-badge');
      fulfillmentBadge.textContent = order.displayFulfillmentStatus || 'UNFULFILLED';
      fulfillmentBadge.className = `px-2 py-1 text-xs font-medium rounded ${getFulfillmentStatusClass(order.displayFulfillmentStatus)}`;

      const lineItemsHtml = order.lineItems.map(item => {
        const imgUrl = item.image?.url || item.variant?.image?.url || '';
        const price = item.discountedUnitPriceSet?.shopMoney?.amount || item.originalUnitPriceSet?.shopMoney?.amount || '0';
        const fulfillmentStatus = item.fulfillmentStatus || 'UNFULFILLED';

        return `
          <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div class="w-12 h-12 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
              ${imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover">` : ''}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">${item.title || item.name}</p>
              ${item.variantTitle ? `<p class="text-xs text-gray-500">${item.variantTitle}</p>` : ''}
              ${item.sku ? `<p class="text-xs text-gray-400">SKU: ${item.sku}</p>` : ''}
              ${item.customAttributes?.length ? `<div class="text-xs text-blue-600 mt-1">${item.customAttributes.map(a => `${a.key}: ${a.value}`).join(', ')}</div>` : ''}
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-sm font-medium text-gray-900">$${parseFloat(price).toFixed(2)} × ${item.quantity}</p>
              <p class="text-xs ${getFulfillmentStatusClass(fulfillmentStatus)} px-1.5 py-0.5 rounded mt-1 inline-block">${fulfillmentStatus}</p>
            </div>
          </div>
        `;
      }).join('');
      $('order-line-items').innerHTML = lineItemsHtml || '<p class="text-sm text-gray-400">No items</p>';

      $('order-subtotal').textContent = `$${parseFloat(order.subtotalPriceSet?.shopMoney?.amount || 0).toFixed(2)}`;
      $('order-shipping').textContent = `$${parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || 0).toFixed(2)}`;
      $('order-tax').textContent = `$${parseFloat(order.totalTaxSet?.shopMoney?.amount || 0).toFixed(2)}`;
      $('order-total').textContent = `$${parseFloat(order.totalPriceSet?.shopMoney?.amount || 0).toFixed(2)}`;

      const discounts = parseFloat(order.totalDiscountsSet?.shopMoney?.amount || 0);
      if (discounts > 0) {
        $('order-discounts-row').classList.remove('hidden');
        $('order-discounts').textContent = `-$${discounts.toFixed(2)}`;
      } else {
        $('order-discounts-row').classList.add('hidden');
      }

      const refunded = parseFloat(order.totalRefundedSet?.shopMoney?.amount || 0);
      if (refunded > 0) {
        $('order-refunded-row').classList.remove('hidden');
        $('order-refunded').textContent = `-$${refunded.toFixed(2)}`;
      } else {
        $('order-refunded-row').classList.add('hidden');
      }

      if (order.customer) {
        $('order-customer-name').textContent = order.customer.displayName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Guest';
        $('order-customer-email').textContent = order.customer.email || order.email || '-';
        $('order-customer-phone').textContent = order.customer.phone || order.phone || '-';
        $('order-customer-orders').textContent = order.customer.ordersCount || '0';
        $('order-customer-spent').textContent = `$${parseFloat(order.customer.totalSpent?.amount || 0).toFixed(2)}`;

        const tagsHtml = (order.customer.tags || []).map(t => `<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">${t}</span>`).join('');
        $('order-customer-tags').innerHTML = tagsHtml || '';
      } else {
        $('order-customer-name').textContent = 'Guest';
        $('order-customer-email').textContent = order.email || '-';
        $('order-customer-phone').textContent = order.phone || '-';
        $('order-customer-orders').textContent = '0';
        $('order-customer-spent').textContent = '$0.00';
        $('order-customer-tags').innerHTML = '';
      }

      // Render shipping address with validation status
      renderShippingAddressWithValidation(order.shippingAddress, order.id);
      $('order-billing-address').innerHTML = formatAddress(order.billingAddress);

      $('order-note').textContent = order.note || 'No note';
      $('order-note').classList.toggle('italic', !order.note);

      const orderTagsHtml = (order.tags || []).map(t => `<span class="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">${t}</span>`).join('');
      $('order-tags').innerHTML = orderTagsHtml || '<span class="text-sm text-gray-400">No tags</span>';

      renderFulfillments(order.fulfillments || []);
      renderTimeline(order.events || []);
    }

    function formatAddress(addr) {
      if (!addr) return '<p class="text-gray-400">No address</p>';
      const lines = [
        addr.name || `${addr.firstName || ''} ${addr.lastName || ''}`.trim(),
        addr.company,
        addr.address1,
        addr.address2,
        `${addr.city || ''}, ${addr.province || ''} ${addr.zip || ''}`.trim(),
        addr.country,
        addr.phone
      ].filter(Boolean);
      return lines.map(l => `<p>${l}</p>`).join('');
    }

    function renderShippingAddressWithValidation(addr, orderId) {
      const container = $('order-shipping-address');
      if (!addr) {
        container.innerHTML = '<p class="text-gray-400">No address</p>';
        return;
      }

      const validationStatus = addr.validationResultSummary;
      const hasIssue = validationStatus === 'ERROR' || validationStatus === 'WARNING';
      const numericId = orderId ? orderId.split('/').pop() : '';

      let html = '';

      // Show validation warning if there are issues
      if (hasIssue) {
        const isError = validationStatus === 'ERROR';
        const bgColor = isError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
        const textColor = isError ? 'text-red-700' : 'text-yellow-700';
        const iconColor = isError ? 'text-red-500' : 'text-yellow-500';

        html += `
          <div class="mb-3 p-2 ${bgColor} border rounded-lg">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 ${iconColor} flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="flex-1">
                <p class="text-xs font-medium ${textColor}">
                  ${isError ? 'Address has issues' : 'Review address'}
                </p>
                <p class="text-xs ${textColor} opacity-75 mt-0.5">
                  ${isError ? 'This address may be undeliverable' : 'This address may have issues'}
                </p>
              </div>
            </div>
            <a href="https://admin.shopify.com/store/skm-exhaust/orders/${numericId}" 
               target="_blank" 
               class="mt-2 inline-flex items-center gap-1 text-xs font-medium ${textColor} hover:underline">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Review in Shopify
            </a>
          </div>
        `;
      }

      // Address lines
      const lines = [
        addr.name || `${addr.firstName || ''} ${addr.lastName || ''}`.trim(),
        addr.company,
        addr.address1,
        addr.address2,
        `${addr.city || ''}, ${addr.province || ''} ${addr.zip || ''}`.trim(),
        addr.country,
        addr.phone
      ].filter(Boolean);

      html += lines.map(l => `<p>${l}</p>`).join('');

      // Show validation status badge
      if (validationStatus) {
        let badgeClass = 'bg-gray-100 text-gray-600';
        let badgeText = validationStatus;

        if (validationStatus === 'NO_ISSUES') {
          badgeClass = 'bg-green-100 text-green-700';
          badgeText = 'Verified';
        } else if (validationStatus === 'WARNING') {
          badgeClass = 'bg-yellow-100 text-yellow-700';
          badgeText = 'Needs Review';
        } else if (validationStatus === 'ERROR') {
          badgeClass = 'bg-red-100 text-red-700';
          badgeText = 'Invalid';
        }

        html += `<p class="mt-2"><span class="px-1.5 py-0.5 text-[10px] font-medium rounded ${badgeClass}">${badgeText}</span></p>`;
      }

      container.innerHTML = html;
    }

    function renderFulfillments(fulfillments) {
      const container = $('order-fulfillments');

      if (!fulfillments || fulfillments.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400">No fulfillments yet</p>';
        return;
      }

      container.innerHTML = fulfillments.map(f => {
        const tracking = f.trackingInfo?.[0] || {};
        const statusClass = f.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

        return `
          <div class="p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900">${f.name || 'Fulfillment'}</span>
              <span class="px-1.5 py-0.5 text-[10px] font-medium rounded ${statusClass}">${f.displayStatus || f.status}</span>
            </div>
            ${tracking.number ? `
              <div class="text-xs text-gray-600">
                <span class="font-medium">${tracking.company || 'Carrier'}:</span> 
                ${tracking.url ? `<a href="${tracking.url}" target="_blank" class="text-red-600 hover:underline">${tracking.number}</a>` : tracking.number}
              </div>
            ` : ''}
            <div class="text-xs text-gray-400 mt-1">${formatDateTime(f.createdAt)}</div>
          </div>
        `;
      }).join('');
    }

    function renderTimeline(events) {
      const container = $('order-timeline');

      if (!events || events.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400">No events</p>';
        return;
      }

      // Group events by date
      let currentGroup = '';
      let html = '';

      events.slice(0, 30).forEach(e => {
        const dateGroup = getDateGroup(e.createdAt);

        // Add date header if new group
        if (dateGroup !== currentGroup) {
          currentGroup = dateGroup;
          html += `<div class="text-xs font-medium text-gray-500 mt-4 mb-2 first:mt-0">${dateGroup}</div>`;
        }

        html += `
          <div class="flex items-start gap-3 py-2">
            <div class="w-2 h-2 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-700">${e.message || 'Event'}</p>
            </div>
            <span class="text-xs text-gray-400 whitespace-nowrap">${formatRelativeTime(e.createdAt)}</span>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    // Order Filters
    if ($('order-search')) {
      let searchTimeout;
      $('order-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          S.orderFilters.query = e.target.value;
          loadOrders();
        }, 300);
      });
    }

    if ($('order-filter-status')) {
      $('order-filter-status').addEventListener('change', (e) => {
        S.orderFilters.status = e.target.value;
        loadOrders();
      });
    }

    if ($('order-filter-fulfillment')) {
      $('order-filter-fulfillment').addEventListener('change', (e) => {
        S.orderFilters.fulfillment = e.target.value;
        loadOrders();
      });
    }

    if ($('order-filter-financial')) {
      $('order-filter-financial').addEventListener('change', (e) => {
        S.orderFilters.financial = e.target.value;
        loadOrders();
      });
    }

    if ($('btn-refresh-orders')) {
      $('btn-refresh-orders').addEventListener('click', loadOrders);
    }

    // Order Actions
    if ($('btn-fulfill-order')) {
      $('btn-fulfill-order').addEventListener('click', openFulfillmentModal);
    }

    // Fulfillment dropdown toggle
    if ($('btn-fulfill-dropdown')) {
      $('btn-fulfill-dropdown').addEventListener('click', () => {
        $('fulfill-dropdown').classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-fulfill-dropdown') && !e.target.closest('#fulfill-dropdown')) {
          $('fulfill-dropdown').classList.add('hidden');
        }
      });
    }

    // Fulfillment status actions (Put on hold, Release hold)
    document.querySelectorAll('.fulfill-status-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        if (!S.selectedOrderFull) return;

        $('fulfill-dropdown').classList.add('hidden');

        try {
          const numericId = S.selectedOrderFull.id.split('/').pop();
          const response = await fetch(`${API_BASE}/orders/${numericId}/fulfillment-orders`, { headers: api.headers() });
          const data = await response.json();

          if (!data.success) throw new Error(data.error);

          const fulfillmentOrders = data.fulfillmentOrders || [];

          // Filter based on action
          let actionable = [];
          if (status === 'ON_HOLD') {
            // Can only put on hold orders that are OPEN or IN_PROGRESS
            actionable = fulfillmentOrders.filter(fo => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS');
            if (actionable.length === 0) {
              toast('No orders available to put on hold', 'info');
              return;
            }
          } else if (status === 'RELEASE_HOLD') {
            // Can only release hold on orders that are ON_HOLD
            actionable = fulfillmentOrders.filter(fo => fo.status === 'ON_HOLD');
            if (actionable.length === 0) {
              toast('No orders are currently on hold', 'info');
              return;
            }
          }

          // Update each fulfillment order status
          for (const fo of actionable) {
            const foId = fo.id.split('/').pop();
            let endpoint = '';

            if (status === 'ON_HOLD') {
              endpoint = `${API_BASE}/fulfillment-orders/${foId}/hold`;
            } else if (status === 'RELEASE_HOLD') {
              endpoint = `${API_BASE}/fulfillment-orders/${foId}/release-hold`;
            }

            if (endpoint) {
              const updateRes = await fetch(endpoint, {
                method: 'POST',
                headers: api.headers(),
                body: JSON.stringify({ reason: 'OTHER', reasonNotes: 'Updated from admin dashboard' })
              });
              const updateData = await updateRes.json();
              if (!updateData.success) throw new Error(updateData.error);
            }
          }

          const message = status === 'ON_HOLD' ? 'Order put on hold' : 'Hold released';
          toast(message, 'success');
          await selectOrder(S.selectedOrderFull.id);
          await loadOrders();
        } catch (e) {
          toast('Failed to update status: ' + e.message, 'error');
        }
      });
    });

    if ($('btn-create-label')) {
      $('btn-create-label').addEventListener('click', () => {
        if (!S.selectedOrderFull) return;
        const numericId = S.selectedOrderFull.id.split('/').pop();
        // Shopify doesn't expose label creation via API - redirect to Shopify Admin
        const labelUrl = `https://admin.shopify.com/store/skm-exhaust/orders/${numericId}/fulfill`;
        window.open(labelUrl, '_blank');
        toast('Opening Shopify to create shipping label...', 'info');
      });
    }

    // Add Tracking button - opens modal
    if ($('btn-add-tracking')) {
      $('btn-add-tracking').addEventListener('click', () => {
        if (!S.selectedOrderFull) return;

        // Check if there are existing fulfillments to add tracking to
        const fulfillments = S.selectedOrderFull.fulfillments || [];
        if (fulfillments.length === 0) {
          toast('No fulfillments yet. Please fulfill items first.', 'info');
          return;
        }

        // Populate fulfillment select dropdown
        const select = $('tracking-fulfillment-select');
        select.innerHTML = fulfillments.map((f, i) =>
          `<option value="${f.id}">${f.name || `Fulfillment ${i + 1}`} - ${f.status || 'Unknown'}</option>`
        ).join('');

        // Clear form
        $('tracking-carrier').value = '';
        $('tracking-number').value = '';
        $('tracking-url').value = '';
        $('tracking-notify').checked = true;

        // Show modal
        $('tracking-modal').classList.remove('hidden');
      });
    }

    // Tracking modal close buttons
    if ($('btn-close-tracking')) {
      $('btn-close-tracking').addEventListener('click', () => $('tracking-modal').classList.add('hidden'));
    }
    if ($('btn-cancel-tracking')) {
      $('btn-cancel-tracking').addEventListener('click', () => $('tracking-modal').classList.add('hidden'));
    }

    // Save Tracking button
    if ($('btn-save-tracking')) {
      $('btn-save-tracking').addEventListener('click', async () => {
        const fulfillmentId = $('tracking-fulfillment-select').value;
        const carrier = $('tracking-carrier').value;
        const trackingNumber = $('tracking-number').value.trim();
        const trackingUrl = $('tracking-url').value.trim();
        const notifyCustomer = $('tracking-notify').checked;

        if (!carrier) {
          toast('Please select a carrier', 'error');
          return;
        }
        if (!trackingNumber) {
          toast('Please enter a tracking number', 'error');
          return;
        }

        try {
          const numericFulfillmentId = fulfillmentId.split('/').pop();
          const response = await fetch(`${API_BASE}/fulfillments/${numericFulfillmentId}/tracking`, {
            method: 'PUT',
            headers: api.headers(),
            body: JSON.stringify({
              company: carrier,
              number: trackingNumber,
              url: trackingUrl || undefined,
              notifyCustomer
            })
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.error);

          toast('Tracking updated successfully', 'success');
          $('tracking-modal').classList.add('hidden');
          await selectOrder(S.selectedOrderFull.id);
        } catch (e) {
          toast('Failed to update tracking: ' + e.message, 'error');
        }
      });
    }

    // Edit Shipping Address button
    if ($('btn-edit-shipping-addr')) {
      $('btn-edit-shipping-addr').addEventListener('click', () => {
        if (!S.selectedOrderFull) return;
        const numericId = S.selectedOrderFull.id.split('/').pop();
        // Shopify doesn't allow editing shipping address via API after order is placed
        // Redirect to Shopify Admin
        const editUrl = `https://admin.shopify.com/store/skm-exhaust/orders/${numericId}`;
        window.open(editUrl, '_blank');
        toast('Opening Shopify to edit shipping address...', 'info');
      });
    }

    // Post Comment button
    if ($('btn-post-comment')) {
      $('btn-post-comment').addEventListener('click', async () => {
        if (!S.selectedOrderFull) return;
        const input = $('timeline-comment-input');
        const comment = input.value.trim();
        if (!comment) {
          toast('Please enter a comment', 'error');
          return;
        }

        try {
          const numericId = S.selectedOrderFull.id.split('/').pop();
          const response = await fetch(`${API_BASE}/orders/${numericId}/notes`, {
            method: 'POST',
            headers: api.headers(),
            body: JSON.stringify({ note: comment })
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.error);
          input.value = '';
          toast('Comment posted', 'success');
          await selectOrder(S.selectedOrderFull.id);
        } catch (e) {
          toast('Failed to post comment: ' + e.message, 'error');
        }
      });
    }

    // Enable Post button when input has text
    if ($('timeline-comment-input')) {
      $('timeline-comment-input').addEventListener('input', (e) => {
        const btn = $('btn-post-comment');
        if (btn) {
          const hasText = e.target.value.trim().length > 0;
          btn.classList.toggle('text-gray-400', !hasText);
          btn.classList.toggle('text-white', hasText);
          btn.classList.toggle('bg-gray-100', !hasText);
          btn.classList.toggle('bg-red-600', hasText);
        }
      });

      // Submit on Enter
      $('timeline-comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          $('btn-post-comment').click();
        }
      });
    }

    // Edit Order Note button
    if ($('btn-edit-order-note')) {
      $('btn-edit-order-note').addEventListener('click', async () => {
        if (!S.selectedOrderFull) return;

        const newNote = prompt('Enter order note:', S.selectedOrderFull.note || '');
        if (newNote === null) return;

        try {
          const numericId = S.selectedOrderFull.id.split('/').pop();
          const response = await fetch(`${API_BASE}/orders/${numericId}`, {
            method: 'PUT',
            headers: api.headers(),
            body: JSON.stringify({ note: newNote })
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.error);
          toast('Note updated', 'success');
          await selectOrder(S.selectedOrderFull.id);
        } catch (e) {
          toast('Failed to update note: ' + e.message, 'error');
        }
      });
    }

    if ($('btn-send-receipt')) {
      $('btn-send-receipt').addEventListener('click', async () => {
        if (!S.selectedOrderFull) return;
        const confirmed = await window.showConfirmModal('Send order confirmation email to customer?', 'Send Receipt');
        if (!confirmed) return;

        try {
          const numericId = S.selectedOrderFull.id.split('/').pop();
          const response = await fetch(`${API_BASE}/orders/${numericId}/send-receipt`, {
            method: 'POST',
            headers: api.headers()
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.error);
          toast('Receipt sent successfully', 'success');
        } catch (e) {
          toast('Failed to send receipt: ' + e.message, 'error');
        }
      });
    }

    if ($('btn-more-actions')) {
      $('btn-more-actions').addEventListener('click', () => {
        $('order-more-dropdown').classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-more-actions') && !e.target.closest('#order-more-dropdown')) {
          $('order-more-dropdown').classList.add('hidden');
        }
      });
    }

    document.querySelectorAll('.order-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (!S.selectedOrderFull) return;

        $('order-more-dropdown').classList.add('hidden');
        const numericId = S.selectedOrderFull.id.split('/').pop();

        try {
          switch (action) {
            case 'mark-paid': {
              const confirmed = await window.showConfirmModal('Mark this order as paid?', 'Mark as Paid');
              if (!confirmed) break;
              const paidRes = await fetch(`${API_BASE}/orders/${numericId}/mark-paid`, {
                method: 'POST',
                headers: api.headers()
              });
              const paidData = await paidRes.json();
              if (!paidData.success) throw new Error(paidData.error);
              toast('Order marked as paid', 'success');
              await selectOrder(S.selectedOrderFull.id);
              await loadOrders();
              break;
            }

            case 'edit-note':
              const newNote = prompt('Enter order note:', S.selectedOrderFull.note || '');
              if (newNote === null) return;
              const noteRes = await fetch(`${API_BASE}/orders/${numericId}`, {
                method: 'PUT',
                headers: api.headers(),
                body: JSON.stringify({ note: newNote })
              });
              const noteData = await noteRes.json();
              if (!noteData.success) throw new Error(noteData.error);
              toast('Note updated', 'success');
              await selectOrder(S.selectedOrderFull.id);
              break;

            case 'view-shopify':
              const shopifyUrl = `https://admin.shopify.com/store/skm-exhaust/orders/${numericId}`;
              window.open(shopifyUrl, '_blank');
              break;

            case 'cancel': {
              const confirmed = await window.showConfirmModal('Are you sure you want to cancel this order? This will refund the customer and restock items.', 'Cancel Order');
              if (!confirmed) break;
              const cancelRes = await fetch(`${API_BASE}/orders/${numericId}/cancel`, {
                method: 'POST',
                headers: api.headers(),
                body: JSON.stringify({ reason: 'OTHER', refund: true, restock: true, notifyCustomer: true })
              });
              const cancelData = await cancelRes.json();
              if (!cancelData.success) throw new Error(cancelData.error);
              toast('Order cancelled', 'success');
              // Update local order state immediately before reloading
              if (S.selectedOrder) {
                S.selectedOrder.financialStatus = 'REFUNDED';
                S.selectedOrder.fulfillmentStatus = 'UNFULFILLED';
              }
              // Force a small delay to allow Shopify to update the order status
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadOrders();
              $('order-empty').classList.remove('hidden');
              $('order-detail').classList.add('hidden');
              S.selectedOrder = null;
              S.selectedOrderFull = null;
              break;
            }

            case 'refund':
              openRefundModal();
              break;
          }
        } catch (e) {
          toast('Action failed: ' + e.message, 'error');
        }
      });
    });

    async function openFulfillmentModal() {
      if (!S.selectedOrderFull) return;

      const modal = $('fulfillment-modal');
      const container = $('fulfillment-orders-select');

      try {
        const numericId = S.selectedOrderFull.id.split('/').pop();
        const response = await fetch(`${API_BASE}/orders/${numericId}/fulfillment-orders`, { headers: api.headers() });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        const fulfillmentOrders = data.fulfillmentOrders || [];
        // Include ON_HOLD status as well - user may want to fulfill after releasing hold
        const unfulfilled = fulfillmentOrders.filter(fo =>
          fo.status === 'OPEN' || fo.status === 'IN_PROGRESS' || fo.status === 'ON_HOLD'
        );

        if (unfulfilled.length === 0) {
          // Check if already fulfilled
          const fulfilled = fulfillmentOrders.filter(fo => fo.status === 'CLOSED');
          if (fulfilled.length > 0) {
            toast('All items have already been fulfilled', 'info');
          } else {
            toast('No items to fulfill', 'info');
          }
          return;
        }

        container.innerHTML = unfulfilled.map(fo => `
          <div class="p-3 bg-gray-50 rounded-lg">
            <label class="flex items-start gap-2">
              <input type="checkbox" class="fulfillment-order-check mt-1 rounded border-gray-300 text-red-600" data-fo-id="${fo.id}" checked>
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900">From: ${fo.assignedLocation?.name || 'Default Location'}</p>
                <div class="mt-2 space-y-1">
                  ${fo.lineItems.map(li => `
                    <div class="text-xs text-gray-600 flex justify-between">
                      <span>${li.lineItem?.name || 'Item'}</span>
                      <span>× ${li.remainingQuantity}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </label>
          </div>
        `).join('');

        modal.classList.remove('hidden');
      } catch (e) {
        toast('Failed to load fulfillment orders: ' + e.message, 'error');
      }
    }

    if ($('btn-close-fulfillment')) {
      $('btn-close-fulfillment').addEventListener('click', () => $('fulfillment-modal').classList.add('hidden'));
    }

    if ($('btn-cancel-fulfillment')) {
      $('btn-cancel-fulfillment').addEventListener('click', () => $('fulfillment-modal').classList.add('hidden'));
    }

    if ($('btn-create-fulfillment')) {
      $('btn-create-fulfillment').addEventListener('click', async () => {
        const selectedFOs = Array.from(document.querySelectorAll('.fulfillment-order-check:checked')).map(cb => cb.dataset.foId);

        if (selectedFOs.length === 0) {
          toast('Please select items to fulfill', 'error');
          return;
        }

        const carrier = $('fulfillment-carrier').value;
        const trackingNumber = $('fulfillment-tracking').value;
        const trackingUrl = $('fulfillment-url').value;
        const notifyCustomer = $('fulfillment-notify').checked;

        try {
          const payload = {
            lineItemsByFulfillmentOrder: selectedFOs.map(foId => ({ fulfillmentOrderId: foId })),
            notifyCustomer
          };

          if (carrier || trackingNumber) {
            payload.trackingInfo = {
              company: carrier,
              number: trackingNumber,
              url: trackingUrl || undefined
            };
          }

          const response = await fetch(`${API_BASE}/fulfillments`, {
            method: 'POST',
            headers: api.headers(),
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!data.success) throw new Error(data.error);

          toast('Fulfillment created successfully', 'success');
          $('fulfillment-modal').classList.add('hidden');

          await selectOrder(S.selectedOrderFull.id);
          await loadOrders();

          $('fulfillment-carrier').value = '';
          $('fulfillment-tracking').value = '';
          $('fulfillment-url').value = '';
          $('fulfillment-notify').checked = true;

        } catch (e) {
          toast('Failed to create fulfillment: ' + e.message, 'error');
        }
      });
    }

    if ($('btn-print-packing')) {
      $('btn-print-packing').addEventListener('click', () => {
        if (!S.selectedOrderFull) return;

        const order = S.selectedOrderFull;
        const printWindow = window.open('', '_blank');

        const lineItemsHtml = order.lineItems.map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.sku || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title || item.name}${item.variantTitle ? ` - ${item.variantTitle}` : ''}</td>
          </tr>
        `).join('');

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Packing Slip - ${order.name}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { font-size: 24px; margin-bottom: 20px; }
              .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
              .address { margin-bottom: 20px; }
              .address h3 { font-size: 14px; color: #666; margin-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { text-align: left; padding: 8px; border-bottom: 2px solid #333; }
              .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1>Packing Slip</h1>
                <p><strong>Order:</strong> ${order.name}</p>
                <p><strong>Date:</strong> ${formatDate(order.createdAt)}</p>
              </div>
            </div>
            
            <div class="address">
              <h3>Ship To:</h3>
              ${formatAddress(order.shippingAddress).replace(/<\/?p>/g, '<br>')}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;">Qty</th>
                  <th style="width: 120px;">SKU</th>
                  <th>Item</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>
            
            ${order.note ? `<div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 4px;"><strong>Note:</strong> ${order.note}</div>` : ''}
            
            <div class="footer">
              <p>Thank you for your order!</p>
            </div>
          </body>
          </html>
        `);

        printWindow.document.close();
        printWindow.print();
      });
    }

    // Select order by order number (e.g., "1002" from "#1002")
    function selectOrderByNumber(orderNumber) {
      // Find the order in the list by matching the name (e.g., "#1002")
      const targetName = `#${orderNumber}`;
      const order = S.orders.find(o => o.name === targetName || o.name === orderNumber);

      if (order) {
        selectOrder(order.id);
        toast(`Opened order ${targetName}`, 'success');
      } else {
        // Order not in current list, try to search for it
        S.orderFilters.query = orderNumber;
        loadOrders().then(() => {
          const foundOrder = S.orders.find(o => o.name === targetName || o.name === orderNumber);
          if (foundOrder) {
            selectOrder(foundOrder.id);
            toast(`Opened order ${targetName}`, 'success');
          } else {
            toast(`Order ${targetName} not found`, 'error');
          }
        });
      }
    }

    // ========================================
    // REFUND MODAL HANDLERS
    // ========================================

    let refundCalculation = null; // Store calculation result

    // Open refund modal
    function openRefundModal() {
      if (!S.selectedOrderFull) return;

      const order = S.selectedOrderFull;
      const modal = $('refund-modal');

      // Reset calculation state
      refundCalculation = null;
      $('refund-calculation-summary').classList.add('hidden');
      $('btn-confirm-refund').disabled = true;
      $('btn-confirm-refund').classList.add('bg-gray-400', 'cursor-not-allowed');
      $('btn-confirm-refund').classList.remove('bg-red-600', 'hover:bg-red-700');
      $('refund-btn-text').textContent = 'Refund $0.00';

      // Set fulfillment status
      const statusEl = $('refund-fulfillment-status');
      if (order.displayFulfillmentStatus === 'FULFILLED') {
        statusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700';
        statusEl.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Fulfilled';
      } else if (order.displayFulfillmentStatus === 'PARTIALLY_FULFILLED') {
        statusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700';
        statusEl.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Partially Fulfilled';
      } else {
        statusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700';
        statusEl.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> Unfulfilled';
      }

      // Populate line items
      const lineItemsContainer = $('refund-line-items');
      lineItemsContainer.innerHTML = order.lineItems.map(item => {
        // Price can be nested in shopMoney objects or flat
        const price = parseFloat(item.originalUnitPriceSet?.shopMoney?.amount || item.originalUnitPrice || item.price || 0);
        const discountedPrice = parseFloat(item.discountedUnitPriceSet?.shopMoney?.amount || item.discountedUnitPrice || price);
        const hasDiscount = price !== discountedPrice;
        // Image can be nested as item.image.url or item.variant.image.url or direct URL
        const imageUrl = item.image?.url || item.variant?.image?.url || item.image || 'https://via.placeholder.com/60?text=No+Image';

        return `
          <div class="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg">
            <img src="${imageUrl}" alt="" class="w-14 h-14 rounded-lg object-cover flex-shrink-0" onerror="this.src='https://via.placeholder.com/60?text=No+Image'">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">${item.title || item.name}</p>
              <p class="text-xs text-gray-500">${item.variantTitle || ''}</p>
              <div class="flex items-center gap-2 mt-1">
                ${hasDiscount ? `<span class="text-xs text-gray-400 line-through">$${price.toFixed(2)}</span>` : ''}
                <span class="text-xs text-gray-700">$${discountedPrice.toFixed(2)} × ${item.quantity}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input type="number" class="refund-qty-input w-14 h-8 px-2 text-sm text-center border border-gray-200 rounded" 
                     data-line-item-id="${item.id}" 
                     data-max-qty="${item.quantity}"
                     data-unit-price="${discountedPrice}"
                     value="0" min="0" max="${item.quantity}">
              <span class="text-xs text-gray-500">/ ${item.quantity}</span>
            </div>
            <div class="w-16 text-right">
              <span class="refund-item-total text-sm text-gray-700" data-line-item-id="${item.id}">$0.00</span>
            </div>
          </div>
        `;
      }).join('');

      // Set available refund amount
      const totalPaid = parseFloat(order.totalPrice || 0);
      const totalRefunded = parseFloat(order.totalRefunded || 0);
      const availableForRefund = totalPaid - totalRefunded;

      $('refund-available').textContent = `$${availableForRefund.toFixed(2)} available for refund`;
      $('refund-amount').value = '0.00';
      $('refund-amount').max = availableForRefund;
      $('refund-shipping').value = '0.00';
      $('refund-reason').value = '';
      $('refund-reason-notes').value = '';
      $('refund-restock-type').value = 'return';
      $('refund-notify').checked = true;
      updateRestockTypeDescription();

      // Add event listeners for quantity inputs
      document.querySelectorAll('.refund-qty-input').forEach(input => {
        input.addEventListener('input', updateRefundItemTotals);
      });

      // Add event listener for restock type selector
      $('refund-restock-type').addEventListener('change', updateRestockTypeDescription);

      modal.classList.remove('hidden');
    }

    // Update restock type description based on selection
    function updateRestockTypeDescription() {
      const restockType = $('refund-restock-type').value;
      const descEl = $('restock-type-description');

      switch (restockType) {
        case 'return':
          descEl.textContent = 'Items will be returned to inventory at the original location.';
          break;
        case 'no_restock':
          descEl.textContent = 'Items will NOT be returned to inventory. Use for damaged/unsellable items.';
          break;
        case 'cancel':
          descEl.textContent = 'Items will be restocked and the order line items will be cancelled.';
          break;
        default:
          descEl.textContent = '';
      }
    }

    // Update item totals when quantities change
    function updateRefundItemTotals() {
      let totalItems = 0;
      let totalAmount = 0;

      document.querySelectorAll('.refund-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        const unitPrice = parseFloat(input.dataset.unitPrice) || 0;
        const lineItemId = input.dataset.lineItemId;
        const itemTotal = qty * unitPrice;

        // Update item total display
        const totalEl = document.querySelector(`.refund-item-total[data-line-item-id="${lineItemId}"]`);
        if (totalEl) {
          totalEl.textContent = `$${itemTotal.toFixed(2)}`;
        }

        if (qty > 0) totalItems++;
        totalAmount += itemTotal;
      });

      // Update summary
      $('refund-items-selected').textContent = totalItems > 0 ? `${totalItems} item(s) selected` : 'No items selected';
      $('refund-amount').value = totalAmount.toFixed(2);

      // Reset calculation when items change
      refundCalculation = null;
      $('refund-calculation-summary').classList.add('hidden');
      $('btn-confirm-refund').disabled = true;
      $('btn-confirm-refund').classList.add('bg-gray-400', 'cursor-not-allowed');
      $('btn-confirm-refund').classList.remove('bg-red-600', 'hover:bg-red-700');
      $('refund-btn-text').textContent = 'Refund $0.00';
    }

    // Calculate refund (Stage 1)
    async function calculateRefund() {
      if (!S.selectedOrderFull) return;

      const refundLineItems = [];
      document.querySelectorAll('.refund-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
          refundLineItems.push({
            lineItemId: input.dataset.lineItemId,
            quantity: qty
          });
        }
      });

      const shippingAmount = parseFloat($('refund-shipping').value) || 0;

      if (refundLineItems.length === 0 && shippingAmount === 0) {
        toast('Please select items to refund or enter a shipping refund amount', 'error');
        return;
      }

      try {
        $('btn-calculate-refund').disabled = true;
        $('btn-calculate-refund').textContent = 'Calculating...';

        const numericId = S.selectedOrderFull.id.split('/').pop();
        const response = await fetch(`${API_BASE}/orders/${numericId}/refund/calculate`, {
          method: 'POST',
          headers: api.headers(),
          body: JSON.stringify({
            refundLineItems,
            restockType: $('refund-restock-type').value.toUpperCase(),
            shipping: { amount: shippingAmount },
            currency: 'USD'
          })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        refundCalculation = data.calculation;

        // Update calculation summary
        $('refund-calc-subtotal').textContent = `$${refundCalculation.subtotal.toFixed(2)}`;
        $('refund-calc-tax').textContent = `$${refundCalculation.totalTax.toFixed(2)}`;
        $('refund-calc-shipping').textContent = `$${refundCalculation.shippingRefund.toFixed(2)}`;
        $('refund-calc-total').textContent = `$${refundCalculation.totalRefund.toFixed(2)}`;

        $('refund-calculation-summary').classList.remove('hidden');

        // Enable confirm button
        $('btn-confirm-refund').disabled = false;
        $('btn-confirm-refund').classList.remove('bg-gray-400', 'cursor-not-allowed');
        $('btn-confirm-refund').classList.add('bg-red-600', 'hover:bg-red-700');
        $('refund-btn-text').textContent = `Refund $${refundCalculation.totalRefund.toFixed(2)}`;

        toast('Refund calculated. Review and confirm.', 'success');

      } catch (e) {
        toast('Failed to calculate refund: ' + e.message, 'error');
      } finally {
        $('btn-calculate-refund').disabled = false;
        $('btn-calculate-refund').textContent = 'Calculate';
      }
    }

    // Execute refund (Stage 2)
    async function executeRefund() {
      if (!S.selectedOrderFull || !refundCalculation) return;

      const refundLineItems = [];
      document.querySelectorAll('.refund-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
          refundLineItems.push({
            lineItemId: input.dataset.lineItemId,
            quantity: qty,
            restockType: $('refund-restock-type').value.toUpperCase()
          });
        }
      });

      const reason = $('refund-reason').value;
      const reasonNotes = $('refund-reason-notes').value;
      const note = reason ? `${reason}${reasonNotes ? ': ' + reasonNotes : ''}` : reasonNotes;

      try {
        // Show loading state
        $('btn-confirm-refund').disabled = true;
        $('refund-btn-text').classList.add('hidden');
        $('refund-btn-loading').classList.remove('hidden');

        const numericId = S.selectedOrderFull.id.split('/').pop();
        // Get location ID from order's fulfillment orders for restocking
        const locationId = S.selectedOrderFull.fulfillmentOrders?.[0]?.assignedLocation?.location?.id
          || S.selectedOrderFull.fulfillmentOrders?.[0]?.assignedLocation?.id
          || null;

        // Get parent transaction ID for refund (find the SALE or CAPTURE transaction)
        const parentTransaction = S.selectedOrderFull.transactions?.find(t =>
          t.kind === 'SALE' || t.kind === 'CAPTURE'
        );
        const parentTransactionId = parentTransaction?.id || null;
        const gateway = parentTransaction?.gateway || 'manual';

        console.log('[Refund] Transactions:', S.selectedOrderFull.transactions);
        console.log('[Refund] Parent transaction:', parentTransaction);
        console.log('[Refund] Parent ID:', parentTransactionId, 'Gateway:', gateway);

        // Get restock type from selector
        const restockType = $('refund-restock-type').value.toUpperCase();

        // Include unit prices for refund amount calculation
        const refundLineItemsWithPrices = refundLineItems.map(item => {
          const input = document.querySelector(`.refund-qty-input[data-line-item-id="${item.lineItemId}"]`);
          const unitPrice = input ? parseFloat(input.dataset.unitPrice) || 0 : 0;
          return {
            ...item,
            restockType: restockType,
            unitPrice: unitPrice
          };
        });

        // Calculate total refund amount
        const shippingRefund = parseFloat($('refund-shipping').value) || 0;
        const itemsTotal = refundLineItemsWithPrices.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        // Use the refund-amount input field if items total is 0 (fallback)
        const manualRefundAmount = parseFloat($('refund-amount').value) || 0;
        const totalRefundAmount = itemsTotal > 0 ? (itemsTotal + shippingRefund) : (manualRefundAmount + shippingRefund);

        console.log('[Refund] Items total:', itemsTotal, 'Manual amount:', manualRefundAmount, 'Total:', totalRefundAmount);

        const response = await fetch(`${API_BASE}/orders/${numericId}/refund`, {
          method: 'POST',
          headers: api.headers(),
          body: JSON.stringify({
            refundLineItems: refundLineItemsWithPrices,
            restockType: restockType,
            shipping: { amount: shippingRefund },
            note,
            notifyCustomer: $('refund-notify').checked,
            currency: 'USD',
            locationId,
            calculatedRefund: refundCalculation ? { refund: totalRefundAmount } : null,
            totalRefundAmount: totalRefundAmount,
            parentTransactionId: parentTransactionId,
            gateway: gateway
          })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        // Display refund amount properly
        const refundAmount = parseFloat(data.refund.totalRefunded || 0).toFixed(2);
        toast(`Refund of $${refundAmount} processed successfully`, 'success');
        $('refund-modal').classList.add('hidden');

        // Refresh order data
        await selectOrder(S.selectedOrderFull.id);
        await loadOrders();

      } catch (e) {
        toast('Failed to process refund: ' + e.message, 'error');
      } finally {
        $('btn-confirm-refund').disabled = false;
        $('refund-btn-text').classList.remove('hidden');
        $('refund-btn-loading').classList.add('hidden');
      }
    }

    // Refund modal event listeners
    if ($('btn-refund-order')) {
      $('btn-refund-order').addEventListener('click', openRefundModal);
    }

    if ($('btn-close-refund')) {
      $('btn-close-refund').addEventListener('click', () => $('refund-modal').classList.add('hidden'));
    }

    if ($('btn-cancel-refund')) {
      $('btn-cancel-refund').addEventListener('click', () => $('refund-modal').classList.add('hidden'));
    }

    if ($('btn-calculate-refund')) {
      $('btn-calculate-refund').addEventListener('click', calculateRefund);
    }

    if ($('btn-confirm-refund')) {
      $('btn-confirm-refund').addEventListener('click', executeRefund);
    }

    // Return loadOrders so it can be called from main script
    return { loadOrders, selectOrderByNumber };
  }

  // Expose to window
  window.initOrderManagement = initOrderManagement;

})(window);
