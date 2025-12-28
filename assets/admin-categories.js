/**
 * Admin Categories - Product Type Combo-Box Component
 * Handles category fetching and product type selection in admin dashboard
 */

const CATEGORIES_API = 'https://skm-inventory-api.miaotingshuo.workers.dev/categories';

// Store fetched categories globally
let cachedCategories = [];

/**
 * Fetch categories from API
 */
async function fetchCategories() {
    if (cachedCategories.length > 0) {
        return cachedCategories;
    }

    try {
        const res = await fetch(CATEGORIES_API);
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        cachedCategories = data.data || [];
        return cachedCategories;
    } catch (e) {
        console.error('Error fetching categories:', e);
        return [];
    }
}

/**
 * Create a combo-box for product type selection
 * @param {HTMLElement} container - Container element to render into
 * @param {string} inputId - ID for the hidden input that stores the value
 * @param {string} initialValue - Initial selected value
 */
async function initProductTypeComboBox(container, inputId, initialValue = '') {
    const categories = await fetchCategories();

    // Create the combo-box HTML
    const html = `
    <div class="category-combobox relative">
      <input type="hidden" id="${inputId}" value="${initialValue}">
      <div class="category-input-wrapper relative">
        <input 
          type="text" 
          id="${inputId}-display" 
          class="category-display-input w-full h-10 px-3 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-500"
          placeholder="Select or type a product type..."
          value="${initialValue}"
          autocomplete="off"
        >
        <button type="button" class="category-dropdown-btn absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>
      <div class="category-dropdown hidden absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
        ${categories.length > 0 ?
            categories.map(cat => `
            <div class="category-option px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center justify-between" data-value="${cat.name}">
              <span>${cat.name}</span>
              <span class="text-xs text-gray-400">${cat.count} products</span>
            </div>
          `).join('') :
            '<div class="px-3 py-2 text-sm text-gray-400">No categories yet. Type to create one.</div>'
        }
      </div>
    </div>
  `;

    container.innerHTML = html;

    // Setup event handlers
    const displayInput = container.querySelector(`#${inputId}-display`);
    const hiddenInput = container.querySelector(`#${inputId}`);
    const dropdown = container.querySelector('.category-dropdown');
    const dropdownBtn = container.querySelector('.category-dropdown-btn');

    // Toggle dropdown on button click
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // Show dropdown on input focus
    displayInput.addEventListener('focus', () => {
        dropdown.classList.remove('hidden');
        filterOptions('');
    });

    // Filter options on input
    displayInput.addEventListener('input', (e) => {
        const value = e.target.value;
        hiddenInput.value = value;
        filterOptions(value);
        dropdown.classList.remove('hidden');
    });

    // Select option on click
    container.querySelectorAll('.category-option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            displayInput.value = value;
            hiddenInput.value = value;
            dropdown.classList.add('hidden');
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Filter function
    function filterOptions(query) {
        const lowerQuery = query.toLowerCase();
        container.querySelectorAll('.category-option').forEach(option => {
            const value = option.dataset.value.toLowerCase();
            option.style.display = value.includes(lowerQuery) ? 'flex' : 'none';
        });
    }
}

/**
 * Initialize all product type combo-boxes on the page
 */
function initAllProductTypeComboBoxes() {
    // Product Editor - edit-type
    const editTypeContainer = document.getElementById('edit-type-container');
    if (editTypeContainer) {
        const currentValue = document.getElementById('edit-type')?.value || '';
        initProductTypeComboBox(editTypeContainer, 'edit-type', currentValue);
    }

    // New Product Form - new-type
    const newTypeContainer = document.getElementById('new-type-container');
    if (newTypeContainer) {
        initProductTypeComboBox(newTypeContainer, 'new-type', '');
    }
}

/**
 * Refresh the combo-box with a new value (called when loading a product)
 */
async function refreshProductTypeComboBox(inputId, value) {
    const container = document.getElementById(`${inputId}-container`);
    if (container) {
        await initProductTypeComboBox(container, inputId, value);
    }
}

/**
 * Render the Product Types list (read-only display)
 */
async function renderTypesList() {
    const typesList = document.getElementById('types-list');
    if (!typesList) return;

    // Force refresh cache
    cachedCategories = [];
    const categories = await fetchCategories();

    if (categories.length === 0) {
        typesList.innerHTML = '<div class="text-xs text-gray-400 text-center py-3">No product types yet. Set a type on a product to see it here.</div>';
        return;
    }

    let html = '';
    categories.forEach(cat => {
        html += `
        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
          <span class="text-sm text-gray-700">${cat.name}</span>
          <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${cat.count}</span>
        </div>
        `;
    });

    typesList.innerHTML = html;
}

/**
 * Setup Product Types display panel
 */
function setupTypesManagement() {
    const refreshBtn = document.getElementById('btn-refresh-types');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            cachedCategories = [];
            await renderTypesList();
        });
    }

    // Initial render
    renderTypesList();
}

// Export for use in admin dashboard
window.AdminCategories = {
    fetchCategories,
    initProductTypeComboBox,
    initAllProductTypeComboBoxes,
    refreshProductTypeComboBox,
    renderTypesList,
    setupTypesManagement
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initAllProductTypeComboBoxes();
        setupTypesManagement();
    });
} else {
    initAllProductTypeComboBoxes();
    setupTypesManagement();
}
