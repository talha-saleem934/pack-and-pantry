/* Pack & Pantry: confetti burst after a successful add to cart.
   Fires when a product form submit (theme.js addProduct) is followed by `cart:updated`, or on `cro:added`
   (bundles / complete-the-set). Never fires for quantity changes in the drawer. Skipped for reduced motion.
   Options come from data attributes on <script data-cro-confetti-config>. */
(() => {
  if (window.__croConfetti) return;
  window.__croConfetti = true;

  const cfgEl = () => document.querySelector('[data-cro-confetti-config]');
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('motion-none');
  let pending = 0;
  let origin = null;

  function burst(x, y) {
    const el = cfgEl();
    if (!el || el.dataset.enabled !== 'true' || reduced()) return;
    const colors = (el.dataset.colors || '#173F35,#E8B44A,#D4623D,#DCE8D8').split(',').map((c) => c.trim()).filter(Boolean);
    const count = Math.min(220, Math.max(20, +el.dataset.count || 120));
    const duration = Math.min(4000, Math.max(800, +el.dataset.duration || 1800));
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const ox = x == null ? window.innerWidth / 2 : x;
    const oy = y == null ? window.innerHeight * 0.4 : y;
    const pieces = Array.from({ length: count }, () => {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 7 + Math.random() * 9;
      return {
        x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() < 0.3 ? 'c' : 'r'
      };
    });
    const start = performance.now();
    const frame = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fade = t > duration - 400 ? Math.max(0, (duration - t) / 400) : 1;
      pieces.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.shape === 'c') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.6);
        ctx.restore();
      });
      if (t < duration) requestAnimationFrame(frame); else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  document.addEventListener('submit', (e) => {
    if (!e.target.closest || !e.target.closest('[data-product-form]')) return;
    pending = Date.now();
    const btn = e.submitter || e.target.querySelector('[type="submit"]');
    const sticky = document.querySelector('.cro-satc.is-visible [data-sticky-add]');
    const src = sticky && document.activeElement === sticky ? sticky : btn;
    if (src && src.getBoundingClientRect) {
      const r = src.getBoundingClientRect();
      origin = (r.width && r.bottom > 0 && r.top < window.innerHeight) ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    } else origin = null;
  }, true);

  document.addEventListener('cart:updated', () => {
    if (!pending || Date.now() - pending > 10000) return;
    pending = 0;
    burst(origin && origin.x, origin && origin.y);
  });

  document.addEventListener('cro:added', (e) => {
    const t = e.target && e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : null;
    burst(t && t.width ? t.left + t.width / 2 : null, t && t.width ? t.top + t.height / 2 : null);
  });

  window.CROConfetti = { burst };
})();
