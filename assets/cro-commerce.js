/* Pack & Pantry CRO commerce: add several items in one request (bundles, "complete the set"), tabs,
   scroll carousels, complementary products loader, recently viewed renderer. */
(() => {
  if (window.__croCommerce) return;
  window.__croCommerce = true;

  const boot = () => {
    const { register, store, emit, formatMoney, reduced } = window.CRO;
    const root = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    const live = (msg) => { const r = document.getElementById('LiveRegion'); if (r) r.textContent = msg; };

    /* Add several variants in one /cart/add.js call, then refresh + open the existing drawer */
    async function addItems(items, button) {
      const label = button && button.querySelector('[data-cro-btn-label]');
      const original = label ? label.textContent : '';
      if (button) { button.disabled = true; if (label && button.dataset.loading) label.textContent = button.dataset.loading; }
      try {
        const drawer = document.querySelector('[data-cart-drawer-section]');
        const body = { items };
        if (drawer) { body.sections = [drawer.dataset.sectionId]; body.sections_url = window.location.pathname; }
        const res = await fetch(`${root()}cart/add.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
        const added = await res.json();
        if (!res.ok) throw new Error(added.description || added.message || 'Unable to add these items.');
        const cart = await fetch(`${root()}cart.js`).then((r) => r.json());
        cart.sections = added.sections || {};
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
        if (window.PackPantryCart) window.PackPantryCart.render(cart, true);
        emit('cro:added', { items, source: button && button.dataset.source }, button || document);
        if (label && button.dataset.success) label.textContent = button.dataset.success;
        live(button && button.dataset.success ? button.dataset.success : 'Added to cart');
      } catch (e) {
        live(e.message);
        const err = button && button.parentElement.querySelector('[data-cro-error]');
        if (err) { err.textContent = e.message; err.hidden = false; }
      } finally {
        setTimeout(() => { if (button) { button.disabled = false; if (label) label.textContent = original; } }, 1500);
      }
    }
    window.CRO.addItems = addItems;

    /* ---------- tabs (role=tablist, arrow keys) ---------- */
    register('[data-cro-tabs]', (el) => {
      const tabs = [...el.querySelectorAll('[role="tab"]')];
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          const panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', (e) => {
          const map = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i };
          if (!(e.key in map)) return;
          e.preventDefault();
          select(tabs[(i + map[e.key] + tabs.length) % tabs.length], true);
        });
      });
    });

    /* ---------- horizontal carousel with prev/next ---------- */
    register('[data-cro-carousel]', (el) => {
      const track = el.querySelector('[data-cro-carousel-track]');
      const prev = el.querySelector('[data-cro-carousel-prev]');
      const next = el.querySelector('[data-cro-carousel-next]');
      if (!track) return;
      const step = () => { const item = track.firstElementChild; return item ? item.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth; };
      const sync = () => {
        const max = track.scrollWidth - track.clientWidth - 2;
        const x = Math.abs(track.scrollLeft);
        if (prev) prev.disabled = x <= 2;
        if (next) next.disabled = x >= max;
        el.classList.toggle('is-scrollable', max > 0);
      };
      const dir = document.dir === 'rtl' ? -1 : 1;
      prev && prev.addEventListener('click', () => track.scrollBy({ left: -step() * dir, behavior: reduced() ? 'auto' : 'smooth' }));
      next && next.addEventListener('click', () => track.scrollBy({ left: step() * dir, behavior: reduced() ? 'auto' : 'smooth' }));
      track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(sync).observe(track);
      sync();
      const delay = +el.dataset.autoplay || 0;
      if (delay > 0 && !reduced()) {
        let timer = setInterval(() => {
          const max = track.scrollWidth - track.clientWidth - 2;
          if (Math.abs(track.scrollLeft) >= max) track.scrollTo({ left: 0, behavior: 'smooth' }); else track.scrollBy({ left: step() * dir, behavior: 'smooth' });
        }, delay * 1000);
        const stop = () => { clearInterval(timer); timer = null; };
        ['mouseenter', 'focusin', 'touchstart'].forEach((ev) => el.addEventListener(ev, stop, { passive: true }));
      }
    });

    /* ---------- bundle: add all variants ---------- */
    register('[data-cro-bundle-add]', (btn) => {
      btn.addEventListener('click', () => {
        const items = JSON.parse(btn.dataset.items || '[]').filter((i) => i && i.id);
        if (items.length) addItems(items, btn);
      });
    });

    /* ---------- complementary / related products ("complete the set") ---------- */
    const bindSet = (el) => {
      const checks = [...el.querySelectorAll('[data-cro-set-check]')];
      const total = el.querySelector('[data-cro-set-total]');
      const btn = el.querySelector('[data-cro-set-add]');
      const fmt = el.dataset.moneyFormat;
      const update = () => {
        const sum = checks.filter((c) => c.checked).reduce((a, c) => a + (+c.dataset.price || 0), 0);
        if (total) total.textContent = formatMoney(sum, fmt);
        if (btn) btn.disabled = !checks.some((c) => c.checked);
      };
      checks.forEach((c) => c.addEventListener('change', update));
      update();
      btn && btn.addEventListener('click', () => {
        const items = checks.filter((c) => c.checked).map((c) => ({ id: +c.value, quantity: 1 }));
        if (items.length) addItems(items, btn);
      });
    };
    register('[data-cro-complementary]', async (el) => {
      const target = el.querySelector('[data-cro-comp-target]');
      const load = async (url) => {
        const html = await fetch(url).then((r) => r.text());
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.querySelector('[data-cro-comp-items]');
      };
      try {
        let found = el.dataset.urlComplementary ? await load(el.dataset.urlComplementary) : null;
        if ((!found || !found.querySelector('[data-cro-set-item]')) && el.dataset.urlRelated) found = await load(el.dataset.urlRelated);
        if (found && found.querySelector('[data-cro-set-item]') && target) {
          target.innerHTML = found.innerHTML;
          el.hidden = false;
          bindSet(el);
        } else if (!window.Shopify || !window.Shopify.designMode) el.hidden = true;
      } catch (e) { el.hidden = true; }
    });

    document.addEventListener('variant:changed', (e) => {
      const v = e.detail || {};
      document.querySelectorAll('[data-cro-set-base]').forEach((cb) => {
        cb.value = v.id; cb.dataset.price = v.price; cb.disabled = !v.available; if (!v.available) cb.checked = false;
        cb.dispatchEvent(new Event('change'));
      });
    });

    /* ---------- recently viewed renderer ---------- */
    register('[data-cro-rv]', (el) => {
      let list = [];
      try { list = JSON.parse(store.get('cro-recently-viewed') || '[]'); } catch (e) { list = []; }
      const exclude = +el.dataset.exclude || 0;
      const limit = +el.dataset.limit || 4;
      list = list.filter((p) => p.id !== exclude).slice(0, limit);
      const grid = el.querySelector('[data-cro-rv-grid]');
      const tpl = el.querySelector('template[data-cro-rv-template]');
      if (!list.length || !grid || !tpl) { if (!(window.Shopify && window.Shopify.designMode)) el.hidden = true; return; }
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      grid.innerHTML = list.map((p) => tpl.innerHTML
        .replace(/__URL__/g, () => esc(p.url)).replace(/__TITLE__/g, () => esc(p.title)).replace(/__PRICE__/g, () => esc(p.price))
        .replace(/__COMPARE__/g, () => esc(p.compare || '')).replace(/__IMG__/g, () => esc(p.image || '')).replace(/__ALT__/g, () => esc(p.title))).join('');
      grid.querySelectorAll('[data-cro-rv-compare]').forEach((s) => { if (!s.textContent.trim()) s.remove(); });
      grid.querySelectorAll('img').forEach((img) => { if (!img.getAttribute('src')) img.remove(); });
      el.hidden = false;
    });
  };

  if (window.CRO) boot(); else document.addEventListener('cro:core-ready', boot, { once: true });
})();
