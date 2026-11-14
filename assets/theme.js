class FocusTrap {
  constructor(container) { this.container = container; this.before = document.activeElement; this.onKeydown = this.onKeydown.bind(this); document.addEventListener('keydown', this.onKeydown); this.items()[0]?.focus(); }
  items() { return [...this.container.querySelectorAll('a[href],summary,button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]; }
  onKeydown(event) { if (event.key !== 'Tab') return; const items = this.items(); const first = items[0]; const last = items[items.length - 1]; if (!first) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  destroy() { document.removeEventListener('keydown', this.onKeydown); this.before?.focus(); }
}

const announce = (message) => { const region = document.getElementById('LiveRegion'); if (region) region.textContent = message; };

function initQuantities(root = document) {
  root.querySelectorAll('[data-quantity]:not([data-initialized])').forEach((quantity) => {
    quantity.dataset.initialized = 'true'; const input = quantity.querySelector('input');
    quantity.querySelectorAll('[data-quantity-button]').forEach((button) => button.addEventListener('click', () => { const change = button.dataset.quantityButton === 'plus' ? 1 : -1; input.value = Math.max(Number(input.min || 1), Number(input.value || 1) + change); input.dispatchEvent(new Event('change', { bubbles: true })); }));
  });
}

async function addProduct(form, submitter) {
  const button = submitter || form.querySelector('[type="submit"]'); if (!button || button.disabled) return;
  const original = button.innerHTML; button.disabled = true; button.textContent = 'Adding…';
  try {
    const payload = new FormData(form); const cartSection = document.querySelector('[data-cart-drawer-section]'); const sectionId = cartSection?.dataset.sectionId;
    if (sectionId) { payload.append('sections', sectionId); payload.append('sections_url', window.location.pathname); }
    const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
    const added = await response.json(); if (!response.ok) throw new Error(added.description || 'Unable to add this item.');
    button.textContent = 'Added ✓'; announce(`${added.product_title || 'Item'} added to cart`);
    const cart = await fetch(`${window.Shopify.routes.root}cart.js`).then((result) => result.json()); cart.sections = added.sections || {};
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart })); window.PackPantryCart?.render(cart, true);
    document.querySelector('[data-quick-add-dialog][open]')?.close();
  } catch (error) { announce(error.message); }
  finally { setTimeout(() => { button.innerHTML = original; button.disabled = false; }, 1200); }
}

function initProduct(root) {
  if (!root || root.dataset.initialized) return; root.dataset.initialized = 'true';
  const form = root.querySelector('[data-product-form]'); if (!form) return;
  const variants = JSON.parse(root.querySelector('[data-variants-json]')?.textContent || '[]'); const idInput = form.querySelector('[name="id"]'); const addButton = form.querySelector('[name="add"]'); const price = root.querySelector('[data-product-price]'); const stickyButton = root.querySelector('[data-sticky-add]');
  let controller;
  const update = async (event) => {
    if (!event.target.closest('[data-option-group]')) return;
    const chosen = [...form.querySelectorAll('[data-option-group]')].map((group) => group.querySelector('input:checked')?.value);
    const variant = variants.find((item) => item.options.every((option,index) => option === chosen[index]));
    if (!variant) { addButton.disabled = true; addButton.textContent = addButton.dataset.unavailable; return; }
    idInput.value = variant.id; addButton.disabled = !variant.available; addButton.textContent = variant.available ? addButton.dataset.add : addButton.dataset.sold; if (price) price.textContent = variant.price_formatted || price.textContent;
    if (stickyButton) { stickyButton.disabled = !variant.available; stickyButton.textContent = addButton.textContent; }
    const url = new URL(window.location.href); url.searchParams.set('variant', variant.id); window.history.replaceState({}, '', url);
    document.dispatchEvent(new CustomEvent('variant:changed', { detail: variant }));
    if (!root.dataset.sectionId) return;
    controller?.abort(); controller = new AbortController(); const active = document.activeElement?.value;
    try { const html = await fetch(`${url.pathname}?variant=${variant.id}&section_id=${root.dataset.sectionId}`, { signal: controller.signal }).then((response) => response.text()); const doc = new DOMParser().parseFromString(html, 'text/html'); const replacement = doc.querySelector('[data-main-product]'); if (replacement) { root.replaceWith(replacement); initProduct(replacement); initQuantities(replacement); replacement.querySelector(`input[value="${CSS.escape(active || '')}"]`)?.focus(); } }
    catch (error) { if (error.name !== 'AbortError') announce('Product options could not be refreshed.'); }
  };
  form.addEventListener('change', update); stickyButton?.addEventListener('click', () => form.requestSubmit(addButton));
  const dialog = root.querySelector('[data-media-dialog]'); const dialogImage = root.querySelector('[data-media-dialog-image]');
  root.querySelectorAll('[data-media-open]').forEach((button) => button.addEventListener('click', () => { if (!dialog || !dialogImage) return; dialogImage.src = button.dataset.src; dialogImage.alt = button.dataset.alt || ''; dialog.showModal(); }));
  root.querySelector('[data-media-close]')?.addEventListener('click', () => dialog.close()); dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
}

document.addEventListener('DOMContentLoaded', () => {
  const mobileDrawer = document.querySelector('[data-mobile-drawer]'); let mobileTrap;
  const closeMobile = () => { if (!mobileDrawer) return; mobileDrawer.classList.remove('is-open'); mobileDrawer.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; mobileTrap?.destroy(); mobileTrap = null; };
  document.querySelectorAll('[data-menu-open]').forEach((button) => button.addEventListener('click', () => { mobileDrawer.classList.add('is-open'); mobileDrawer.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; mobileTrap = new FocusTrap(mobileDrawer.querySelector('.mobile-drawer__panel')); }));
  document.querySelectorAll('[data-menu-close]').forEach((button) => button.addEventListener('click', closeMobile)); document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMobile(); });
  const header = document.querySelector('.site-header'); const observeHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24); observeHeader(); window.addEventListener('scroll', observeHeader, { passive: true });
  initQuantities(); document.querySelectorAll('[data-main-product]').forEach(initProduct);
  document.querySelectorAll('[data-sort-by]').forEach((select) => select.addEventListener('change', () => { const url = new URL(window.location.href); url.searchParams.set('sort_by',select.value); window.location.assign(url.toString()); }));
  const facets = document.querySelector('[data-facets]'); document.querySelectorAll('[data-filter-open]').forEach((button) => button.addEventListener('click', () => facets?.classList.add('is-open'))); document.querySelectorAll('[data-filter-close]').forEach((button) => button.addEventListener('click', () => facets?.classList.remove('is-open')));
  const reveals = document.querySelectorAll('[data-reveal]'); if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) { const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { rootMargin: '0px 0px -50px' }); reveals.forEach((item) => observer.observe(item)); } else reveals.forEach((item) => item.classList.add('is-visible'));
});

document.addEventListener('submit', (event) => { const form = event.target.closest('[data-product-form]'); if (!form || !window.fetch) return; event.preventDefault(); addProduct(form,event.submitter); });
document.addEventListener('quick-add:loaded', (event) => initQuantities(event.detail.root));

class PredictiveSearch extends HTMLElement {
  connectedCallback() { this.input = this.querySelector('input[type="search"]'); this.results = this.querySelector('[data-predictive-results]'); let timer; this.input?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => this.search(),220); }); }
  async search() { const term = this.input.value.trim(); if (term.length < 2) { this.results.innerHTML = ''; return; } this.controller?.abort(); this.controller = new AbortController(); this.results.setAttribute('aria-busy','true'); try { const url = `${window.Shopify.routes.root}search/suggest?q=${encodeURIComponent(term)}&resources[type]=product,collection,page,article&resources[limit]=6&section_id=predictive-search`; const html = await fetch(url,{ signal:this.controller.signal }).then((response) => response.text()); const doc = new DOMParser().parseFromString(html,'text/html'); this.results.innerHTML = doc.querySelector('#shopify-section-predictive-search')?.innerHTML || ''; } catch(error) { if(error.name !== 'AbortError') announce('Search suggestions are unavailable.'); } finally { this.results.removeAttribute('aria-busy'); } }
}
if (!customElements.get('predictive-search')) customElements.define('predictive-search',PredictiveSearch);

class ProductRecommendations extends HTMLElement { connectedCallback() { const url = this.dataset.url; if (!url) return; fetch(url).then((response) => response.text()).then((text) => { const html = new DOMParser().parseFromString(text,'text/html').querySelector('product-recommendations'); if (html?.innerHTML.trim()) this.innerHTML = html.innerHTML; }).catch(() => {}); } }
if (!customElements.get('product-recommendations')) customElements.define('product-recommendations',ProductRecommendations);
