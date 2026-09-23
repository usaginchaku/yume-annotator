(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function parseImportedFilename(name) {
    const raw = String(name || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    const base = raw.replace(/\.(txt|md)$/i, '').trim();

    // Expected: 新プロンプト_キャラ名 / 旧プロンプト_キャラ名
    // Tolerate spaces and either half/full-width underscore.
    const match = base.match(/^(新|旧)\s*プロンプト\s*[_＿]\s*(.+)$/);
    if (!match) return null;

    const character = match[2].trim();
    if (!character) return null;

    return {
      title: base,
      character,
      prompt_version: match[1] === '新' ? 'new' : 'old'
    };
  }

  function applyParsedTitleToWorkDialog() {
    const titleInput = $('workTitle');
    if (!titleInput) return false;

    const parsed = parseImportedFilename(titleInput.value);
    if (!parsed) return false;

    const characterInput = $('workCharacter');
    const versionSelect = $('workVersion');

    if (characterInput) characterInput.value = parsed.character;
    if (versionSelect) versionSelect.value = parsed.prompt_version;
    return true;
  }

  const workDialog = $('workDialog');
  if (workDialog && typeof workDialog.showModal === 'function') {
    // app.js fills title/seed first and calls showModal last.
    // Hook showModal so iPhone Safari cannot miss the filename parsing step.
    const originalShowModal = workDialog.showModal.bind(workDialog);
    workDialog.showModal = function () {
      applyParsedTitleToWorkDialog();
      return originalShowModal();
    };
  }

  // Also re-apply when title is edited manually.
  $('workTitle')?.addEventListener('change', applyParsedTitleToWorkDialog);
  $('workTitle')?.addEventListener('blur', applyParsedTitleToWorkDialog);

  // When replacing the text file inside an already-open editor,
  // app.js updates the title asynchronously in the same change event.
  $('workDialogTextFile')?.addEventListener('change', () => {
    setTimeout(applyParsedTitleToWorkDialog, 0);
    setTimeout(applyParsedTitleToWorkDialog, 50);
  });

  window.parseImportedFilename = parseImportedFilename;
  window.applyParsedImportedFilename = applyParsedTitleToWorkDialog;
})();
