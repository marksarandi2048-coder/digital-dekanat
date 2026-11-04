'use strict';
// Новая заявка: тип → для чего → сколько экземпляров → отправить.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const form = document.getElementById('request-form');
  const typeList = document.getElementById('type-list');
  const fields = document.getElementById('fields');
  const errorBox = document.getElementById('form-error');
  const submit = document.getElementById('submit-button');
  const loading = document.getElementById('state-loading');
  const loadError = document.getElementById('state-error');

  const params = new URLSearchParams(window.location.search);
  const state = { type: null, format: 'electronic', copies: 1 };
  let meta;

  // ---------- Мелкие элементы формы ----------
  function block(title) {
    const b = el('div', 'form-block');
    b.append(el('p', 'form-block__title', title));
    return b;
  }

  function input(id, label, { textarea = false, value = '', placeholder = '', maxLength = 200 } = {}) {
    const wrap = el('div', 'field');
    const l = el('label', null, label);
    l.htmlFor = id;
    const i = document.createElement(textarea ? 'textarea' : 'input');
    i.id = id;
    i.maxLength = maxLength;
    if (!textarea) i.type = 'text';
    else i.rows = 4;
    i.value = value;
    i.placeholder = placeholder;
    wrap.append(l, i);
    return { wrap, input: i };
  }

  // Подсказки-кнопки: касание подставляет текст в поле.
  function chips(hints, target) {
    const row = el('div', 'chips');
    for (const h of hints) {
      const b = el('button', 'chip', h);
      b.type = 'button';
      b.addEventListener('click', () => {
        target.value = h;
        target.focus();
      });
      row.append(b);
    }
    return row;
  }

  function choice(name, value, title, hint, checked, onChange) {
    const label = el('label', 'choice');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = value;
    radio.checked = checked;
    radio.addEventListener('change', () => onChange(value));
    const text = el('span', 'choice__text');
    text.append(el('span', 'choice__title', title));
    if (hint) text.append(el('span', 'choice__hint', hint));
    label.append(radio, text);
    return label;
  }

  // ---------- Поля под выбранный тип ----------
  function renderFields() {
    fields.replaceChildren();
    errorBox.hidden = true;
    const def = meta.types.find((t) => t.id === state.type);
    if (!def) {
      submit.hidden = true;
      return;
    }
    submit.hidden = false;

    if (def.kind === 'appeal') {
      const b = block('Обращение');
      const subject = input('subject', 'Тема', { value: (params.get('topic') || '').slice(0, 200), placeholder: 'Коротко, о чём вопрос' });
      const text = input('comment', 'Сообщение', { textarea: true, maxLength: 2000, placeholder: 'Опишите вопрос — сотрудник ответит здесь же' });
      b.append(subject.wrap, text.wrap);
      fields.append(b);
      return;
    }

    if (def.electronic) {
      const b = el('fieldset', 'form-block');
      b.append(el('legend', 'form-block__title', 'Формат'));
      const list = el('div', 'choice-list');
      list.append(
        choice('format', 'electronic', 'Электронная', 'С QR-кодом для проверки. Готова прямо в кабинете — ехать в деканат не нужно', state.format === 'electronic', (v) => {
          state.format = v;
          renderFields();
        }),
        choice('format', 'paper', 'Бумажная', 'С печатью, забрать в деканате', state.format === 'paper', (v) => {
          state.format = v;
          renderFields();
        }),
      );
      b.append(list);
      fields.append(b);
    }

    if (def.needsOrder) {
      const b = block('Из какого приказа');
      const order = input('orderRef', 'Приказ', { placeholder: 'Например: о зачислении' });
      b.append(order.wrap, chips(meta.orderHints, order.input));
      fields.append(b);
    }

    const p = block('Для чего / куда нужна');
    const purpose = input('purpose', 'Куда предоставить', { placeholder: 'Например: по месту требования' });
    p.append(purpose.wrap, chips(meta.purposeHints, purpose.input));
    fields.append(p);

    const paper = !(def.electronic && state.format === 'electronic');
    if (paper) {
      const c = block('Количество экземпляров');
      const stepper = el('div', 'stepper');
      const minus = el('button', 'stepper__btn', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', 'Меньше');
      const value = el('output', 'stepper__value', String(state.copies));
      value.setAttribute('aria-live', 'polite');
      const plus = el('button', 'stepper__btn', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Больше');
      const update = (d) => {
        state.copies = Math.min(meta.maxCopies, Math.max(1, state.copies + d));
        value.textContent = String(state.copies);
        minus.disabled = state.copies <= 1;
        plus.disabled = state.copies >= meta.maxCopies;
      };
      minus.addEventListener('click', () => update(-1));
      plus.addEventListener('click', () => update(1));
      update(0);
      stepper.append(minus, value, plus);
      c.append(stepper);
      fields.append(c);
    }

    const k = block('Комментарий');
    k.append(input('comment', 'Необязательно', { textarea: true, maxLength: 1000, placeholder: 'Например: нужна с печатью' }).wrap);
    fields.append(k);
  }

  function renderTypes() {
    typeList.replaceChildren(
      ...meta.types.map((t) =>
        choice('type', t.id, t.label, t.hint, state.type === t.id, (v) => {
          state.type = v;
          renderFields();
        }),
      ),
    );
  }

  // ---------- Отправка ----------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    if (!state.type) {
      errorBox.textContent = 'Выберите, что нужно';
      errorBox.hidden = false;
      return;
    }
    const val = (id) => (document.getElementById(id) ? document.getElementById(id).value : undefined);
    const body = {
      type: state.type,
      format: state.format,
      copies: state.copies,
      purpose: val('purpose'),
      orderRef: val('orderRef'),
      subject: val('subject'),
      comment: val('comment'),
    };
    submit.disabled = true;
    submit.textContent = 'Отправляем…';
    const { ok, data } = await D.postJSON('/api/requests', body);
    if (ok) {
      window.location.href = `/requests/${data.id}?created=1`;
      return;
    }
    errorBox.textContent = data.error || 'Не удалось отправить заявку';
    errorBox.hidden = false;
    submit.disabled = false;
    submit.textContent = 'Отправить заявку';
  });

  async function load() {
    try {
      meta = await D.fetchJSON('/api/request-types');
    } catch (err) {
      loading.hidden = true;
      loadError.textContent = err.message;
      loadError.hidden = false;
      return;
    }
    const preset = params.get('type');
    if (meta.types.some((t) => t.id === preset)) state.type = preset;
    renderTypes();
    renderFields();
    loading.hidden = true;
    form.hidden = false;
  }

  load();
})();
