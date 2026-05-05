/**
 * A custom element that manages the account login actions.
 *
 * @extends {HTMLElement}
 */
class AccountLoginActions extends HTMLElement {
  /**
   * @type {Element | null}
   */
  shopLoginButton = null;

  connectedCallback() {
    this.shopLoginButton = this.querySelector('shop-login-button');

    if (this.shopLoginButton) {
      // We don't have control over the shop-login-button markup, so we need to set additional attributes here
      this.shopLoginButton.setAttribute('full-width', 'true');
      this.shopLoginButton.setAttribute('persist-after-sign-in', 'true');
      // Do this only if New Customer Account is ALWAYS the sign in option (and never Classic Customer Account)
      this.shopLoginButton.setAttribute('analytics-context', 'loginWithShopSelfServe');
      this.shopLoginButton.setAttribute('flow-version', 'account-actions-popover');
      this.shopLoginButton.setAttribute('return-uri', window.location.href);

      // Reload after Shop Login completes. A soft update isn't viable here:
      // headers, cart, and product pricing are rendered server-side from
      // {% if customer %} branches, so the only way to reflect the new
      // logged-in state across the whole page is a navigation. We append
      // ?just_logged_in=true so theme.liquid's cart-persistence logic can
      // skip the localStorage restore and trust Shopify's session merge.
      this.shopLoginButton.addEventListener('completed', () => {
        const u = new URL(window.location.href);
        u.searchParams.set('just_logged_in', 'true');
        window.location.replace(u.toString());
      });
    }
  }
}

if (!customElements.get('account-login-actions')) {
  customElements.define('account-login-actions', AccountLoginActions);
}
