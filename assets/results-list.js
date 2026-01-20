import { mediaQueryLarge, requestIdleCallback, startViewTransition } from '@theme/utilities';
import PaginatedList from '@theme/paginated-list';

/**
 * A custom element that renders a pagniated results list
 */
export default class ResultsList extends PaginatedList {
  connectedCallback() {
    super.connectedCallback();

    mediaQueryLarge.addEventListener('change', this.#handleMediaQueryChange);
    this.setAttribute('initialized', '');
    this.filterResultsByVehicle();
  }

  disconnectedCallback() {
    mediaQueryLarge.removeEventListener('change', this.#handleMediaQueryChange);
  }

  /**
   * Updates the layout.
   *
   * @param {Event} event
   */
  updateLayout({ target }) {
    if (!(target instanceof HTMLInputElement)) return;

    this.#animateLayoutChange(target.value);
  }

  /**
   * Sets the layout.
   *
   * @param {string} value
   */
  #animateLayoutChange = async (value) => {
    const { grid } = this.refs;

    if (!grid) return;

    await startViewTransition(() => this.#setLayout(value), ['product-grid']);

    requestIdleCallback(() => {
      const viewport = mediaQueryLarge.matches ? 'desktop' : 'mobile';
      sessionStorage.setItem(`product-grid-view-${viewport}`, value);
    });
  };

  /**
   * Animates the layout change.
   *
   * @param {string} value
   */
  #setLayout(value) {
    const { grid } = this.refs;
    if (!grid) return;
    grid.setAttribute('product-grid-view', value);
  }

  /**
   * Handles the media query change event.
   *
   * @param {MediaQueryListEvent} event
   */
  #handleMediaQueryChange = (event) => {
    const targetElement = event.matches
      ? this.querySelector('[data-grid-layout="desktop-default-option"]')
      : this.querySelector('[data-grid-layout="mobile-option"]');

    if (!(targetElement instanceof HTMLInputElement)) return;

    targetElement.checked = true;
    this.#setLayout('default');
  };

  /**
   * Filter and reorder results based on selected vehicle
   */
  async filterResultsByVehicle() {
    // 1. Check if vehicle is selected
    const VEHICLE_KEY = 'skm_garage_vehicle';
    let vehicle = null;
    try {
      vehicle = JSON.parse(localStorage.getItem(VEHICLE_KEY) || 'null');
    } catch { }

    const notice = this.querySelector('#vehicle-filter-notice');
    const noticeMessage = this.querySelector('#vehicle-filter-message');

    // Reset notice
    if (notice) notice.classList.add('hidden');

    if (!vehicle || !vehicle.id) return;

    // 2. Get all displayed products (target only the direct grid items)
    const productItems = Array.from(this.querySelectorAll('.product-grid__item[data-product-id]'));
    if (productItems.length === 0) return;

    const productIds = productItems.map(item => item.dataset.productId).filter(Boolean);

    // 3. Call API to check fitment
    try {
      const response = await fetch(`https://skm-inventory-api.miaotingshuo.workers.dev/products/check-vehicle-fit?vehicleId=${vehicle.id}&productIds=${productIds.join(',')}`);

      if (!response.ok) {
        console.warn('Vehicle fitment check failed:', response.status);
        return;
      }

      const data = await response.json();

      // Ensure data has the expected structure
      const fits = data && Array.isArray(data.fits) ? data.fits : [];
      // const notFits = data && Array.isArray(data.notFits) ? data.notFits : [];

      // 4. Handle results
      if (fits.length === 0) {
        // CASE: No matches for vehicle
        if (notice && noticeMessage) {
          const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
          noticeMessage.textContent = `No matching results for your ${vehicleName}, showing all related products.`;
          notice.classList.remove('hidden');
        }
      } else {
        // CASE: Some matches - Reorder DOM
        const fitItems = [];
        const notFitItems = [];

        productItems.forEach(item => {
          const pid = item.dataset.productId;
          if (fits.includes(pid)) {
            fitItems.push(item);
            item.style.order = '-1';
          } else {
            notFitItems.push(item);
            item.style.order = '0';
          }
        });

        // Ensure parent is flex/grid to support order property or re-append
        const parent = productItems[0].parentElement;
        if (parent) {
          // For grid layout, 'order' property works if the direct children are the items
          // If not, we might need to physically re-sort DOM nodes
          fitItems.forEach(item => parent.insertBefore(item, parent.firstChild));
        }
      }

    } catch (e) {
      console.error('Failed to check vehicle fitment:', e);
    }
  }
}

if (!customElements.get('results-list')) {
  customElements.define('results-list', ResultsList);
}
