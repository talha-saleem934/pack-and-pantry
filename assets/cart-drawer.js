(() => {
  if (customElements.get('cart-drawer')) return;

  class CartDrawer extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('.cart-drawer__panel');
      this.closeButtons = this.querySelectorAll('[data-cart-close]');
      this.closeButtons.forEach((button) => button.addEventListener('click', () => this.close()));
      this.querySelectorAll('[data-cart-change]').forEach((button) => button.addEventListener('click', () => this.change(button)));
      this.keydown = (event) => { if (event.key === 'Escape') this.close(); };
    }
    open() {
      this.lastFocus = document.activeElement;
      this.classList.add('is-open'); this.setAttribute('open', ''); this.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this.keydown); this.querySelector('[data-cart-close]:not([tabindex="-1"])')?.focus();
    }
    close() {
      this.classList.remove('is-open'); this.removeAttribute('open'); this.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
      document.removeEventListener('keydown', this.keydown); this.lastFocus?.focus(); document.dispatchEvent(new CustomEvent('drawer:closed'));
    }
    async change(button) {
      button.disabled = true;
      const section = this.closest('[data-cart-drawer-section]'); const sectionId = section?.dataset.sectionId;
      try {
        const response = await fetch(`${window.Shopify.routes.root}cart/change.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ line: Number(button.dataset.cartChange), quantity: Number(button.dataset.quantity), sections: [sectionId], sections_url: window.location.pathname }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.description || 'Unable to update cart.');
        window.PackPantryCart?.render(data, true); document.dispatchEvent(new CustomEvent('cart:updated', { detail: data }));
      } catch (error) { document.getElementById('LiveRegion').textContent = error.message; button.disabled = false; }
    }
  }

  customElements.define('cart-drawer', CartDrawer);

  const api = {
    render(data, open = false) {
      const section = document.querySelector('[data-cart-drawer-section]'); const id = section?.dataset.sectionId; const html = data?.sections?.[id];
      if (section && html) { const doc = new DOMParser().parseFromString(html, 'text/html'); const replacement = doc.querySelector('[data-cart-drawer-section]'); if (replacement) section.replaceWith(replacement); }
      const drawer = document.querySelector('cart-drawer'); if (open) requestAnimationFrame(() => drawer?.open());
      if (typeof data?.item_count === 'number') document.querySelectorAll('[data-cart-count]').forEach((node) => { node.textContent = data.item_count; node.hidden = data.item_count === 0; });
    },
    open() { document.querySelector('cart-drawer')?.open(); }
  };
  window.PackPantryCart = api;

  document.addEventListener('click', async (event) => {
    const cartButton = event.target.closest('[data-cart-open]');
    if (cartButton) { event.preventDefault(); api.open(); return; }
    const quickButton = event.target.closest('[data-quick-add]');
    if (!quickButton) return;
    const dialog = document.querySelector('[data-quick-add-dialog]'); const content = dialog?.querySelector('[data-quick-add-content]'); if (!dialog || !content) return;
    quickButton.disabled = true; content.innerHTML = '<p>Loading product options…</p>';
    try { const html = await fetch(quickButton.dataset.url).then((response) => response.text()); const doc = new DOMParser().parseFromString(html, 'text/html'); content.innerHTML = doc.querySelector('#shopify-section-quick-add-product')?.innerHTML || '<p>Product options are unavailable.</p>'; dialog.showModal(); document.dispatchEvent(new CustomEvent('quick-add:loaded', { detail: { root: content } })); }
    finally { quickButton.disabled = false; }
  });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-quick-add-close]')) document.querySelector('[data-quick-add-dialog]')?.close(); });
})();
