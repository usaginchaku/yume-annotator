(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function parseImportedFilename(name) {
    const base = String(name || '').replace(/\.(txt|md)$/i, '').trim();
    const match = base.match(/^(新|旧)プロンプト_(.+)$/);
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
    const dialog = $('workDialog');
    if (!dialog || !dialog.open) return;
    const title = $('workTitle')?.value || '';
    const parsed = parseImportedFilename(title);
    if (!parsed) return;
    const character = $('workCharacter');
    const version = $('workVersion');
    if (character) character.value = parsed.character;
    if (version) version.value = parsed.prompt_version;
  }

  const workDialog = $('workDialog');
  if (workDialog) {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'open' && workDialog.open) {
          queueMicrotask(applyParsedTitleToWorkDialog);
          setTimeout(applyParsedTitleToWorkDialog, 0);
          setTimeout(applyParsedTitleToWorkDialog, 80);
        }
      }
    });
    observer.observe(workDialog, { attributes: true, attributeFilter: ['open'] });
  }

  const titleInput = $('workTitle');
  titleInput?.addEventListener('change', applyParsedTitleToWorkDialog);

  const replaceFileInput = $('workDialogTextFile');
  replaceFileInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseImportedFilename(file.name);
    if (!parsed) return;
    setTimeout(() => {
      const character = $('workCharacter');
      const version = $('workVersion');
      if (character) character.value = parsed.character;
      if (version) version.value = parsed.prompt_version;
    }, 0);
  });

  window.parseImportedFilename = parseImportedFilename;
})();
