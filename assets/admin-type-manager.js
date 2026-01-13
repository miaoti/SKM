/**
 * Admin Type Manager - Product Type Management Sub-Tab
 * Handles CRUD operations for product types in the admin dashboard
 */

const TYPES_API = 'https://skm-inventory-api.miaotingshuo.workers.dev/types';

class TypeManager {
  constructor() {
    this.types = [];
    this.adminKey = null;
    this.container = null;
    this.modal = null;
  }

  /**
   * Initialize the Type Manager
   * @param {string} adminKey - Admin API key
   * @param {HTMLElement} container - Container element to render into
   */
  init(adminKey, container) {
    this.adminKey = adminKey;
    this.container = container;
    this.createEditModal();
    this.createAddModal();
    this.render();
    this.loadTypes();
  }

  /**
   * Create the edit modal
   */
  createEditModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('type-edit-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('dialog');
    modal.id = 'type-edit-modal';
    modal.className = 'fixed inset-0 z-[5000] bg-transparent p-4 m-auto w-full max-w-md backdrop:bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl overflow-hidden">
        <div class="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
          <h3 class="font-semibold" id="type-modal-title">Edit Product Type</h3>
          <button type="button" id="type-modal-close" class="text-gray-400 hover:text-white">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form id="type-edit-form" class="p-5 space-y-4">
          <input type="hidden" id="type-old-name">
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Current Name</label>
            <div id="type-current-name" class="text-sm text-gray-900 font-medium bg-gray-50 px-3 py-2 rounded-lg border border-gray-200"></div>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">New Name</label>
            <input type="text" id="type-new-name" class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-500" placeholder="Enter new type name" required>
          </div>
          <div id="type-product-warning" class="hidden flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p class="text-xs text-amber-800">This will update <strong id="type-product-count">0</strong> product(s).</p>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="type-modal-cancel" class="h-9 px-4 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" id="type-modal-save" class="h-9 px-4 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2">
              <span>Save Changes</span>
              <svg id="type-save-spinner" class="hidden w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    this.modal = modal;

    // Event listeners
    modal.querySelector('#type-modal-close').addEventListener('click', () => this.closeModal());
    modal.querySelector('#type-modal-cancel').addEventListener('click', () => this.closeModal());
    modal.querySelector('#type-edit-form').addEventListener('submit', (e) => this.handleSave(e));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });
  }

  /**
   * Create the add new type modal
   */
  createAddModal() {
    const existingModal = document.getElementById('type-add-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('dialog');
    modal.id = 'type-add-modal';
    modal.className = 'fixed inset-0 z-[5000] bg-transparent p-4 m-auto w-full max-w-md backdrop:bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl overflow-hidden">
        <div class="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
          <h3 class="font-semibold">Add New Product Type</h3>
          <button type="button" id="type-add-modal-close" class="text-gray-400 hover:text-white">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form id="type-add-form" class="p-5 space-y-4">
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Type Name</label>
            <input type="text" id="type-add-name" class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-500" placeholder="Enter type name (e.g. Headers, Intake)" required>
          </div>
          <div class="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <svg class="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-xs text-blue-800">New types are saved locally. Assign this type to a product to make it permanent.</p>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="type-add-cancel" class="h-9 px-4 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" id="type-add-save" class="h-9 px-4 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Add Type</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    this.addModal = modal;

    modal.querySelector('#type-add-modal-close').addEventListener('click', () => this.addModal.close());
    modal.querySelector('#type-add-cancel').addEventListener('click', () => this.addModal.close());
    modal.querySelector('#type-add-form').addEventListener('submit', (e) => this.handleAddType(e));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.addModal.close();
    });
  }

  /**
   * Render the main Types panel
   */
  render() {
    this.container.innerHTML = `
      <div class="space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Product Types</h2>
            <p class="text-sm text-gray-500">Manage product categories and types</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-add-new-type" class="h-9 px-3 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Add Type
            </button>
            <button id="btn-refresh-types-list" class="h-9 px-3 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <!-- Types Table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left">
              <tr>
                <th class="px-4 py-3 font-medium text-gray-600">Type Name</th>
                <th class="px-4 py-3 font-medium text-gray-600 text-center w-24">Products</th>
                <th class="px-4 py-3 font-medium text-gray-600 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody id="types-table-body" class="divide-y divide-gray-100">
              <tr>
                <td colspan="3" class="px-4 py-8 text-center text-gray-400">
                  <div class="w-5 h-5 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-2"></div>
                  Loading types...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Info Note -->
        <div class="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <svg class="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-xs text-gray-600">Types are derived from products. To add a new type, set it on a product. Types with products cannot be deleted.</p>
        </div>
      </div>
    `;

    // Attach event listeners
    this.container.querySelector('#btn-refresh-types-list').addEventListener('click', () => this.loadTypes());
    this.container.querySelector('#btn-add-new-type').addEventListener('click', () => this.openAddModal());
  }

  /**
   * Get pending types from localStorage
   */
  getPendingTypes() {
    try {
      return JSON.parse(localStorage.getItem('skm_pending_types') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Save pending types to localStorage
   */
  savePendingTypes(types) {
    localStorage.setItem('skm_pending_types', JSON.stringify(types));
  }

  /**
   * Open add modal
   */
  openAddModal() {
    document.getElementById('type-add-name').value = '';
    this.addModal.showModal();
    document.getElementById('type-add-name').focus();
  }

  /**
   * Handle add type
   */
  handleAddType(e) {
    e.preventDefault();
    const name = document.getElementById('type-add-name').value.trim();
    if (!name) return;

    // Check if type already exists
    if (this.types.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      this.showToast(`Type "${name}" already exists`, 'error');
      return;
    }

    // Add to pending types
    const pending = this.getPendingTypes();
    if (!pending.includes(name)) {
      pending.push(name);
      this.savePendingTypes(pending);
    }

    // Add to current list and re-render
    this.types.push({ name, count: 0, canDelete: true, pending: true });
    this.renderTable();

    this.showToast(`Type "${name}" added. Assign it to a product to make it permanent.`, 'success');
    this.addModal.close();

    // Refresh admin-categories combo-box cache
    if (window.AdminCategories) {
      window.AdminCategories.cachedCategories = [];
    }
  }

  /**
   * Load types from API
   */
  async loadTypes() {
    const tbody = this.container.querySelector('#types-table-body');
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-8 text-center text-gray-400">
          <div class="w-5 h-5 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-2"></div>
          Loading types...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(TYPES_API, {
        headers: { 'X-Admin-Key': this.adminKey }
      });
      if (!res.ok) throw new Error('Failed to fetch types');
      const data = await res.json();
      this.types = data.data || [];

      // Merge in pending types that aren't yet in the API response
      const pending = this.getPendingTypes();
      pending.forEach(name => {
        if (!this.types.some(t => t.name.toLowerCase() === name.toLowerCase())) {
          this.types.push({ name, count: 0, canDelete: true, pending: true });
        }
      });

      // Clean up pending types that now exist in API
      const updatedPending = pending.filter(name =>
        !data.data.some(t => t.name.toLowerCase() === name.toLowerCase())
      );
      this.savePendingTypes(updatedPending);

      this.renderTable();
    } catch (e) {
      console.error('Error loading types:', e);
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="px-4 py-8 text-center text-red-500">
            Failed to load types. Please try again.
          </td>
        </tr>
      `;
    }
  }

  /**
   * Render the types table
   */
  renderTable() {
    const tbody = this.container.querySelector('#types-table-body');

    if (this.types.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="px-4 py-8 text-center text-gray-400">
            No product types found. Set a type on a product to see it here.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.types.map(type => `
      <tr class="hover:bg-gray-50" data-type="${this.escapeHtml(type.name)}">
        <td class="px-4 py-3">
          <span class="font-medium text-gray-900">${this.escapeHtml(type.name)}</span>
          ${type.pending ? '<span class="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>' : ''}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${type.count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}">
            ${type.count}
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          <button class="type-edit-btn text-xs text-red-600 hover:text-red-700 font-medium mr-3" data-type="${this.escapeHtml(type.name)}" data-count="${type.count}">
            Edit
          </button>
          <button 
            class="type-delete-btn text-xs font-medium ${type.count > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-red-600'}" 
            data-type="${this.escapeHtml(type.name)}" 
            data-count="${type.count}"
            ${type.count > 0 ? 'disabled title="Cannot delete: has products"' : ''}
          >
            Delete
          </button>
        </td>
      </tr>
    `).join('');

    // Attach edit/delete listeners
    tbody.querySelectorAll('.type-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.type, parseInt(btn.dataset.count)));
    });
    tbody.querySelectorAll('.type-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleDelete(btn.dataset.type, parseInt(btn.dataset.count)));
    });
  }

  /**
   * Open edit modal
   */
  openEditModal(typeName, productCount) {
    document.getElementById('type-old-name').value = typeName;
    document.getElementById('type-current-name').textContent = typeName;
    document.getElementById('type-new-name').value = typeName;

    const warning = document.getElementById('type-product-warning');
    if (productCount > 0) {
      document.getElementById('type-product-count').textContent = productCount;
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }

    this.modal.showModal();
    document.getElementById('type-new-name').focus();
    document.getElementById('type-new-name').select();
  }

  /**
   * Close modal
   */
  closeModal() {
    this.modal.close();
  }

  /**
   * Handle save
   */
  async handleSave(e) {
    e.preventDefault();

    const oldName = document.getElementById('type-old-name').value;
    const newName = document.getElementById('type-new-name').value.trim();

    if (!newName) {
      this.showToast('Please enter a type name', 'error');
      return;
    }

    if (oldName === newName) {
      this.closeModal();
      return;
    }

    const saveBtn = document.getElementById('type-modal-save');
    const spinner = document.getElementById('type-save-spinner');
    saveBtn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const res = await fetch(`${TYPES_API}/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: {
          'X-Admin-Key': this.adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename type');

      this.showToast(data.message || `Renamed "${oldName}" to "${newName}"`, 'success');
      this.closeModal();
      this.loadTypes();
    } catch (e) {
      console.error('Error renaming type:', e);
      this.showToast(e.message || 'Failed to rename type', 'error');
    } finally {
      saveBtn.disabled = false;
      spinner.classList.add('hidden');
    }
  }

  /**
   * Handle delete
   */
  async handleDelete(typeName, productCount) {
    if (productCount > 0) {
      this.showToast(`Cannot delete "${typeName}" - it has ${productCount} product(s)`, 'error');
      return;
    }

    if (!confirm(`Delete type "${typeName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${TYPES_API}/${encodeURIComponent(typeName)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': this.adminKey }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete type');

      this.showToast(data.message || `Deleted "${typeName}"`, 'success');
      this.loadTypes();
    } catch (e) {
      console.error('Error deleting type:', e);
      this.showToast(e.message || 'Failed to delete type', 'error');
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Check if there's a global toast function
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    // Fallback simple toast
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white text-sm z-[6000] ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800'
      }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in admin dashboard
window.TypeManager = TypeManager;
