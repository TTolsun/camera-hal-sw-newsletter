(function initSiteIntro() {
  'use strict';

  const script = document.currentScript;
  const root = new URL('../../', script.src);
  const cookieName = 'camera_hal_intro_seen';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A session cookie shares the viewing record across tabs, without persistent storage.
  if (reducedMotion || document.cookie.split(';').some((part) => part.trim() === `${cookieName}=1`)) return;
  const main = document.getElementById('main-content');
  if (!main) return;

  const english = document.documentElement.lang === 'en';
  // The intro sits inside the page instead of covering it, so readers can scroll past it at any time.
  const banner = document.createElement('section');
  banner.className = 'site-intro content-wrap';
  banner.setAttribute('aria-label', english ? 'Camera SW Newsletter intro' : 'Camera SW Newsletter 인트로');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'site-intro-skip';
  close.setAttribute('aria-label', english ? 'Skip intro' : '인트로 건너뛰기');
  close.textContent = english ? 'Skip' : '건너뛰기';
  banner.append(video, close);

  let finished = false;
  const loadingTimer = window.setTimeout(() => dismiss(false), 4000);

  function remember() {
    document.cookie = `${cookieName}=1; Path=${root.pathname}; SameSite=Lax${root.protocol === 'https:' ? '; Secure' : ''}`;
  }

  function dismiss(seen) {
    if (finished) return;
    finished = true;
    window.clearTimeout(loadingTimer);
    if (seen) remember();
    video.pause();
    banner.classList.add('is-leaving');
    window.setTimeout(() => {
      banner.remove();
      video.removeAttribute('src');
      video.load();
    }, 500);
  }

  close.addEventListener('click', () => dismiss(true));
  video.addEventListener('error', () => dismiss(false));
  video.addEventListener('playing', () => {
    window.clearTimeout(loadingTimer);
    banner.classList.add('is-playing');
  }, { once: true });
  // The last frame (title over the sea) stays as the page banner until the reader closes it.
  video.addEventListener('ended', () => {
    remember();
    close.setAttribute('aria-label', english ? 'Close intro' : '인트로 닫기');
    close.textContent = english ? 'Close' : '닫기';
  });
  main.prepend(banner);
  video.src = new URL('assets/video/camera-hal-intro.mp4', root).href;
  video.play().catch(() => dismiss(false));
})();
