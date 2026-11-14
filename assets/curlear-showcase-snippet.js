(() => {
  if (window.__curlearShowcaseLoaded) return;
  window.__curlearShowcaseLoaded = true;

  const getVideo = (wrap) => {
    if (!wrap) return null;
    return (
      wrap.querySelector('video.curlear-showcase-snippet__media') ||
      wrap.querySelector('video')
    );
  };

  const setMutedUI = (btn, muted) => {
    if (!btn) return;
    btn.dataset.muted = muted ? 'true' : 'false';
    btn.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
    const label = btn.querySelector('[data-curlear-showcase-mute-label]');
    if (label) label.textContent = muted ? '🔇' : '🔊';
  };

  const applyMuteState = (video, muted) => {
    if (!video) return;
    video.muted = muted;
    video.defaultMuted = muted;
    if (muted) {
      video.setAttribute('muted', '');
    } else {
      video.removeAttribute('muted');
      try {
        video.volume = 1;
      } catch (e) {}
    }
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  const stepFor = (track) => {
    const first = track.querySelector('.curlear-showcase-snippet__item');
    if (!first) return 0;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    return first.getBoundingClientRect().width + gap;
  };

  const moveTrack = (track, dir = 1) => {
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 1) return;
    const amount = stepFor(track);
    if (amount <= 0) return;

    if (dir > 0 && track.scrollLeft >= maxScroll - 2) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    if (dir < 0 && track.scrollLeft <= 2) {
      track.scrollTo({ left: maxScroll, behavior: 'smooth' });
      return;
    }
    const nextPos = track.scrollLeft + amount * dir;
    track.scrollTo({ left: Math.max(0, Math.min(nextPos, maxScroll)), behavior: 'smooth' });
  };

  const updateNavState = (root) => {
    const track = root.querySelector('[data-curlear-showcase-track]');
    const prev = root.querySelector('[data-curlear-showcase-prev]');
    const next = root.querySelector('[data-curlear-showcase-next]');
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const canScroll = maxScroll > 1;
    if (prev) prev.classList.toggle('is-hidden', !canScroll || track.scrollLeft <= 2);
    if (next) next.classList.toggle('is-hidden', !canScroll);
  };

  const initRoot = (root) => {
    if (!root || root.dataset.showcaseReady === 'true') return;
    root.dataset.showcaseReady = 'true';

    const track = root.querySelector('[data-curlear-showcase-track]');
    if (!track) return;

    // Sync mute buttons with videos
    root.querySelectorAll('[data-curlear-showcase-mute]').forEach((btn) => {
      const wrap = btn.closest('.curlear-showcase-snippet__media-wrap--video');
      const video = getVideo(wrap);
      if (!video) return;
      const muted = video.muted !== false;
      if (muted) video.setAttribute('muted', '');
      setMutedUI(btn, muted);
      // Try autoplay muted
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    });

    track.addEventListener('scroll', () => updateNavState(root), { passive: true });
    window.addEventListener('resize', () => updateNavState(root));
    updateNavState(root);

    // Autoslider only when marked active and content overflows
    if (root.dataset.sliderActive === 'true') {
      const speed = Math.max(2000, parseInt(root.dataset.speed || '4000', 10) || 4000);
      let timer = null;
      const startAuto = () => {
        clearInterval(timer);
        timer = setInterval(() => {
          if (track.scrollWidth - track.clientWidth > 1) moveTrack(track, 1);
        }, speed);
      };
      const stopAuto = () => clearInterval(timer);
      startAuto();
      root.addEventListener('mouseenter', stopAuto);
      root.addEventListener('mouseleave', startAuto);
      root.addEventListener('touchstart', stopAuto, { passive: true });
      root.addEventListener('touchend', startAuto, { passive: true });
      root.__curlearStopAuto = stopAuto;
      root.__curlearStartAuto = startAuto;
    }
  };

  const boot = (scope) => {
    const base = scope && scope.querySelectorAll ? scope : document;
    let roots = [];
    if (base.matches && base.matches('[data-curlear-showcase]')) {
      roots = [base];
    } else {
      roots = Array.from(base.querySelectorAll('[data-curlear-showcase]'));
    }
    roots.forEach(initRoot);
  };

  // Global click handlers (works even if theme re-renders blocks)
  document.addEventListener(
    'click',
    (event) => {
      const muteBtn = event.target.closest('[data-curlear-showcase-mute]');
      if (muteBtn) {
        const root = muteBtn.closest('[data-curlear-showcase]');
        if (!root) return;
        event.preventDefault();
        event.stopPropagation();

        const wrap = muteBtn.closest('.curlear-showcase-snippet__media-wrap--video');
        const video = getVideo(wrap);
        if (!video) return;

        const currentlyMuted = muteBtn.dataset.muted !== 'false' || video.muted;
        const nextMuted = !currentlyMuted;

        if (!nextMuted) {
          root.querySelectorAll('.curlear-showcase-snippet__media-wrap--video').forEach((otherWrap) => {
            if (otherWrap === wrap) return;
            const otherVideo = getVideo(otherWrap);
            const otherBtn = otherWrap.querySelector('[data-curlear-showcase-mute]');
            if (otherVideo) applyMuteState(otherVideo, true);
            if (otherBtn) setMutedUI(otherBtn, true);
          });
          if (typeof root.__curlearStopAuto === 'function') root.__curlearStopAuto();
        }

        applyMuteState(video, nextMuted);
        setMutedUI(muteBtn, nextMuted);
        return;
      }

      const prevBtn = event.target.closest('[data-curlear-showcase-prev]');
      const nextBtn = event.target.closest('[data-curlear-showcase-next]');
      if (!prevBtn && !nextBtn) return;

      const root = (prevBtn || nextBtn).closest('[data-curlear-showcase]');
      if (!root) return;
      event.preventDefault();
      event.stopPropagation();

      const track = root.querySelector('[data-curlear-showcase-track]');
      moveTrack(track, nextBtn ? 1 : -1);
      updateNavState(root);
      if (typeof root.__curlearStopAuto === 'function') root.__curlearStopAuto();
      if (typeof root.__curlearStartAuto === 'function') {
        clearTimeout(root.__curlearResumeTimer);
        root.__curlearResumeTimer = setTimeout(() => root.__curlearStartAuto(), 4000);
      }
    },
    true
  );

  const start = () => boot(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  window.addEventListener('load', start);
  document.addEventListener('shopify:section:load', (event) => boot(event.target));
  document.addEventListener('curlear:showcase:init', (event) => {
    boot((event.detail && event.detail.root) || document);
  });

  // Late boot for themes that inject product blocks after load
  setTimeout(start, 500);
  setTimeout(start, 1500);
})();