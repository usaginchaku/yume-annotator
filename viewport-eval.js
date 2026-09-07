(() => {
  'use strict';
  const bar = document.getElementById('bottomEval');
  const reader = document.getElementById('readerView');
  if (!bar || !reader) return;

  let raf = 0;
  function placeBar() {
    raf = 0;
    if (reader.hidden) return;
    bar.hidden = false;
    bar.style.position = 'fixed';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.top = 'auto';
    bar.style.bottom = '0';
    const vv = window.visualViewport;
    const delta = vv ? Math.round(vv.offsetTop + vv.height - window.innerHeight) : 0;
    const t = `translate3d(0, ${delta}px, 0)`;
    bar.style.transform = t;
    bar.style.webkitTransform = t;
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(placeBar);
  }
  window.addEventListener('scroll', schedule, { passive:true });
  window.addEventListener('resize', schedule, { passive:true });
  document.addEventListener('touchmove', schedule, { passive:true });
  document.addEventListener('touchend', schedule, { passive:true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('scroll', schedule, { passive:true });
    window.visualViewport.addEventListener('resize', schedule, { passive:true });
  }
  new MutationObserver(schedule).observe(reader, { attributes:true, attributeFilter:['hidden'] });
  schedule();
})();
