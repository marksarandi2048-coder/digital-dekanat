'use strict';
// «Спроси деканат»: строка поиска, популярные вопросы и ответы.
// Используется в разделе «Помощь» и вверху «Заявок». Всё выводится через textContent.
window.DekanatHelp = (function () {
  const D = window.Dekanat;
  const el = D.el;
  const DEBOUNCE_MS = 200;
  const MIN_LENGTH = 2;

  let uid = 0;

  function renderResult(r, open) {
    const item = el('details', 'help-item');
    item.open = open;
    const summary = el('summary', 'help-item__question');
    summary.append(el('span', null, r.question));
    const body = el('div', 'help-item__body');
    body.append(el('span', 'badge', r.category), el('p', 'help-item__answer', r.answer));
    if (r.action) {
      const a = el('a', 'button button--secondary button--small help-item__action', r.action.label);
      a.href = r.action.href;
      body.append(a);
    }
    item.append(summary, body);
    return item;
  }

  function mount(box, { compact = false, limit = 5, chips = 7, syncAddress = false, initial = '' } = {}) {
    const id = `help-q-${(uid += 1)}`;
    const form = el('form', 'help-form');
    form.setAttribute('role', 'search');
    const label = el('label', compact ? 'help-form__label' : 'visually-hidden', 'Спроси деканат');
    label.htmlFor = id;
    const input = el('input', 'help-form__input');
    input.id = id;
    input.type = 'search';
    input.maxLength = 200;
    input.autocomplete = 'off';
    input.placeholder = 'Например: академ, общага';
    input.value = initial;
    form.append(label, input);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      run();
    });

    const results = el('div', 'help-results');
    results.setAttribute('aria-live', 'polite');
    box.replaceChildren(form, results);

    let requestId = 0;
    let timer = null;

    function showPopular(list) {
      const wrap = el('div', 'help-popular');
      wrap.append(el('p', 'muted help-popular__title', 'Часто спрашивают'));
      const row = el('div', 'help-chips');
      for (const p of list.slice(0, chips)) {
        const b = el('button', 'help-chip', p.question);
        b.type = 'button';
        b.addEventListener('click', () => {
          input.value = p.question;
          run();
        });
        row.append(b);
      }
      wrap.append(row);
      results.replaceChildren(wrap);
    }

    function showNothing(q) {
      const none = el('div', 'help-none');
      none.append(el('p', 'help-none__title', 'Не нашли ответ? Напишите в деканат'));
      const a = el('a', 'button button--small help-item__action', 'Написать в деканат');
      a.href = `/requests/new?type=appeal&topic=${encodeURIComponent(q)}`;
      none.append(a);
      results.replaceChildren(none);
    }

    function showResults(list, q) {
      const wrap = el('div', 'help-list');
      list.slice(0, limit).forEach((r, i) => wrap.append(renderResult(r, i === 0)));
      const parts = [wrap];
      if (compact) {
        const all = el('a', 'help-all', 'Все ответы →');
        all.href = `/help?q=${encodeURIComponent(q)}`;
        parts.push(all);
      }
      results.replaceChildren(...parts);
    }

    async function run() {
      clearTimeout(timer);
      const q = input.value.trim();
      const current = (requestId += 1);
      if (syncAddress) {
        const url = q ? `/help?q=${encodeURIComponent(q)}` : '/help';
        window.history.replaceState(null, '', url);
      }
      const asked = q.length >= MIN_LENGTH ? `?q=${encodeURIComponent(q)}` : '';
      let data;
      try {
        data = await D.fetchJSON(`/api/help${asked}`);
      } catch (err) {
        if (current === requestId) {
          const alert = el('p', 'alert', err.message);
          alert.setAttribute('role', 'alert');
          results.replaceChildren(alert);
        }
        return;
      }
      if (current !== requestId) return;
      if (data.popular) showPopular(data.popular);
      else if (data.results.length) showResults(data.results, q);
      else showNothing(q);
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    });
    run();
  }

  return { mount };
})();
