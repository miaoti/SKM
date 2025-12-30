/**
 * Admin Dashboard - Shop Profile Management
 * Handles fetching and updating shop details (Name, Email, Logo, Socials)
 */

(function (window) {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        // Handle deep linking for profile tab if global switcher exists
        const hash = window.location.hash.replace('#', '');
        if (hash === 'profile' && window.switchToTab) {
            window.switchToTab('profile');
        }

        // Initialize if context is available
        // window.AdminDashboard is set by page.admin-dashboard.liquid
        if (window.AdminDashboard && document.getElementById('tab-profile')) {
            const { API_BASE, api, toast } = window.AdminDashboard;
            initProfileTab(API_BASE, api, toast);
        }
    });

    function initProfileTab(API_BASE, api, toast) {
        if (!API_BASE || !api) {
            console.error('Missing API context for Profile Tab');
            return;
        }

        loadShopProfile(API_BASE, api, toast);

        // Save Profile Button
        const btnSave = document.getElementById('btn-save-profile');
        if (btnSave) {
            // Clone to remove old listeners
            const newBtn = btnSave.cloneNode(true);
            if (btnSave.parentNode) {
                btnSave.parentNode.replaceChild(newBtn, btnSave);
                newBtn.addEventListener('click', () => saveShopProfile(API_BASE, api, toast));
            }
        }

        // Logo URL input preview
        const logoInput = document.getElementById('shop-logo-url');
        if (logoInput) {
            logoInput.addEventListener('input', (e) => updateLogoPreview(e.target.value));
            logoInput.addEventListener('change', (e) => updateLogoPreview(e.target.value));
        }

        // Logo file upload
        const logoFileInput = document.getElementById('shop-logo-file');
        const uploadBtn = document.getElementById('btn-upload-logo');
        const fileNameSpan = document.getElementById('logo-file-name');

        if (logoFileInput && uploadBtn) {
            // Show file name when selected
            logoFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileNameSpan.textContent = file.name;
                    uploadBtn.disabled = false;
                    // Show preview immediately
                    const reader = new FileReader();
                    reader.onload = (ev) => updateLogoPreview(ev.target.result);
                    reader.readAsDataURL(file);
                } else {
                    fileNameSpan.textContent = 'Choose a file...';
                    uploadBtn.disabled = true;
                }
            });

            // Upload button click
            uploadBtn.addEventListener('click', async () => {
                const file = logoFileInput.files[0];
                if (!file) return;

                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Uploading...';

                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
                    const res = await fetch(`${baseUrl}/shop/logo/upload`, {
                        method: 'POST',
                        headers: { 'X-Admin-Key': api.headers()['X-Admin-Key'] },
                        body: formData
                    });

                    const result = await res.json();
                    if (!result.success) throw new Error(result.error || 'Upload failed');

                    // Set the URL in the input
                    if (logoInput) {
                        logoInput.value = result.url;
                        updateLogoPreview(result.url);
                    }

                    // Auto-save the profile to persist the logo URL
                    await saveShopProfile(API_BASE, api, toast);

                    fileNameSpan.textContent = 'Choose a file...';
                    logoFileInput.value = '';
                } catch (error) {
                    console.error('Logo upload error:', error);
                    if (toast) toast('Failed to upload logo: ' + error.message, 'error');
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Upload';
                }
            });
        }
    }

    /**
     * Load Shop Profile Data from Worker
     */
    async function loadShopProfile(API_BASE, api, toast) {
        const inputs = {
            name: document.getElementById('shop-name'),
            email: document.getElementById('shop-email'),
            logo: document.getElementById('shop-logo-url'),
            twitter: document.getElementById('social-twitter'),
            instagram: document.getElementById('social-instagram'),
            facebook: document.getElementById('social-facebook'),
            youtube: document.getElementById('social-youtube')
        };

        try {
            // Ensure proper path construction
            const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
            const url = `${baseUrl}/shop/profile`;

            const res = await fetch(url, {
                method: 'GET',
                headers: api.headers()
            });

            if (!res.ok) throw new Error('Failed to load profile');
            const data = await res.json();

            // Populate fields
            if (inputs.name) inputs.name.value = data.name || '';
            if (inputs.email) inputs.email.value = data.email || '';
            if (inputs.logo) inputs.logo.value = data.logo || '';
            if (inputs.twitter) inputs.twitter.value = data.social_twitter || '';
            if (inputs.instagram) inputs.instagram.value = data.social_instagram || '';
            if (inputs.facebook) inputs.facebook.value = data.social_facebook || '';
            if (inputs.youtube) inputs.youtube.value = data.social_youtube || '';

            // Update Logo Preview
            updateLogoPreview(data.logo);

            // Update Favicon from shop logo
            if (data.logo) {
                let favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
                if (!favicon) {
                    favicon = document.createElement('link');
                    favicon.rel = 'icon';
                    document.head.appendChild(favicon);
                }
                favicon.href = data.logo;
            }

        } catch (error) {
            console.error('Error loading profile:', error);
            if (toast) toast('Failed to load shop profile', 'error');
        }
    }

    /**
     * Save Shop Profile Data
     */
    async function saveShopProfile(API_BASE, api, toast) {
        const btnSave = document.getElementById('btn-save-profile');
        if (!btnSave) return;

        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = '<span class="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Saving...';
        btnSave.disabled = true;

        const getInputVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const profileData = {
            // Note: name and email are not included because Shopify doesn't allow changing them via API
            logo: getInputVal('shop-logo-url'),
            social_twitter: getInputVal('social-twitter'),
            social_instagram: getInputVal('social-instagram'),
            social_facebook: getInputVal('social-facebook'),
            social_youtube: getInputVal('social-youtube')
        };

        try {
            const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
            const url = `${baseUrl}/shop/profile`;

            const res = await fetch(url, {
                method: 'PUT',
                headers: api.headers(),
                body: JSON.stringify(profileData)
            });

            if (!res.ok) throw new Error('Failed to save profile');

            // Note: Shop name is read-only, so we don't update the title or header here

            // Update Logo Preview
            updateLogoPreview(profileData.logo);

            if (toast) toast('Profile updated successfully!', 'success');
            else alert('Profile updated successfully!');

        } catch (error) {
            console.error('Error saving profile:', error);
            if (toast) toast('Failed to save profile: ' + error.message, 'error');
            else alert('Failed to save profile.');
        } finally {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }
    }

    /**
     * Handle Logo Preview
     */
    function updateLogoPreview(url) {
        const img = document.getElementById('logo-preview-img');
        const placeholder = document.getElementById('logo-placeholder');

        if (!img || !placeholder) return;

        if (url && url.trim() !== '') {
            img.src = url;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            img.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    }

})(window);
