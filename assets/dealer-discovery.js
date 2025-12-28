/**
 * Dealer Discovery Page Logic
 * - Fetches and displays dealers
 * - Initializes Mapbox map with markers
 * - Handles dealer application form
 */

const API_BASE = 'https://skm-inventory-api.miaotingshuo.workers.dev';

// Using Leaflet + OpenStreetMap (100% free, no API key needed)

let map = null;
let markers = [];
let dealers = [];

/**
 * Initialize the dealer discovery page
 */
async function initDealerDiscovery() {
  await loadDealers();
  initMap();
  initApplicationForm();
}

/**
 * Load dealers from API
 */
async function loadDealers() {
  try {
    const res = await fetch(`${API_BASE}/dealers`);
    const data = await res.json();

    if (data.success && data.data && data.data.length > 0) {
      dealers = data.data;
      renderDealerList(dealers);
      updateDealerCount(dealers.length);
    } else {
      dealers = [];
      showEmptyState('No dealers yet. Be the first to apply below!');
      updateDealerCount(0);
    }
  } catch (err) {
    console.error('Failed to load dealers:', err);
    dealers = [];
    showEmptyState('No dealers available at this time');
    updateDealerCount(0);
  }
}

/**
 * Render dealer list
 */
function renderDealerList(dealers) {
  const container = document.getElementById('dealer-list');
  if (!container) return;

  if (dealers.length === 0) {
    showEmptyState('No dealers found in your area');
    return;
  }

  container.innerHTML = dealers.map(dealer => `
    <div class="dealer-card p-4 hover:bg-gray-50 cursor-pointer transition-colors" data-dealer-id="${dealer.id}">
      <div class="flex items-start gap-4">
        <!-- Logo -->
        <div class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
          ${dealer.logo
      ? `<img src="${dealer.logo}" alt="${dealer.name}" class="w-full h-full object-cover">`
      : dealer.website
        ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(dealer.website.replace(/^https?:\/\//, '').split('/')[0])}&sz=64" alt="${dealer.name}" class="w-10 h-10" onerror="this.parentElement.innerHTML='<svg class=\\'w-8 h-8 text-gray-400\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4\\'/></svg>'">`
        : `<svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>`
    }
        </div>
        
        <!-- Info -->
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-gray-900 truncate">${dealer.name}</h3>
          <p class="text-sm text-gray-500 truncate">
            ${[dealer.city, dealer.state].filter(Boolean).join(', ') || 'Location not specified'}
          </p>
          ${dealer.phone ? `
            <p class="text-sm text-[#CC0000] mt-1">
              <a href="tel:${dealer.phone}" class="hover:underline">${dealer.phone}</a>
            </p>
          ` : ''}
        </div>
        
        <!-- Distance (placeholder) -->
        <div class="flex-shrink-0 text-right">
          <span class="text-xs text-gray-400">
            ${dealer.latitude && dealer.longitude ? '📍' : ''}
          </span>
        </div>
      </div>
      
      <!-- Expandable Details -->
      <div class="dealer-details hidden mt-4 pt-4 border-t border-gray-100">
        ${dealer.address ? `
          <div class="flex items-start gap-2 text-sm text-gray-600 mb-2">
            <svg class="w-4 h-4 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span>${dealer.address}, ${dealer.city}, ${dealer.state} ${dealer.zip}</span>
          </div>
        ` : ''}
        ${dealer.email ? `
          <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <a href="mailto:${dealer.email}" class="text-[#CC0000] hover:underline">${dealer.email}</a>
          </div>
        ` : ''}
        ${dealer.website ? `
          <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
            </svg>
            <a href="${dealer.website}" target="_blank" class="text-[#CC0000] hover:underline">${dealer.website.replace(/^https?:\/\//, '')}</a>
          </div>
        ` : ''}
        ${dealer.hours ? `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Business Hours</h4>
            <div class="text-sm text-gray-600 space-y-1">
              ${formatHours(dealer.hours)}
            </div>
          </div>
        ` : ''}
        
        <!-- Action Buttons -->
        <div class="flex gap-2 mt-4">
          ${dealer.latitude && dealer.longitude ? `
            <a href="https://www.google.com/maps/dir/?api=1&destination=${dealer.latitude},${dealer.longitude}" 
               target="_blank"
               class="flex-1 px-4 py-2 bg-[#CC0000] text-white text-sm font-medium rounded-lg text-center hover:bg-[#aa0000] transition">
              Get Directions
            </a>
          ` : ''}
          ${dealer.phone ? `
            <a href="tel:${dealer.phone}" 
               class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg text-center hover:bg-gray-50 transition">
              Call Now
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers to expand/collapse
  container.querySelectorAll('.dealer-card').forEach(card => {
    card.addEventListener('click', function (e) {
      // Don't toggle if clicking a link
      if (e.target.tagName === 'A') return;

      const details = this.querySelector('.dealer-details');
      const wasHidden = details.classList.contains('hidden');

      // Collapse all others
      container.querySelectorAll('.dealer-details').forEach(d => d.classList.add('hidden'));

      // Toggle this one
      if (wasHidden) {
        details.classList.remove('hidden');

        // Center map on this dealer
        const dealerId = this.dataset.dealerId;
        const dealer = dealers.find(d => d.id === dealerId);
        if (dealer?.latitude && dealer?.longitude && map) {
          map.flyTo({
            center: [parseFloat(dealer.longitude), parseFloat(dealer.latitude)],
            zoom: 14
          });
        }
      }
    });
  });
}

/**
 * Format business hours object
 */
function formatHours(hours) {
  if (!hours) return '';

  // Handle text/display format (from B2B/Admin)
  if (typeof hours === 'string') return hours.replace(/\n/g, '<br>');
  if (hours.display) return hours.display.replace(/\n/g, '<br>');
  if (hours.text) return hours.text.replace(/\n/g, '<br>');
  if (typeof hours !== 'object') return '';

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayNames = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

  // Check if it has day keys
  const hasDays = days.some(d => hours[d]);
  if (!hasDays) {
    // Fallback if it's an object but empty or weird
    return JSON.stringify(hours);
  }

  return days.map(day => {
    const value = hours[day];
    if (!value) return null;
    return `<div class="flex justify-between"><span class="font-medium">${dayNames[day]}</span><span>${value}</span></div>`;
  }).filter(Boolean).join('');
}

/**
 * Show empty state message
 */
function showEmptyState(message) {
  const container = document.getElementById('dealer-list');
  if (container) {
    container.innerHTML = `
      <div class="p-8 text-center text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
        </svg>
        <p>${message}</p>
      </div>
    `;
  }
}

/**
 * Update dealer count display
 */
function updateDealerCount(count) {
  const el = document.getElementById('dealer-count');
  if (el) {
    el.textContent = `${count} dealer${count !== 1 ? 's' : ''} found`;
  }
}

/**
 * Initialize Leaflet map (100% free with OpenStreetMap)
 */
function initMap() {
  const container = document.getElementById('dealer-map');
  if (!container) return;

  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    container.innerHTML = `
      <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;padding:32px;text-align:center;">
        <svg style="width:48px;height:48px;margin-bottom:12px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
        </svg>
        <p style="font-weight:500;">Map Loading Error</p>
        <p style="font-size:14px;margin-top:4px;">Please refresh the page</p>
      </div>
    `;
    return;
  }

  // Default center (Dallas, TX)
  const defaultCenter = [32.7767, -96.7970]; // Leaflet uses [lat, lng]

  // Initialize map
  map = L.map('dealer-map').setView(defaultCenter, 4);

  // Add OpenStreetMap tiles (free, no API key!)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  // Add markers
  addDealerMarkers();
}

/**
 * Add markers for all dealers (Leaflet version)
 */
function addDealerMarkers() {
  if (!map) return;

  // Clear existing markers
  markers.forEach(m => m.remove());
  markers = [];

  const bounds = L.latLngBounds([]);
  let hasCoords = false;

  // Custom red marker icon
  const redIcon = L.divIcon({
    className: 'dealer-marker',
    html: `
      <div style="width:32px;height:32px;background:#CC0000;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px rgba(0,0,0,0.3);cursor:pointer;border:2px solid white;">
        <svg style="width:16px;height:16px;color:white;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  dealers.forEach(dealer => {
    if (!dealer.latitude || !dealer.longitude) return;

    const lat = parseFloat(dealer.latitude);
    const lng = parseFloat(dealer.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    hasCoords = true;
    bounds.extend([lat, lng]);

    // Create marker with popup
    const popupContent = `
      <div style="padding:8px;min-width:150px;">
        <h3 style="font-weight:bold;margin:0 0 4px 0;color:#111;">${dealer.name}</h3>
        <p style="font-size:13px;color:#666;margin:0;">${[dealer.city, dealer.state].filter(Boolean).join(', ')}</p>
        ${dealer.phone ? `<p style="font-size:13px;color:#CC0000;margin:4px 0 0 0;">${dealer.phone}</p>` : ''}
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: redIcon })
      .bindPopup(popupContent)
      .addTo(map);

    markers.push(marker);

    // Click handler to highlight card
    marker.on('click', () => {
      const card = document.querySelector(`[data-dealer-id="${dealer.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // Fit map to bounds if we have coordinates
  if (hasCoords && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }
}

/**
 * Initialize application form
 */
function initApplicationForm() {
  const form = document.getElementById('dealer-application-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-application');
    const originalText = submitBtn.innerHTML;

    // Disable and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Submitting...</span>
    `;

    try {
      const formData = new FormData(form);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      const res = await fetch(`${API_BASE}/apply-dealer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (result.success) {
        // Show success message
        form.classList.add('hidden');
        document.getElementById('application-success').classList.remove('hidden');
      } else {
        throw new Error(result.error || 'Failed to submit application');
      }
    } catch (err) {
      console.error('Application error:', err);
      alert('Failed to submit application. Please try again.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDealerDiscovery);
} else {
  initDealerDiscovery();
}
