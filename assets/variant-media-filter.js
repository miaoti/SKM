// @ts-nocheck
/**
 * Variant Media Filter
 * Filters product gallery images based on selected variant options
 * Images are tagged via alt text with option values (e.g., "Aluminum", "Steel")
 */
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Selectors - adjust these to match your theme
    variantSelector: '[data-variant-id], .product-form__input input[type="radio"], select[name*="option"]',
    galleryContainer: '.product__media-list, .product-media-container, [data-product-media-container]',
    mediaItem: '.product__media-item, .product-media, [data-product-media]',
    thumbnailContainer: '.product__media-thumbnails, .thumbnail-list',
    thumbnailItem: '.product__media-thumbnail, .thumbnail',
    
    // Animation
    fadeOutDuration: 150,
    fadeInDuration: 200,
    
    // Behavior
    showAllWhenNoMatch: true, // Show all images if no tagged images match
    hideUntagged: false // Hide images without tags when filtering
  };

  // State
  let currentProduct = null;
  let selectedOptions = {};

  /**
   * Initialize the variant media filter
   */
  function init() {
    // Get product data from the page
    currentProduct = getProductData();
    if (!currentProduct) {
      console.log('[VariantMediaFilter] No product data found');
      return;
    }

    // Listen for variant changes
    bindVariantChangeEvents();
    
    // Initial filter based on current selection
    updateSelectedOptions();
    filterMedia();
    
    console.log('[VariantMediaFilter] Initialized for product:', currentProduct.title);
  }

  /**
   * Get product data from the page
   */
  function getProductData() {
    // Try to get from Shopify's product JSON
    const productJson = document.querySelector('[data-product-json], script[type="application/json"][data-product]');
    if (productJson) {
      try {
        return JSON.parse(productJson.textContent);
      } catch (e) {
        console.error('[VariantMediaFilter] Failed to parse product JSON:', e);
      }
    }

    // Try to get from window.product or similar
    if (window.product) return window.product;
    if (window.ShopifyAnalytics?.meta?.product) return window.ShopifyAnalytics.meta.product;

    return null;
  }

  /**
   * Bind event listeners for variant changes
   */
  function bindVariantChangeEvents() {
    // Listen for radio button changes (common in Dawn theme)
    document.querySelectorAll('input[type="radio"][name*="option"], input[type="radio"][name*="Option"]').forEach(input => {
      input.addEventListener('change', handleVariantChange);
    });

    // Listen for select changes
    document.querySelectorAll('select[name*="option"], select[name*="Option"], .product-form__input select').forEach(select => {
      select.addEventListener('change', handleVariantChange);
    });

    // Listen for custom variant change events (Shopify themes often dispatch these)
    document.addEventListener('variant:change', handleVariantChange);
    document.addEventListener('variantChange', handleVariantChange);
    
    // Listen for Shopify's native variant change
    const form = document.querySelector('form[action*="/cart/add"]');
    if (form) {
      form.addEventListener('change', handleVariantChange);
    }

    // MutationObserver for dynamic content
    observeVariantChanges();
  }

  /**
   * Handle variant change event
   */
  function handleVariantChange(event) {
    // If the event has options data, use it directly
    if (event.detail?.options) {
      selectedOptions = { ...event.detail.options };
      console.log('[VariantMediaFilter] Options from event:', selectedOptions);
    } else {
      updateSelectedOptions();
    }
    filterMedia();
  }

  /**
   * Update selected options from the form
   */
  function updateSelectedOptions() {
    selectedOptions = {};

    // Get from radio buttons - check variant-option-group fieldsets first
    document.querySelectorAll('fieldset.variant-option-group').forEach(fieldset => {
      const optionName = fieldset.dataset.optionName;
      const checkedInput = fieldset.querySelector('input[type="radio"]:checked');
      if (optionName && checkedInput) {
        selectedOptions[optionName] = checkedInput.value;
      }
    });

    // Fallback: Get from any checked radio buttons with option names
    if (Object.keys(selectedOptions).length === 0) {
      document.querySelectorAll('input[type="radio"]:checked').forEach(input => {
        const name = input.name.replace(/^option/i, '').replace(/\d+$/, '');
        const optionName = input.closest('[data-option-name]')?.dataset.optionName || 
                           input.closest('fieldset')?.querySelector('legend')?.textContent?.trim() ||
                           name;
        if (optionName && input.value) {
          selectedOptions[optionName] = input.value;
        }
      });
    }

    // Get from selects
    document.querySelectorAll('select[name*="option"], select[name*="Option"]').forEach(select => {
      const name = select.name.replace(/^option/i, '').replace(/\d+$/, '');
      const optionName = select.closest('[data-option-name]')?.dataset.optionName ||
                         select.previousElementSibling?.textContent?.trim() ||
                         name;
      if (select.value) {
        selectedOptions[optionName] = select.value;
      }
    });

    console.log('[VariantMediaFilter] Selected options:', selectedOptions);
  }

  /**
   * Get alt text from a media item (checks multiple sources)
   */
  function getMediaAltText(item) {
    // Check data-alt attribute on the item itself
    if (item.dataset.alt) return item.dataset.alt;
    
    // Check img alt attribute
    const img = item.querySelector('img');
    if (img?.alt) return img.alt;
    
    // Check nested .product-media div's data attributes
    const nestedMedia = item.querySelector('.product-media');
    if (nestedMedia?.dataset.alt) return nestedMedia.dataset.alt;
    
    // Check data-media-id and look for alt in product JSON
    const mediaId = item.dataset.mediaId || nestedMedia?.dataset.mediaId;
    if (mediaId && currentProduct?.media) {
      const mediaObj = currentProduct.media.find(m => String(m.id) === String(mediaId));
      if (mediaObj?.alt) return mediaObj.alt;
    }
    
    return '';
  }

  /**
   * Filter media based on selected options
   */
  function filterMedia() {
    const selectedValues = Object.values(selectedOptions).map(v => v.toLowerCase().trim());
    
    if (selectedValues.length === 0) {
      showAllMedia();
      return;
    }

    const galleryContainer = document.querySelector(CONFIG.galleryContainer);
    const thumbnailContainer = document.querySelector(CONFIG.thumbnailContainer);
    
    if (!galleryContainer) {
      console.log('[VariantMediaFilter] Gallery container not found');
      return;
    }

    const mediaItems = galleryContainer.querySelectorAll(CONFIG.mediaItem);
    const thumbnails = thumbnailContainer?.querySelectorAll(CONFIG.thumbnailItem) || [];
    
    let matchCount = 0;
    let taggedCount = 0;
    let firstMatchIndex = -1;

    mediaItems.forEach((item, index) => {
      const alt = getMediaAltText(item).toLowerCase().trim();
      const isUntagged = !alt || alt === '';
      
      if (!isUntagged) taggedCount++;
      
      console.log(`[VariantMediaFilter] Media ${index}: alt="${alt}", checking against:`, selectedValues);
      
      // Check if this media matches any selected option value
      const isMatch = selectedValues.some(val => alt.includes(val));
      
      let shouldShow = false;
      
      if (isMatch) {
        shouldShow = true;
        matchCount++;
        if (firstMatchIndex === -1) firstMatchIndex = index;
      } else if (isUntagged && !CONFIG.hideUntagged) {
        // Show untagged media by default
        shouldShow = true;
      }

      // Apply visibility
      toggleMediaVisibility(item, shouldShow);
      
      // Also toggle corresponding thumbnail
      if (thumbnails[index]) {
        toggleMediaVisibility(thumbnails[index], shouldShow);
      }
    });

    // If no tagged images exist at all, show everything
    if (taggedCount === 0) {
      console.log('[VariantMediaFilter] No tagged media found, showing all');
      showAllMedia();
      return;
    }

    // If no matches found and config says show all
    if (matchCount === 0 && CONFIG.showAllWhenNoMatch) {
      showAllMedia();
      return;
    }

    // NOTE: Removed auto-scroll to first matching image to prevent page jumping
    // when user clicks variant options. The page should stay at current position.

    console.log('[VariantMediaFilter] Filtered media:', matchCount, 'matches out of', taggedCount, 'tagged');
  }

  /**
   * Show all media items
   */
  function showAllMedia() {
    const galleryContainer = document.querySelector(CONFIG.galleryContainer);
    const thumbnailContainer = document.querySelector(CONFIG.thumbnailContainer);
    
    if (galleryContainer) {
      galleryContainer.querySelectorAll(CONFIG.mediaItem).forEach(item => {
        toggleMediaVisibility(item, true);
      });
    }
    
    if (thumbnailContainer) {
      thumbnailContainer.querySelectorAll(CONFIG.thumbnailItem).forEach(item => {
        toggleMediaVisibility(item, true);
      });
    }
  }

  /**
   * Toggle visibility of a media item with animation
   */
  function toggleMediaVisibility(element, show) {
    if (show) {
      element.style.display = '';
      element.style.opacity = '0';
      element.offsetHeight; // Force reflow
      element.style.transition = `opacity ${CONFIG.fadeInDuration}ms ease`;
      element.style.opacity = '1';
      element.classList.remove('variant-media-hidden');
    } else {
      element.style.transition = `opacity ${CONFIG.fadeOutDuration}ms ease`;
      element.style.opacity = '0';
      setTimeout(() => {
        element.style.display = 'none';
        element.classList.add('variant-media-hidden');
      }, CONFIG.fadeOutDuration);
    }
  }

  /**
   * Scroll to a specific media item
   */
  function scrollToMedia(element) {
    // For slider-based galleries, try to activate the slide
    const slider = element.closest('.swiper, .flickity, .slick-slider, [data-slider]');
    if (slider) {
      const index = Array.from(element.parentNode.children).indexOf(element);
      
      // Swiper
      if (slider.swiper) {
        slider.swiper.slideTo(index);
        return;
      }
      
      // Flickity
      if (slider.flickity) {
        slider.flickity.select(index);
        return;
      }
      
      // Slick
      if (typeof $(slider).slick === 'function') {
        $(slider).slick('slickGoTo', index);
        return;
      }
    }

    // Default: scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Observe DOM for dynamic variant changes
   */
  function observeVariantChanges() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-variant-id') {
          handleVariantChange();
          break;
        }
        
        // Check for added nodes that might be variant selectors
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.matches && node.matches(CONFIG.variantSelector)) {
              bindVariantChangeEvents();
              handleVariantChange();
            }
          });
        }
      }
    });

    // Observe the product form area
    const productForm = document.querySelector('form[action*="/cart/add"], .product-form, [data-product-form]');
    if (productForm) {
      observer.observe(productForm, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['data-variant-id', 'checked', 'selected']
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also initialize on Shopify section load (for theme editor)
  document.addEventListener('shopify:section:load', init);

  // Expose for external use
  window.VariantMediaFilter = {
    init,
    filterMedia,
    showAllMedia,
    getSelectedOptions: () => ({ ...selectedOptions }),
    setConfig: (newConfig) => Object.assign(CONFIG, newConfig)
  };

})();
