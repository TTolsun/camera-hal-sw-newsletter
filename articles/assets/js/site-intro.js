(function initSiteIntro() {
  'use strict';

  const script = document.currentScript;
  const root = new URL('../../', script.src);
  const cookieName = 'camera_hal_intro_seen';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A session cookie shares the viewing record across tabs, without persistent storage.
  if (reducedMotion || document.cookie.split(';').some((part) => part.trim() === `${cookieName}=1`)) return;
  if (typeof HTMLDialogElement === 'undefined') return;

  const english = document.documentElement.lang === 'en';
  const dialog = document.createElement('dialog');
  dialog.className = 'site-intro';
  dialog.tabIndex = -1;
  dialog.setAttribute('aria-label', english ? 'Camera SW Newsletter intro' : 'Camera SW Newsletter 인트로');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'site-intro-skip';
  skip.setAttribute('aria-label', 'Skip intro');
  skip.textContent = 'Skip';
  dialog.append(video, skip);

  let finished = false;
  let playbackTimer;
  const loadingTimer = window.setTimeout(() => finish(false), 4000);

  function finish(remember) {
    if (finished) return;
    finished = true;
    window.clearTimeout(loadingTimer);
    window.clearTimeout(playbackTimer);
    if (remember) {
      document.cookie = `${cookieName}=1; Path=${root.pathname}; SameSite=Lax${root.protocol === 'https:' ? '; Secure' : ''}`;
    }
    video.pause();
    dialog.classList.add('is-leaving');
    window.setTimeout(() => {
      dialog.close();
      dialog.remove();
      document.documentElement.classList.remove('site-intro-open');
      video.removeAttribute('src');
      video.load();
    }, 700);
  }

  skip.addEventListener('click', () => finish(true));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(true);
  });
  video.addEventListener('ended', () => finish(true));
  video.addEventListener('error', () => finish(false));
  video.addEventListener('playing', () => {
    window.clearTimeout(loadingTimer);
    // Keep the page reachable even if playback later stalls.
    playbackTimer = window.setTimeout(() => finish(true), 10000);
  }, { once: true });
  window.addEventListener('pagehide', () => finish(false), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  document.documentElement.classList.add('site-intro-open');
  dialog.focus({ preventScroll: true });
  video.src = new URL('assets/video/camera-hal-intro.mp4', root).href;
  video.play().catch(() => finish(false));
})();
