/* Pack & Pantry CRO product page: gallery, variant dropdown/swatches, quantity breaks, sticky add to cart,
   delivery estimator, native share, recently-viewed recording. Re-initialises automatically when theme.js
   re-renders the product section (cro-core MutationObserver). */
(() => {
  if (window.__croProduct) return;
  window.__croProduct = true;

  const boot = () => {
    const { register, store, reduced, parts, zoned, safeTz, parseDays, parseList, emit } = window.CRO;

    /* ---------- gallery ---------- */
    register('[data-cro-gallery]', (el) => {
      const track = el.querySelector('[data-cro-gallery-track]');
      const slides = [...el.querySelectorAll('[data-cro-gallery-slide]')];
      const thumbs = [...el.querySelectorAll('[data-cro-thumb]')];
      const current = el.querySelector('[data-cro-gallery-current]');
      const prev = el.querySelector('[data-cro-gallery-prev]');
      const next = el.querySelector('[data-cro-gallery-next]');
      if (!track || !slides.length) return;
      let index = Math.min(+el.dataset.start || 0, slides.length - 1);
      const setActive = (i) => {
        index = i;
        thumbs.forEach((t, n) => { t.classList.toggle('is-active', n === i); t.setAttribute('aria-current', n === i ? 'true' : 'false'); });
        if (current) current.textContent = String(i + 1);
        if (prev) prev.disabled = i === 0;
        if (next) next.disabled = i === slides.length - 1;
        const thumb = thumbs[i];
        if (thumb && thumb.parentElement) {
          const strip = thumb.parentElement;
          const t = thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2;
          strip.scrollTo({ left: t, top: thumb.offsetTop - strip.clientHeight / 2 + thumb.clientHeight / 2, behavior: 'auto' });
        }
      };
      const go = (i, smooth = true) => {
        const target = slides[Math.max(0, Math.min(i, slides.length - 1))];
        track.scrollTo({ left: target.offsetLeft, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
        setActive(slides.indexOf(target));
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(slides.indexOf(e.target)); });
        }, { root: track, threshold: [0.6] });
        slides.forEach((s) => io.observe(s));
      }
      thumbs.forEach((t, n) => t.addEventListener('click', () => go(n)));
      prev && prev.addEventListener('click', () => go(index - 1));
      next && next.addEventListener('click', () => go(index + 1));
      track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + (document.dir === 'rtl' ? -1 : 1)); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index + (document.dir === 'rtl' ? 1 : -1)); }
      });
      if (el.dataset.zoom === 'true' && window.matchMedia('(hover: hover)').matches) {
        el.querySelectorAll('[data-cro-zoom]').forEach((z) => {
          const img = z.querySelector('img');
          if (!img) return;
          z.addEventListener('mousemove', (e) => {
            const r = z.getBoundingClientRect();
            img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
            z.classList.add('is-zoomed');
          });
          z.addEventListener('mouseleave', () => z.classList.remove('is-zoomed'));
        });
      }
      requestAnimationFrame(() => go(index, false));
    });

    /* ---------- variant dropdown keeps theme.js radios in sync ---------- */
    register('[data-cro-select-sync]', (select) => {
      select.addEventListener('change', (e) => {
        e.stopPropagation();
        const group = select.closest('[data-option-group]');
        const radio = group && [...group.querySelectorAll('input[type="radio"]')].find((r) => r.value === select.value);
        if (!radio) return;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    /* ---------- size guide dialog ---------- */
    register('[data-cro-dialog-open]', (btn) => {
      btn.addEventListener('click', () => {
        const d = document.getElementById(btn.dataset.croDialogOpen);
        if (d && d.showModal) d.showModal();
      });
    });
    register('[data-cro-dialog]', (d) => {
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cro-dialog-close]')) d.close(); });
    });

    /* ---------- quantity breaks ---------- */
    register('[data-cro-qty-breaks]', (el) => {
      const input = document.getElementById(el.dataset.target);
      const tiles = [...el.querySelectorAll('[data-qty]')];
      if (!input || !tiles.length) return;
      const mark = (q) => tiles.forEach((t) => t.setAttribute('aria-pressed', String(+t.dataset.qty === q)));
      tiles.forEach((t) => t.addEventListener('click', () => {
        input.value = t.dataset.qty;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        mark(+t.dataset.qty);
        emit('cro:qty-break', { qty: +t.dataset.qty }, t);
      }));
      input.addEventListener('change', () => mark(+input.value));
      const preset = tiles.find((t) => t.dataset.default === 'true');
      if (preset) { input.value = preset.dataset.qty; mark(+preset.dataset.qty); } else mark(+input.value);
    });

    /* ---------- sticky add to cart (desktop + mobile) ---------- */
    register('[data-cro-satc]', (bar) => {
      const root = bar.closest('[data-main-product]');
      const main = root && (root.querySelector('[data-cro-main-atc]') || root.querySelector('[name="add"]'));
      const mainQty = root && root.querySelector('[data-product-form] input[name="quantity"]');
      const qty = bar.querySelector('[data-cro-satc-qty]');
      if (!main) return;
      const show = (on) => {
        bar.classList.toggle('is-visible', on);
        bar.setAttribute('aria-hidden', on ? 'false' : 'true');
        bar.inert = !on;
      };
      show(false);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => show(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 }).observe(main);
      }
      if (qty && mainQty) {
        qty.addEventListener('change', () => { mainQty.value = Math.max(1, +qty.value || 1); });
        mainQty.addEventListener('change', () => { qty.value = mainQty.value; });
        bar.querySelectorAll('[data-cro-satc-step]').forEach((b) => b.addEventListener('click', () => {
          qty.value = Math.max(1, (+qty.value || 1) + (+b.dataset.croSatcStep));
          qty.dispatchEvent(new Event('change'));
        }));
      }
    });

    /* ---------- delivery estimator (shop timezone, working days) ---------- */
    register('[data-cro-delivery]', (el) => {
      const ds = el.dataset;
      const tz = safeTz(ds.tz);
      const skip = parseDays(ds.skip || '');
      const holidays = parseList(ds.holidays);
      const out = el.querySelector('[data-cro-delivery-dates]');
      const extra = el.querySelector('[data-cro-delivery-extra]');
      const select = el.querySelector('[data-cro-delivery-city]');
      const fmt = new Intl.DateTimeFormat(document.documentElement.lang || 'en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
      const isWorking = (ms) => {
        const p = parts(ms, tz);
        const ymd = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
        return !skip.includes(p.wd) && !holidays.includes(ymd);
      };
      const addWorking = (ms, n) => { let t = ms; let left = n; while (left > 0) { t += 864e5; if (isWorking(t)) left -= 1; } return t; };
      const render = () => {
        const opt = select && select.selectedOptions[0];
        const min = +(opt && opt.dataset.min || ds.min) || 0;
        const max = Math.max(min, +(opt && opt.dataset.max || ds.max) || min);
        const now = Date.now();
        const p = parts(now, tz);
        const cutoff = zoned(p.y, p.m, p.d, +ds.cutoff || 0, 0, 0, tz);
        let dispatch = now;
        if (!isWorking(now) || now >= cutoff) { dispatch = now; do { dispatch += 864e5; } while (!isWorking(dispatch)); }
        const a = addWorking(dispatch, min);
        const b = addWorking(dispatch, max);
        if (out) out.textContent = (ds.template || '{start} – {end}').replace('{start}', fmt.format(a)).replace('{end}', fmt.format(b));
        if (extra) extra.textContent = opt ? (opt.dataset.note || '') : '';
        el.classList.add('is-ready');
      };
      if (select) {
        const saved = store.get('cro-delivery-city');
        if (saved && [...select.options].some((o) => o.value === saved)) select.value = saved;
        select.addEventListener('change', () => { store.set('cro-delivery-city', select.value); render(); });
      }
      render();
    });

    /* ---------- native share ---------- */
    register('[data-cro-native-share]', (btn) => {
      if (!navigator.share) { btn.hidden = true; return; }
      btn.hidden = false;
      btn.addEventListener('click', () => {
        navigator.share({ title: btn.dataset.title, url: btn.dataset.url }).catch(() => {});
        emit('cro:share', { method: 'native' }, btn);
      });
    });

    /* ---------- WhatsApp order: current variant + quantity ---------- */
    register('[data-cro-wa-order]', (a) => {
      a.addEventListener('click', () => {
        const form = a.closest('[data-product-form]') || (a.closest('[data-main-product]') || document).querySelector('[data-product-form]');
        const qty = form && form.querySelector('input[name="quantity"]');
        const msg = (a.dataset.message || '').replace('{qty}', qty ? qty.value : '1');
        a.href = `https://wa.me/${a.dataset.number}?text=${encodeURIComponent(msg)}`;
        emit('cro:whatsapp-click', { source: 'product-order' }, a);
      });
    });

    /* ---------- recently viewed: record this product ---------- */
    register('[data-cro-rv-record]', (script) => {
      let item;
      try { item = JSON.parse(script.textContent); } catch (e) { return; }
      if (!item || !item.id) return;
      let list = [];
      try { list = JSON.parse(store.get('cro-recently-viewed') || '[]'); } catch (e) { list = []; }
      list = [item, ...list.filter((p) => p.id !== item.id)].slice(0, 16);
      store.set('cro-recently-viewed', JSON.stringify(list));
      window.__croViewed = window.__croViewed || {};
      if (!window.__croViewed[item.id]) { window.__croViewed[item.id] = true; emit('cro:view-item', item, document); }
    });
  };

  if (window.CRO) boot(); else document.addEventListener('cro:core-ready', boot, { once: true });
})();
