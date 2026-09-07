(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function optionValues(datalistId) {
    const list = $(datalistId);
    if (!list) return [];
    return [...list.querySelectorAll('option')]
      .map(option => option.value.trim())
      .filter(Boolean);
  }

  function setupSiteSuggestions(inputId, datalistId) {
    const input = $(inputId);
    if (!input) return;

    // Safari's native datalist UI is inconsistent on iPhone, so keep the
    // datalist only as a data source and render our own in-app suggestions.
    input.removeAttribute('list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');

    const host = document.createElement('div');
    host.className = 'suggest-host';
    input.parentNode.insertBefore(host, input);
    host.appendChild(input);

    const popup = document.createElement('div');
    popup.className = 'site-suggestions';
    popup.hidden = true;
    popup.setAttribute('role', 'listbox');
    host.appendChild(popup);

    const close = () => { popup.hidden = true; };

    const render = () => {
      const all = optionValues(datalistId);
      const query = input.value.trim().toLocaleLowerCase('ja');
      const matches = all
        .filter(value => !query || value.toLocaleLowerCase('ja').includes(query))
        .slice(0, 12);

      if (!matches.length) {
        popup.replaceChildren();
        close();
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const value of matches) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'site-suggestion-item';
        button.setAttribute('role', 'option');
        button.textContent = value;
        button.addEventListener('pointerdown', event => {
          // Keep Safari from moving focus before the value is applied.
          event.preventDefault();
        });
        button.addEventListener('click', () => {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles:true }));
          input.dispatchEvent(new Event('change', { bubbles:true }));
          close();
          input.blur();
        });
        fragment.appendChild(button);
      }

      // Important: append the DocumentFragment as DOM nodes. Assigning it to
      // innerHTML stringifies it as "[object DocumentFragment]".
      popup.replaceChildren(fragment);
      popup.hidden = false;
    };

    input.addEventListener('focus', () => requestAnimationFrame(render));
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });

    document.addEventListener('pointerdown', event => {
      if (!host.contains(event.target)) close();
    });
  }

  setupSiteSuggestions('workCharacter', 'characterSuggestions');
  setupSiteSuggestions('workSeries', 'seriesSuggestions');
  setupSiteSuggestions('workPair', 'pairSuggestions');
})();
