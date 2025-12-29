/**
 * SKM Command Center - Global JavaScript
 * Handles scroll progress, cursor effects, and global interactions
 */

(function () {
    'use strict';

    // Initialize Command Center theme
    function initCommandCenter() {
        document.body.classList.add('command-center-theme');
        initScrollProgress();
        initHUDEffects();
    }

    // Scroll Progress Bar
    function initScrollProgress() {
        const container = document.createElement('div');
        container.className = 'scroll-progress-container';
        container.innerHTML = `
      <div class="scroll-progress-bar"></div>
    `;
        document.body.prepend(container);

        const label = document.createElement('div');
        label.className = 'scroll-progress-label';
        label.textContent = '[ SYSTEM_LOADING... 0% ]';
        document.body.appendChild(label);

        const progressBar = container.querySelector('.scroll-progress-bar');

        function updateProgress() {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

            progressBar.style.width = progress + '%';
            label.textContent = `[ SYSTEM_LOADING... ${Math.round(progress)}% ]`;

            // Show/hide label based on scroll
            if (scrollTop > 50) {
                label.classList.add('visible');
            } else {
                label.classList.remove('visible');
            }
        }

        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
    }

    // HUD Effects
    function initHUDEffects() {
        // Add scanning effect on certain interactions
        document.querySelectorAll('[data-hud-scan]').forEach(el => {
            el.addEventListener('mouseenter', () => {
                el.classList.add('hud-scanning');
            });
            el.addEventListener('mouseleave', () => {
                el.classList.remove('hud-scanning');
            });
        });

        // Laser line on hover for product cards
        document.querySelectorAll('.product-card-hud').forEach(card => {
            const laserLine = document.createElement('div');
            laserLine.className = 'laser-line';
            card.appendChild(laserLine);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCommandCenter);
    } else {
        initCommandCenter();
    }

})();
