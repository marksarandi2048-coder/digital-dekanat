'use strict';
// ИИ-помощник «Спроси деканат»: кнопка на страницах кабинета и чат.
// Сервер сам решает, кому он доступен: сотрудник и гость получают отказ, и кнопка не появляется.
// Весь текст выводится через textContent, поэтому разметка или скрипт из ответа не сработают.
(function () {
  const D = window.Dekanat;
  const el = D.el;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    chat: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.9A8 8 0 1 1 21 12z', 'M8.5 12h.01', 'M12 12h.01', 'M15.5 12h.01'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    send: ['M5 12h14', 'M13 6l6 6-6 6'],
  };
  const SUGGESTIONS = ['assistant.suggest.tomorrow', 'assistant.suggest.grades', 'assistant.suggest.deadlines', 'assistant.suggest.requests'];

  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name]) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  function chip(key, onPick) {
    const b = el('button', 'help-chip', tr(key));
    b.type = 'button';
    b.addEventListener('click', () => onPick(tr(key)));
    return b;
  }

  function build(state) {
    let busy = false;
    let messageCount = state.messages.length;

    const dialog = el('dialog', 'assistant');
    dialog.setAttribute('aria-labelledby', 'assistant-title');

    const head = el('div', 'assistant__head');
    const heading = el('div', 'assistant__heading');
    const title = el('h2', 'assistant__title', tr('assistant.title'));
    title.id = 'assistant-title';
    heading.append(title, el('p', 'assistant__subtitle', tr('assistant.subtitle')));
    const clearBtn = el('button', 'assistant__clear', tr('assistant.clear'));
    clearBtn.type = 'button';
    const closeBtn = el('button', 'sheet__close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', tr('assistant.close'));
    closeBtn.append(icon('close'));
    head.append(heading, clearBtn, closeBtn);

    const log = el('div', 'assistant__log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.tabIndex = 0;

    const foot = el('div', 'assistant__foot');
    const form = el('form', 'assistant__form');
    const input = el('textarea', 'assistant__input');
    input.rows = 1;
    input.maxLength = state.questionMax;
    input.placeholder = tr('assistant.placeholder');
    input.setAttribute('aria-label', tr('assistant.field_label'));
    const sendBtn = el('button', 'button assistant__send');
    sendBtn.type = 'submit';
    sendBtn.setAttribute('aria-label', tr('assistant.send'));
    sendBtn.append(icon('send'));
    form.append(input, sendBtn);
    foot.append(form, el('p', 'assistant-note', tr('assistant.disclaimer')));

    dialog.append(head, log, foot);
    document.body.append(dialog);

    const scrollDown = () => {
      log.scrollTop = log.scrollHeight;
    };

    function addMessage(role, text) {
      const bubble = el('div', `assistant-msg assistant-msg--${role === 'user' ? 'user' : 'bot'}`);
      const who = el('span', 'visually-hidden', `${tr(role === 'user' ? 'assistant.you' : 'assistant.bot')}: `);
      bubble.append(who, document.createTextNode(text));
      log.append(bubble);
      return bubble;
    }

    function addActions(actions) {
      if (!actions || !actions.length) return;
      const row = el('div', 'assistant-actions');
      for (const action of actions) row.append(Object.assign(el('a', 'button button--secondary button--small', action.label), { href: action.href }));
      row.append(el('p', 'assistant-actions__note', tr('assistant.buttons_note')));
      log.append(row);
    }

    function renderEmpty() {
      log.replaceChildren(el('p', 'assistant__greeting', tr('assistant.greeting')));
      if (!state.available) {
        log.append(el('p', 'assistant-error', tr('assistant.error.not_ready')));
        return;
      }
      const chips = el('div', 'help-chips');
      for (const key of SUGGESTIONS) chips.append(chip(key, send));
      log.append(chips);
    }

    function renderHistory() {
      if (!state.messages.length) {
        renderEmpty();
      } else {
        log.replaceChildren();
        for (const m of state.messages) {
          addMessage(m.role, m.text);
          if (m.role === 'assistant') addActions(m.actions);
        }
      }
      clearBtn.hidden = !messageCount;
    }

    function setBusy(value) {
      busy = value;
      sendBtn.disabled = value;
    }

    function fitInput() {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight + 2, 140)}px`;
    }

    async function send(text) {
      const question = text.trim();
      if (busy || !question) return;
      if (!messageCount) log.replaceChildren();
      log.querySelectorAll('.assistant-error').forEach((n) => n.remove());
      const userBubble = addMessage('user', question);
      const thinking = el('div', 'assistant-msg assistant-msg--bot assistant-msg--thinking', tr('assistant.thinking'));
      log.append(thinking);
      input.value = '';
      fitInput();
      setBusy(true);
      scrollDown();

      const { ok, data } = await D.postJSON('/api/assistant/messages', { question });
      thinking.remove();
      setBusy(false);
      if (ok) {
        addMessage('assistant', data.answer);
        addActions(data.actions);
        messageCount += 2;
        clearBtn.hidden = false;
      } else {
        // Вопрос не потерян: он возвращается в поле, можно отправить снова.
        userBubble.remove();
        input.value = question;
        fitInput();
        log.append(el('p', 'assistant-error', (data && data.error) || tr('assistant.error.unavailable')));
        if (!messageCount && !log.querySelector('.assistant__greeting')) {
          log.prepend(el('p', 'assistant__greeting', tr('assistant.greeting')));
        }
      }
      scrollDown();
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      send(input.value);
    });
    input.addEventListener('input', fitInput);
    input.addEventListener('keydown', (event) => {
      // На компьютере Enter отправляет, Shift+Enter — новая строка. На телефоне Enter — новая строка.
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && window.matchMedia('(pointer: fine)').matches) {
        event.preventDefault();
        send(input.value);
      }
    });
    closeBtn.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    clearBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/assistant/messages', { method: 'DELETE' });
        if (!res.ok) return;
      } catch {
        return;
      }
      state.messages = [];
      messageCount = 0;
      renderHistory();
    });

    if (!state.available) {
      input.disabled = true;
      sendBtn.disabled = true;
    }

    function open() {
      if (!dialog.open) dialog.showModal();
      if (window.matchMedia('(pointer: fine)').matches && !input.disabled) input.focus();
      scrollDown();
    }

    renderHistory();

    const fab = el('button', 'assistant-fab');
    fab.type = 'button';
    fab.setAttribute('aria-label', tr('assistant.open'));
    fab.append(icon('chat'), el('span', 'assistant-fab__label', tr('assistant.title')));
    fab.addEventListener('click', open);
    document.body.append(fab);
    document.body.classList.add('has-assistant');

    // Раздел в «Помощи»: виден только тем, кому доступен помощник.
    const section = document.getElementById('assistant-help');
    if (section) {
      section.hidden = false;
      document.getElementById('assistant-help-open').addEventListener('click', open);
    }
  }

  async function init() {
    let res;
    try {
      res = await fetch('/api/assistant');
    } catch {
      return; // без сети помощник не нужен: он работает только через сервер
    }
    if (!res.ok) return;
    build(await res.json().catch(() => ({ available: false, questionMax: 500, messages: [] })));
  }

  init();
})();
