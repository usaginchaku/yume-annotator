(() => {
  'use strict';

  const bar = document.getElementById('bottomEval');
  const reader = document.getElementById('readerView');
  if (!bar || !reader) return;

  // Build a reader shell once: the article body scrolls, the evaluation bar does not.
  let scroller = document.getElementById('readerScrollBody');
  if (!scroller) {
    scroller = document.createElement('div');
    scroller.id = 'readerScrollBody';

    const header = reader.querySelector('.reader-header');
    const textWrap = reader.querySelector('.text-wrap');
    reader.insertBefore(scroller, reader.firstChild);
    if (header) scroller.appendChild(header);
    if (textWrap) scroller.appendChild(textWrap);
  }

  if (bar.parentElement !== reader) {
    reader.appendChild(bar);
  }

  function syncReaderMode() {
    const active = !reader.hidden;
    document.body.classList.toggle('reader-mode', active);
    bar.hidden = !active;

    // Clear styles written by the legacy fixed-position logic in app.js.
    bar.style.removeProperty('position');
    bar.style.removeProperty('left');
    bar.style.removeProperty('right');
    bar.style.removeProperty('top');
    bar.style.removeProperty('bottom');
    bar.style.removeProperty('transform');
    bar.style.removeProperty('-webkit-transform');
    bar.style.removeProperty('z-index');
  }

  new MutationObserver(syncReaderMode).observe(reader, {
    attributes: true,
    attributeFilter: ['hidden']
  });

  // app.js may rewrite the bar's inline fixed styles after selection/scroll events.
  // Strip those mutations immediately; CSS keeps the bar as a normal flex item.
  new MutationObserver(() => {
    if (reader.hidden) return;
    if (bar.style.position || bar.style.bottom || bar.style.transform || bar.style.webkitTransform) {
      bar.style.removeProperty('position');
      bar.style.removeProperty('left');
      bar.style.removeProperty('right');
      bar.style.removeProperty('top');
      bar.style.removeProperty('bottom');
      bar.style.removeProperty('transform');
      bar.style.removeProperty('-webkit-transform');
      bar.style.removeProperty('z-index');
    }
  }).observe(bar, { attributes: true, attributeFilter: ['style', 'hidden'] });

  window.addEventListener('pageshow', syncReaderMode, { passive:true });
  syncReaderMode();
})();
