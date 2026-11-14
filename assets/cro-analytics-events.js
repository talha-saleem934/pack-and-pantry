/* Pack & Pantry CRO analytics bridge (Phase 5).
   Pushes GA4-style events to window.dataLayer ONLY if a data layer already exists (e.g. created by your
   Google tag / GTM app). No tracking code, pixel or cookie is added here. Enabled from
   Theme settings → CRO & conversion → "Send CRO events to the data layer". */
(() => {
  if (window.__croAnalytics) return;
  window.__croAnalytics = true;
  const currency = () => (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || undefined;
  const push = (event, payload = {}) => {
    if (!Array.isArray(window.dataLayer)) return;
    window.dataLayer.push({ event, ...payload });
  };
  const d = document;

  d.addEventListener('cro:view-item', (e) => {
    const p = e.detail || {};
    push('view_item', { ecommerce: { currency: currency(), items: [{ item_id: String(p.id), item_name: p.title }] } });
  });
  let lastSubmit = 0;
  d.addEventListener('submit', (e) => { if (e.target.closest && e.target.closest('[data-product-form]')) lastSubmit = Date.now(); }, true);
  d.addEventListener('cart:updated', (e) => {
    if (!lastSubmit || Date.now() - lastSubmit > 10000) return;
    lastSubmit = 0;
    const cart = e.detail || {};
    push('add_to_cart', { ecommerce: { currency: cart.currency || currency(), value: (cart.total_price || 0) / 100 } });
  });
  d.addEventListener('cro:added', (e) => push('add_to_cart', { source: (e.detail && e.detail.source) || 'cro', items_added: ((e.detail && e.detail.items) || []).length }));
  d.addEventListener('variant:changed', (e) => push('select_variant', { variant_id: e.detail && e.detail.id }));
  d.addEventListener('cro:countdown-expired', (e) => { if (!(e.detail && e.detail.clone)) push('countdown_expired', { countdown_id: e.detail && e.detail.id }); });
  d.addEventListener('cro:popup-submit', () => push('popup_submit'));
  d.addEventListener('cro:whatsapp-click', (e) => push('whatsapp_click', { source: e.detail && e.detail.source }));
  d.addEventListener('cro:coupon-copied', (e) => push('coupon_copied', { code: e.detail && e.detail.code }));
  d.addEventListener('cro:begin-checkout', () => push('begin_checkout_click'));
  d.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[name="checkout"]');
    if (b && !b.closest('[data-cro-checkout-form]')) push('begin_checkout_click');
  });
})();
