/* Pack & Pantry CRO UI: hero slider, pop-up (timed / scroll / exit intent / idle / manual), animated stats. */
(() => {
  if (window.__croUi) return;
  window.__croUi = true;

  const boot = () => {
    const { register, store, emit, reduced } = window.CRO;

    /* ---------- hero slider ---------- */
    register('[data-cro-hero]', (el) => {
      const slides = [...el.querySelectorAll('[data-cro-hero-slide]')];
      const dots = [...el.querySelectorAll('[data-cro-hero-dot]')];
      const prev = el.querySelector('[data-cro-hero-prev]');
      const next = el.querySelector('[data-cro-hero-next]');
      const pauseBtn = el.querySelector('[data-cro-hero-pause]');
      if (slides.length < 2) return;
      let i = 0;
      let timer = null;
      let paused = reduced() || el.dataset.autoplay !== 'true';
      const delay = Math.max(3, +el.dataset.speed || 6) * 1000;
      const show = (n) => {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => { const on = k === i; s.classList.toggle('is-active', on); s.setAttribute('aria-hidden', String(!on)); s.inert = !on; });
        dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
        const v = slides[i].querySelector('video');
        if (v && !reduced()) v.play().catch(() => {});
      };
      const stop = () => { clearInterval(timer); timer = null; };
      const start = () => { stop(); if (!paused) timer = setInterval(() => show(i + 1), delay); };
      prev && prev.addEventListener('click', () => { show(i - 1); start(); });
      next && next.addEventListener('click', () => { show(i + 1); start(); });
      dots.forEach((d, k) => d.addEventListener('click', () => { show(k); start(); }));
      if (pauseBtn) {
        pauseBtn.hidden = el.dataset.autoplay !== 'true';
        pauseBtn.setAttribute('aria-pressed', String(paused));
        pauseBtn.addEventListener('click', () => { paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); start(); });
      }
      el.addEventListener('mouseenter', stop);
      el.addEventListener('mouseleave', start);
      el.addEventListener('focusin', stop);
      el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) start(); });
      let x0 = null;
      el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1) * (document.dir === 'rtl' ? -1 : 1)); start(); }
        x0 = null;
      });
      show(0);
      start();
    });

    /* ---------- pop-up ---------- */
    register('[data-cro-popup]', (dialog) => {
      const ds = dialog.dataset;
      const key = `cro-popup-${ds.key}`;
      const days = Math.max(0, +ds.days || 0);
      const closeAll = () => { if (dialog.open) dialog.close(); };
      const markSeen = () => { store.set(key, String(Date.now() + days * 864e5)); store.set('cro-popup-last', String(Date.now())); };
      if (ds.submitted === 'true') { store.set(`${key}-done`, '1'); }
      const blocked = () => {
        if (store.get(`${key}-done`) && ds.suppressAfterSubmit === 'true') return true;
        const until = +store.get(key) || 0;
        if (until > Date.now()) return true;
        const last = +store.get('cro-popup-last') || 0;
        return Date.now() - last < (+ds.gap || 0) * 1000;
      };
      const open = (reason) => {
        if (dialog.open || document.querySelector('dialog[open]') || document.querySelector('cart-drawer.is-open')) return;
        dialog.showModal();
        markSeen();
        emit('cro:popup-open', { reason }, dialog);
      };
      dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-cro-popup-close]')) closeAll(); });
      dialog.addEventListener('close', () => emit('cro:popup-close', {}, dialog));
      document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href="#cro-popup"]');
        if (a) { e.preventDefault(); if (!dialog.open) { dialog.showModal(); emit('cro:popup-open', { reason: 'manual' }, dialog); } }
      });
      const form = dialog.querySelector('form');
      if (form) form.addEventListener('submit', () => { store.set(`${key}-done`, '1'); emit('cro:popup-submit', {}, dialog); });
      if (ds.submitted === 'true') { dialog.showModal(); return; }
      if (blocked() || window.Shopify && window.Shopify.designMode && ds.preview !== 'true') {
        if (window.Shopify && window.Shopify.designMode && ds.preview === 'true') dialog.showModal();
        return;
      }
      const triggers = (ds.triggers || 'delay').split(',');
      if (triggers.includes('delay')) setTimeout(() => !blocked() && open('delay'), (+ds.delay || 8) * 1000);
      if (triggers.includes('scroll')) {
        const onScroll = () => {
          const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
          if (pct >= (+ds.scroll || 50)) { window.removeEventListener('scroll', onScroll); if (!blocked()) open('scroll'); }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
      }
      if (triggers.includes('exit') && window.matchMedia('(pointer: fine)').matches) {
        const onOut = (e) => { if (!e.relatedTarget && e.clientY <= 0) { document.removeEventListener('mouseout', onOut); if (!blocked()) open('exit'); } };
        document.addEventListener('mouseout', onOut);
      }
      if (triggers.includes('idle') && window.matchMedia('(pointer: coarse)').matches) {
        let t;
        const reset = () => { clearTimeout(t); t = setTimeout(() => { if (!blocked()) open('idle'); }, (+ds.idle || 30) * 1000); };
        ['touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
        reset();
      }
    });

    /* ---------- animated stats ---------- */
    register('[data-cro-count]', (el) => {
      const target = +el.dataset.croCount || 0;
      const decimals = (String(el.dataset.croCount).split('.')[1] || '').length;
      const fmt = (n) => n.toLocaleString(document.documentElement.lang || 'en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      if (reduced() || !('IntersectionObserver' in window)) { el.textContent = fmt(target); return; }
      el.textContent = fmt(0);
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1400;
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.4 });
      io.observe(el);
    });
  };

  if (window.CRO) boot(); else document.addEventListener('cro:core-ready', boot, { once: true });
})();
