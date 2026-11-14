/* Pack & Pantry CRO cart: animated free-delivery bar, order note autosave, discount code at checkout.
   Works for the cart drawer (re-rendered by window.PackPantryCart) and the cart page. */
(() => {
  if (window.__croCart) return;
  window.__croCart = true;

  const boot = () => {
    const { register, emit, reduced } = window.CRO;
    const root = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    let lastPct = null;

    register('[data-cro-ship]', (el) => {
      const pct = Math.max(0, Math.min(100, +el.dataset.pct || 0));
      const fill = el.querySelector('.cro-ship__fill');
      if (!fill) return;
      if (lastPct === null || reduced()) { el.style.setProperty('--cro-ship-pct', `${pct}%`); }
      else {
        el.style.setProperty('--cro-ship-pct', `${lastPct}%`);
        requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty('--cro-ship-pct', `${pct}%`)));
      }
      if (lastPct !== null && lastPct < 100 && pct >= 100) emit('cro:free-shipping-reached', {}, el);
      lastPct = pct;
    });

    register('[data-cro-note]', (area) => {
      let timer;
      area.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          fetch(`${root()}cart/update.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ note: area.value }) }).catch(() => {});
        }, 600);
      });
    });

    register('[data-cro-checkout-form]', (form) => {
      form.addEventListener('submit', (e) => {
        emit('cro:begin-checkout', {}, form);
        const input = form.querySelector('[data-cro-discount]');
        const code = input && input.value.trim();
        if (!code) return;
        e.preventDefault();
        window.location.href = `${root()}discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(`${root()}checkout`)}`;
      });
    });
  };

  if (window.CRO) boot(); else document.addEventListener('cro:core-ready', boot, { once: true });
})();
