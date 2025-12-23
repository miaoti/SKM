class HeaderPrecision extends HTMLElement {
  constructor() {
    super();
    this.headerContainer = this.querySelector('.header-container');
    this.transparent = this.dataset.transparent === 'true';
    // Dynamic Alert Line Height
    const alertLine = document.getElementById('PrecisionAlertLine');
    this.alertLineHeight = alertLine ? alertLine.offsetHeight : 36;
    // Cart count element
    this.cartCountElement = null;
  }

  connectedCallback() {
    // Get cart count element
    this.cartCountElement = this.querySelector('#precision-cart-count');
    
    // Re-measure on resize to handle wrapping text changes
    window.addEventListener('resize', () => {
      const alertLine = document.getElementById('PrecisionAlertLine');
      if (alertLine) {
        this.alertLineHeight = alertLine.offsetHeight;
        // Trigger position update immediately
        const scrollY = window.scrollY;
        const newTop = Math.max(0, this.alertLineHeight - scrollY);
        this.style.top = `${newTop}px`;
      }
    });
    // Initialize Scroll Observer for transparency toggle
    if (this.transparent) {
      this.initTransparencyObserver();
    }

    // Initialize Sticky Position Logic
    this.initStickyLogic();
    
    // Listen for cart updates
    this.initCartUpdateListener();
  }
  
  initCartUpdateListener() {
    // Listen for the theme's cart:update event
    document.addEventListener('cart:update', () => {
      this.updateCartCount();
    });
    
    // Also check on page show (back/forward navigation)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        this.updateCartCount();
      }
    });
  }
  
  async updateCartCount() {
    if (!this.cartCountElement) {
      this.cartCountElement = this.querySelector('#precision-cart-count');
    }
    if (!this.cartCountElement) return;
    
    try {
      const response = await fetch(`/cart.js?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const cart = await response.json();
      const count = cart.item_count || 0;
      
      // Update the count display
      this.cartCountElement.textContent = count;
      this.cartCountElement.dataset.cartCount = count;
      
      // Show/hide based on count
      if (count > 0) {
        this.cartCountElement.classList.remove('hidden');
        // Add a pop animation
        this.cartCountElement.style.transform = 'scale(1.3)';
        setTimeout(() => {
          this.cartCountElement.style.transform = 'scale(1)';
        }, 150);
      } else {
        this.cartCountElement.classList.add('hidden');
      }
    } catch (error) {
      console.error('Failed to update precision header cart count:', error);
    }
  }

  initTransparencyObserver() {
    const options = {
      root: null,
      threshold: 0,
      rootMargin: '0px'
    };

    const observerTarget = document.createElement('div');
    observerTarget.style.position = 'absolute';
    observerTarget.style.top = '0';
    observerTarget.style.height = '1px';
    observerTarget.style.width = '100%';
    document.body.prepend(observerTarget);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          this.classList.add('scrolled');
        } else {
          this.classList.remove('scrolled');
        }
      });
    }, options);

    observer.observe(observerTarget);
  }

  initStickyLogic() {
    // Logic: 
    // Header is position: fixed.
    // Initial top = alertLineHeight.
    // As we scroll, top decreases until 0.
    
    const updatePosition = () => {
      const scrollY = window.scrollY;
      const newTop = Math.max(0, this.alertLineHeight - scrollY);
      this.style.top = `${newTop}px`;
    };

    window.addEventListener('scroll', updatePosition, { passive: true });
    updatePosition(); // Initial call
  }
}

customElements.define('header-precision', HeaderPrecision);