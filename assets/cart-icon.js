import { Component } from '@theme/component';
import { onAnimationEnd } from '@theme/utilities';
import { ThemeEvents } from '@theme/events';

/**
 * A custom element that displays a cart icon.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} cartBubble - The cart bubble element.
 * @property {HTMLElement} cartBubbleText - The cart bubble text element.
 * @property {HTMLElement} cartBubbleCount - The cart bubble count element.
 *
 * @extends {Component<Refs>}
 */
class CartIcon extends Component {
  requiredRefs = ['cartBubble', 'cartBubbleText', 'cartBubbleCount'];

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener(ThemeEvents.cartUpdate, this.onCartUpdate);
    window.addEventListener('pageshow', this.onPageShow);
    this.ensureCartBubbleIsCorrect();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener(ThemeEvents.cartUpdate, this.onCartUpdate);
    window.removeEventListener('pageshow', this.onPageShow);
  }

  /**
   * Handles the page show event when the page is restored from cache.
   * @param {PageTransitionEvent} event - The page show event.
   */
  onPageShow = (event) => {
    if (event.persisted) {
      this.ensureCartBubbleIsCorrect();
    }
  };

  /**
   * Handles the cart update event.
   * @param {CartUpdateEvent} event - The cart update event.
   */
  onCartUpdate = () => {
    this.updateCartCount();
  };

  /**
   * Fetches the latest cart state and updates the bubble.
   */
  updateCartCount = async () => {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/cart.js?t=${Date.now()}`, {
        cache: 'no-store', 
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const cart = await response.json();
      this.renderCartBubble(cart.item_count);
    } catch (error) {
      console.error('Failed to update cart count:', error);
    }
  };

  /**
   * Renders the cart bubble.
   * @param {number} itemCount - The total number of items in the cart.
   * @param {boolean} animate - Whether to animate the bubble.
   */
  renderCartBubble = async (itemCount, animate = true) => {
    const count = parseInt(itemCount, 10) || 0;
    const hasItems = count > 0;

    // 1. Update text content
    if (this.refs.cartBubbleCount) {
      this.refs.cartBubbleCount.textContent = count;
      
      // 2. Force visibility toggle
      if (hasItems) {
        this.refs.cartBubbleCount.classList.remove('hidden');
        this.refs.cartBubble.classList.remove('visually-hidden');
        this.classList.add('header-actions__cart-icon--has-cart');
      } else {
        this.refs.cartBubbleCount.classList.add('hidden');
        this.refs.cartBubble.classList.add('visually-hidden');
        this.classList.remove('header-actions__cart-icon--has-cart');
      }
    }

    // 3. Update Session Storage
    sessionStorage.setItem(
      'cart-count',
      JSON.stringify({
        value: String(count),
        timestamp: Date.now(),
      })
    );

    // 4. Animation
    if (animate && hasItems && this.refs.cartBubbleText) {
      this.refs.cartBubble.classList.add('cart-bubble--animating');
      await onAnimationEnd(this.refs.cartBubbleText);
      this.refs.cartBubble.classList.remove('cart-bubble--animating');
    }
  };

  /**
   * Checks if the cart count is correct on load/restore.
   */
  ensureCartBubbleIsCorrect = () => {
    if (!this.refs.cartBubbleCount) return;

    // 1. Try Session Storage first for immediate visual sync
    const sessionStorageCount = sessionStorage.getItem('cart-count');
    if (sessionStorageCount) {
      try {
        const { value } = JSON.parse(sessionStorageCount);
        const count = parseInt(value, 10);
        if (!isNaN(count)) {
           // Don't animate on restore
           this.renderCartBubble(count, false); 
        }
      } catch (e) {
        // ignore error
      }
    }

    // 2. Double check with server to be sure (optional, but good for robustness)
    this.updateCartCount();
  };
}

if (!customElements.get('cart-icon')) {
  customElements.define('cart-icon', CartIcon);
}
