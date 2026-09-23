(() => {
  'use strict';

  const dialog = document.getElementById('annotationEditDialog');
  const hiddenSelect = document.getElementById('editAnnotationRating');
  const ratingRow = document.getElementById('editRatingRow');
  if (!dialog || !hiddenSelect || !ratingRow) return;

  const buttons = [...ratingRow.querySelectorAll('.rating-btn[data-rating]')];

  function syncButtons() {
    const current = String(hiddenSelect.value);
    buttons.forEach(button => {
      const selected = button.dataset.rating === current;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      hiddenSelect.value = button.dataset.rating;
      hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      syncButtons();
    });
  });

  const originalShowModal = dialog.showModal.bind(dialog);
  dialog.showModal = function() {
    syncButtons();
    originalShowModal();
    requestAnimationFrame(() => {
      syncButtons();
      const selected = buttons.find(button => button.classList.contains('selected')) || buttons[0];
      try { selected?.focus({ preventScroll: true }); } catch (_) { selected?.focus(); }
    });
  };
})();
