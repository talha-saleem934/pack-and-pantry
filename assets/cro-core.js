/* Pack & Pantry CRO core: shared helpers, countdown engine, rotator, marquee, copy, dismiss, floating widgets.
   Loaded (deferred) by every cro-* section; the guard below makes repeated <script> tags harmless. */
(() => {
  if (window.CRO) return;
  const doc = document;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || doc.body.classList.contains('motion-none');

  /* ---------- storage (never throws) ---------- */
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    remove(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ---------- events ---------- */
  const emit = (name, detail = {}, target = doc) => target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

  /* ---------- time zone helpers (default Asia/Karachi) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const fmts = {};
  const fmt = (tz) => fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  }));
  const safeTz = (tz) => { try { fmt(tz || 'Asia/Karachi'); return tz || 'Asia/Karachi'; } catch (e) { return 'Asia/Karachi'; } };
  function parts(ms, tz) {
    const o = {};
    fmt(tz).formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: WD.indexOf(o.weekday.slice(0, 3).toLowerCase()) };
  }
  /* Wall-clock time in a zone -> epoch ms */
  function zoned(y, m, d, h, mi, s, tz) {
    const wanted = Date.UTC(y, m - 1, d, h, mi, s);
    let guess = wanted;
    for (let i = 0; i < 2; i += 1) {
      const p = parts(guess, tz);
      guess += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    }
    return guess;
  }
  const dayName = (ms, tz) => new Intl.DateTimeFormat(doc.documentElement.lang || 'en', { weekday: 'long', timeZone: tz }).format(new Date(ms));
  const parseList = (v) => (v || '').split(/[\s,;]+/).filter(Boolean);
  const parseDays = (v) => parseList(v.toLowerCase()).map((x) => (/^\d$/.test(x) ? +x : WD.indexOf(x.slice(0, 3)))).filter((x) => x >= 0 && x < 7);

  /* ---------- init registry + re-init after Section Rendering API swaps ---------- */
  const inits = [];
  const run = (root = doc) => {
    inits.forEach(([sel, fn]) => {
      root.querySelectorAll(sel).forEach((el) => {
        if (el.hasAttribute('data-cro-ready')) return;
        el.setAttribute('data-cro-ready', '');
        try { fn(el); } catch (e) { console.warn('[CRO]', e); }
      });
    });
  };
  const register = (sel, fn) => { inits.push([sel, fn]); if (started) run(); };
  let started = false;
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; run(); }); };

  /* ---------- countdown engine ---------- */
  const timers = new Set();
  let ticker = null;
  const tickAll = () => {
    timers.forEach((t) => { if (!t.el.isConnected) timers.delete(t); else t.tick(); });
    if (!timers.size) { clearInterval(ticker); ticker = null; }
  };

  function countdown(el) {
    const ds = el.dataset;
    const tz = safeTz(ds.tz);
    const mode = ds.mode || 'fixed';
    const nums = {};
    el.querySelectorAll('[data-unit]').forEach((u) => { nums[u.dataset.unit] = u.querySelector('[data-num]'); });
    const sr = el.querySelector('[data-cro-cd-sr]');
    const suffixEl = el.querySelector('[data-cro-cd-suffix]');
    const expiredEl = el.querySelector('[data-cro-cd-expired]');
    const labels = (ds.labels || 'days|hours|minutes|seconds').split('|');
    const padOn = ds.pad !== 'false';
    const urgentMs = (+ds.urgent || 0) * 60000;
    const isClone = !!el.closest('[data-cro-mq-clone]');
    const skip = parseDays(ds.skip || '');
    const holidays = parseList(ds.holidays);
    const evKey = `cro-eg-${ds.key || el.id}`;
    const evMs = (+ds.hours || 0) * 3600000;
    let target = 0;
    let lastMin = null;
    let done = false;

    const computeDaily = (now) => {
      const [ch, cm] = (ds.cutoff || '14:00').split(':').map((n) => +n || 0);
      for (let i = 0; i < 21; i += 1) {
        const p = parts(now + i * 864e5, tz);
        const ymd = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
        if (skip.includes(p.wd) || holidays.includes(ymd)) continue;
        const t = zoned(p.y, p.m, p.d, ch, cm, 0, tz);
        if (t > now) {
          target = t;
          if (suffixEl) suffixEl.textContent = i === 0 ? (ds.suffixToday || '') : (ds.suffixLater || ds.suffixToday || '').replace('{day}', dayName(t, tz));
          return;
        }
      }
      target = 0;
    };

    const expire = () => {
      if (done) return;
      done = true;
      timers.forEach((t) => { if (t.el === el) timers.delete(t); });
      el.classList.add('is-expired');
      if (ds.expire === 'message' && expiredEl) expiredEl.hidden = false; else el.hidden = true;
      if (!isClone) emit('cro:countdown-expired', { id: el.id, mode }, el);
      else el.dispatchEvent(new CustomEvent('cro:countdown-expired', { bubbles: true, detail: { id: el.id, mode, clone: true } }));
    };

    const render = (diff) => {
      const total = Math.max(0, Math.floor(diff / 1000));
      const hasDays = !!nums.d;
      const d = Math.floor(total / 86400);
      const h = hasDays ? Math.floor((total % 86400) / 3600) : Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const f = (n) => (padOn ? pad(n) : String(n));
      if (nums.d) nums.d.textContent = f(d);
      if (nums.h) nums.h.textContent = f(h);
      if (nums.m) nums.m.textContent = f(m);
      if (nums.s) nums.s.textContent = f(s);
      el.classList.toggle('is-urgent', urgentMs > 0 && diff <= urgentMs);
      const minuteKey = Math.floor(total / 60);
      if (sr && minuteKey !== lastMin) {
        lastMin = minuteKey;
        sr.textContent = `${hasDays ? `${d} ${labels[0]} ` : ''}${h} ${labels[1]} ${m} ${labels[2]}`;
      }
    };

    const tick = () => {
      if (done) return;
      const now = Date.now();
      if (mode === 'daily' && (!target || now >= target)) computeDaily(now);
      if (!target) { expire(); return; }
      let diff = target - now;
      if (diff <= 0) {
        if (mode === 'evergreen' && ds.expire === 'restart' && evMs > 0) {
          store.set(evKey, String(now)); target = now + evMs; diff = evMs;
        } else { expire(); return; }
      }
      render(diff);
    };

    const now = Date.now();
    if (mode === 'fixed') {
      const m = (ds.end || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
      if (!m) { console.warn('[CRO] countdown end date must be YYYY-MM-DD HH:MM', el); el.hidden = true; return; }
      target = zoned(+m[1], +m[2], +m[3], +(m[4] || 23), +(m[5] || (m[4] ? 0 : 59)), m[4] ? 0 : 59, tz);
    } else if (mode === 'evergreen') {
      let start = +store.get(evKey);
      if (!start) { start = now; store.set(evKey, String(start)); }
      target = evMs > 0 ? start + evMs : 0;
    }
    el.classList.add('is-ready');
    const timer = { el, tick };
    tick();
    if (done) return;
    timers.add(timer);
    if (!ticker) ticker = setInterval(tickAll, 1000);
  }

  /* Section/slide-level reaction to an expired countdown */
  doc.addEventListener('cro:countdown-expired', (e) => {
    const scope = e.target.closest && e.target.closest('[data-cro-expire-scope]');
    if (!scope) return;
    const action = scope.getAttribute('data-cro-expire-scope');
    if (action === 'hide') scope.hidden = true;
    else if (action === 'message') scope.classList.add('is-expired');
  });

  /* ---------- rotator (announcement slider) ---------- */
  function rotator(el) {
    const slides = [...el.querySelectorAll('[data-cro-slide]')];
    const prev = el.parentElement.querySelector('[data-cro-prev]');
    const next = el.parentElement.querySelector('[data-cro-next]');
    const delay = Math.max(2, +el.dataset.speed || 5) * 1000;
    const auto = el.dataset.autoplay === 'true' && !reduced();
    let idx = 0;
    let timer = null;
    let paused = false;
    const visible = () => slides.filter((s) => !s.hidden);
    const show = (i) => {
      const v = visible();
      if (!v.length) { const empty = el.closest('[data-cro-hide-empty]'); if (empty) empty.hidden = true; return; }
      idx = (i + v.length) % v.length;
      slides.forEach((s) => {
        const on = s === v[idx];
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        s.inert = !on;
      });
      [prev, next].forEach((b) => { if (b) b.hidden = v.length < 2; });
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { stop(); if (auto && !paused && visible().length > 1) timer = setInterval(() => show(idx + 1), delay); };
    prev && prev.addEventListener('click', () => { show(idx - 1); start(); });
    next && next.addEventListener('click', () => { show(idx + 1); start(); });
    const wrap = el.closest('[data-cro-rot-wrap]') || el;
    if (el.dataset.pause !== 'false') {
      wrap.addEventListener('mouseenter', () => { paused = true; stop(); });
      wrap.addEventListener('mouseleave', () => { paused = false; start(); });
    }
    wrap.addEventListener('focusin', () => { paused = true; stop(); });
    wrap.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) { paused = false; start(); } });
    el.addEventListener('cro:countdown-expired', () => setTimeout(() => { show(idx); start(); }, 0));
    show(0);
    start();
  }

  /* ---------- marquee ---------- */
  function marquee(el) {
    const track = el.querySelector('[data-cro-mq-track]');
    const group = track && track.querySelector('[data-cro-mq-group]');
    if (!group) return;
    const speed = Math.max(5, +el.dataset.speed || 40);
    let raf = 0;
    let lastW = 0;
    let lastC = 0;
    const build = () => {
      raf = 0;
      if (reduced()) return;
      const w = group.getBoundingClientRect().width;
      const c = el.clientWidth;
      if (!w || (w === lastW && c === lastC)) return;
      lastW = w; lastC = c;
      track.querySelectorAll('[data-cro-mq-clone]').forEach((n) => n.remove());
      const copies = Math.max(1, Math.ceil(c / w));
      for (let i = 0; i < copies; i += 1) {
        const clone = group.cloneNode(true);
        clone.removeAttribute('data-cro-mq-group');
        clone.setAttribute('data-cro-mq-clone', '');
        clone.setAttribute('aria-hidden', 'true');
        clone.inert = true;
        clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        clone.querySelectorAll('[data-cro-ready]').forEach((n) => n.removeAttribute('data-cro-ready'));
        clone.querySelectorAll('.is-ready').forEach((n) => n.classList.remove('is-ready'));
        track.appendChild(clone);
      }
      el.style.setProperty('--cro-mq-shift', `${w}px`);
      el.style.setProperty('--cro-mq-duration', `${(w / speed).toFixed(2)}s`);
      el.classList.add('is-ready');
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(build); };
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(queue); ro.observe(el); ro.observe(group); }
    else window.addEventListener('resize', queue);
    queue();
  }

  /* ---------- copy to clipboard ---------- */
  function copy(btn) {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || '';
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        const ta = doc.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        doc.body.appendChild(ta); ta.select();
        try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove();
      }
      if (!ok) return;
      const label = btn.querySelector('[data-cro-copy-label]');
      const status = btn.parentElement.querySelector('[data-cro-copy-status]');
      const copied = btn.dataset.copied || '';
      if (label && copied) {
        const original = label.dataset.original || label.textContent;
        label.dataset.original = original;
        label.textContent = copied;
        clearTimeout(btn._croT);
        btn._croT = setTimeout(() => { label.textContent = original; }, 2000);
      }
      if (status) { status.textContent = ''; setTimeout(() => { status.textContent = copied; }, 50); }
      emit('cro:coupon-copied', { code: text }, btn);
    });
  }

  /* ---------- dismiss ---------- */
  function dismiss(btn) {
    btn.addEventListener('click', () => {
      const target = doc.getElementById(btn.dataset.croDismiss);
      if (!target) return;
      const days = Math.max(1, +btn.dataset.days || 1);
      store.set(`cro-dismiss-${btn.dataset.key}`, String(Date.now() + days * 864e5));
      target.hidden = true;
      emit('cro:dismissed', { id: target.id }, doc);
      const main = doc.getElementById('MainContent');
      if (main) main.focus({ preventScroll: true });
    });
  }

  /* ---------- floating widgets ---------- */
  function floating(el) {
    const top = el.querySelector('[data-cro-top]');
    if (top) {
      const after = +el.dataset.topAfter || 600;
      const onScroll = () => top.classList.toggle('is-visible', window.scrollY > after);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      top.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
        const main = doc.getElementById('MainContent');
        if (main) main.focus({ preventScroll: true });
      });
    }
    el.querySelectorAll('[data-cro-wa]').forEach((a) => a.addEventListener('click', () => emit('cro:whatsapp-click', { source: a.dataset.croWa }, a)));
    el.querySelectorAll('[data-cro-call]').forEach((a) => a.addEventListener('click', () => emit('cro:call-click', { source: 'floating' }, a)));
  }

  register('[data-cro-hide-after]', (el) => {
    const m = (el.dataset.croHideAfter || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (!m) return;
    const tz = safeTz(el.dataset.tz);
    const end = zoned(+m[1], +m[2], +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59, m[4] ? 0 : 59, tz);
    const check = () => { if (Date.now() >= end) { el.hidden = true; return true; } return false; };
    if (!check()) { const left = end - Date.now(); if (left < 864e5 * 20) setTimeout(check, left + 500); }
  });
  register('[data-cro-countdown]', countdown);
  register('[data-cro-rotator]', rotator);
  register('[data-cro-marquee]', marquee);
  register('[data-cro-copy]', copy);
  register('[data-cro-dismiss]', dismiss);
  register('[data-cro-floating]', floating);

  /* Money formatting from the shop's own format string (e.g. 'Rs.{{amount}}') */
  const formatMoney = (cents, format) => {
    const f = format || window.CRO_MONEY_FORMAT || '{{amount}}';
    const n = (Number(cents) || 0) / 100;
    const group = (v, d, t, s) => { const [i, dec] = v.toFixed(d).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, t) + (dec ? s + dec : ''); };
    return f.replace(/\{\{\s*(\w+)\s*\}\}/, (m, k) => ({
      amount: group(n, 2, ',', '.'), amount_no_decimals: group(n, 0, ',', '.'),
      amount_with_comma_separator: group(n, 2, '.', ','), amount_no_decimals_with_comma_separator: group(n, 0, '.', ','),
      amount_with_apostrophe_separator: group(n, 2, "'", '.'), amount_with_space_separator: group(n, 2, ' ', ',')
    })[k] || group(n, 2, ',', '.'));
  };

  window.CRO = { store, emit, pad, parts, zoned, safeTz, dayName, parseDays, parseList, reduced, register, run, formatMoney };
  doc.dispatchEvent(new CustomEvent('cro:core-ready'));

  const start = () => {
    started = true;
    run();
    new MutationObserver((records) => {
      if (records.some((r) => [...r.addedNodes].some((n) => n.nodeType === 1))) schedule();
    }).observe(doc.body, { childList: true, subtree: true });
    ['cart:updated', 'variant:changed', 'quick-add:loaded', 'shopify:section:load'].forEach((name) => doc.addEventListener(name, () => setTimeout(run, 0)));
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
