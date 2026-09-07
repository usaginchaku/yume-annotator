(() => {
  'use strict';

  const bar = document.getElementById('bottomEval');
  const reader = document.getElementById('readerView');
  if (!bar || !reader) return;

  // iPhone Safari can treat fixed descendants inconsistently while its browser
  // chrome expands/collapses. Keep the evaluation bar as a direct child of
  // <body>, outside the scrolling app tree, and let fixed positioning do the
  // work without any scroll-offset translation.
  if (bar.parentElement !== document.body) {
    document.body.appendChild(bar);
  }

  function pinBar() {
    if (reader.hidden) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    bar.style.setProperty('position', 'fixed', 'important');
    bar.style.setProperty('left', '0', 'important');
    bar.style.setProperty('right', '0', 'important');
    bar.style.setProperty('top', 'auto', 'important');
    bar.style.setProperty('bottom', '0', 'important');
    bar.style.setProperty('transform', 'none', 'important');
    bar.style.setProperty('-webkit-transform', 'none', 'important');
    bar.style.setProperty('z-index', '9999', 'important');
  }

  // showView() toggles reader.hidden and bottomEval.hidden. Observe the reader
  // so the bar is pinned immediately whenever the reading view becomes active.
  new MutationObserver(pinBar).observe(reader, {
    attributes: true,
    attributeFilter: ['hidden']
  });

  // Reassert the fixed styles when Safari changes its visible viewport. No
  // scroll distance is added here; that was the source of the gradual drift.
  window.addEventListener('pageshow', pinBar, { passive: true });
  window.addEventListener('resize', pinBar, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(pinBar, 100), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', pinBar, { passive: true });
    window.visualViewport.addEventListener('scroll', pinBar, { passive: true });
  }

  pinBar();
})();
