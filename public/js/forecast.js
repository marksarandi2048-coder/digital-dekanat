'use strict';
// «Что нужно на экзамене»: блок в «Оценках». Сервер считает по правилам настоящего рейтинга,
// здесь только выбор оценок и показ результата. Ничего не сохраняется.
window.DekanatForecast = (function () {
  const D = window.Dekanat;
  const el = D.el;
  const num = (n) => String(n).replace('.', ',');
  const TARGET_MAX = 110;
  const DEBOUNCE_MS = 250;

  function countsText(plan) {
    const parts = [
      [plan.counts[5], 'пятёрка', 'пятёрки', 'пятёрок'],
      [plan.counts[4], 'четвёрка', 'четвёрки', 'четвёрок'],
      [plan.counts[3], 'тройка', 'тройки', 'троек'],
    ].filter(([n]) => n > 0).map(([n, one, few, many]) => `${n} ${D.plural(n, one, few, many)}`);
    if (plan.credits) parts.push(plan.credits === 1 ? 'сдать зачёт' : 'сдать все зачёты');
    return parts.join(', ');
  }

  function render(data) {
    const open = data.disciplines.filter((d) => !d.grade);
    const box = el('section', 'card fc');
    box.setAttribute('aria-labelledby', 'fc-title');
    const title = el('h2', 'section-title', 'Что нужно на экзамене');
    title.id = 'fc-title';

    if (!open.length) {
      box.append(title, D.emptyState({ inline: true, illu: 'read', title: 'Все оценки уже выставлены' }));
      return box;
    }

    let choices = {};
    let requestId = 0;
    let timer = null;
    const pickButtons = new Map();

    // Прогноз сверху: остаётся на виду, пока выбираешь оценки.
    const value = el('span', 'fc__value', '…');
    const delta = el('span', 'fc__delta', '');
    const score = el('p', 'fc__score');
    score.setAttribute('role', 'status');
    score.append(value, el('span', 'fc__max', ' из 100 + надбавка'), delta);
    const head = el('div', 'fc__head');
    head.append(title, el('span', 'badge badge--moved', 'Прогноз'));
    const top = el('div', 'fc__top');
    top.append(head, score, el('p', 'muted fc__caption', 'Разница — вклад выбранных оценок.'));

    // Обратный режим.
    const label = el('label', 'fc__target-label', 'Хочу рейтинг не ниже');
    label.htmlFor = 'fc-target';
    const input = el('input', 'fc__input');
    input.id = 'fc-target';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.maxLength = 6;
    input.placeholder = '75';
    const result = el('div', 'fc__result');
    result.setAttribute('aria-live', 'polite');
    const target = el('div', 'fc__target');
    target.append(label, input, result);

    function parseInput() {
      const text = input.value.trim().replace(',', '.');
      if (!text) return { value: null, valid: true };
      const n = Number(text);
      return { value: n, valid: Number.isFinite(n) && n >= 0 && n <= TARGET_MAX };
    }

    function showPicks() {
      for (const [id, buttons] of pickButtons) {
        for (const [grade, btn] of buttons) btn.setAttribute('aria-pressed', String(choices[id] === grade));
      }
      reset.hidden = !Object.keys(choices).length;
    }

    const reset = el('button', 'button-link fc__reset', 'Сбросить выбор');
    reset.type = 'button';
    reset.hidden = true;
    reset.addEventListener('click', () => {
      choices = {};
      showPicks();
      send();
    });

    function showTarget(plan, parsed) {
      if (!parsed.valid) {
        result.replaceChildren(el('p', 'fc__hint', `Введите число от 0 до ${TARGET_MAX}.`));
        return;
      }
      if (!plan) {
        result.replaceChildren();
        return;
      }
      if (!plan.reachable) {
        const what = open.some((d) => d.control === 'exam') ? 'при всех пятёрках' : 'если сдать все зачёты';
        result.replaceChildren(el('p', 'fc__hint', `Недостижимо: даже ${what} получится ${num(plan.max)}.`));
        return;
      }
      const apply = el('button', 'button button--secondary button--small fc__apply', 'Подставить');
      apply.type = 'button';
      apply.addEventListener('click', () => {
        choices = { ...plan.choices };
        showPicks();
        send();
      });
      const text = el('p', 'fc__answer');
      text.append(el('strong', null, 'Достаточно: '), document.createTextNode(`${countsText(plan)}. Получится ${num(plan.total)}.`));
      result.replaceChildren(text, apply);
    }

    const errorLine = el('p', 'fc__hint', '');
    errorLine.setAttribute('role', 'alert');
    errorLine.hidden = true;
    const assumed = el('p', 'muted fc__note', '');
    assumed.hidden = true;

    async function send() {
      const id = (requestId += 1);
      const parsed = parseInput();
      const { ok, data: answer } = await D.postJSON('/api/grades/forecast', { choices, target: parsed.valid ? parsed.value : null });
      if (id !== requestId) return; // уже нажали что-то ещё
      errorLine.hidden = ok;
      if (!ok) {
        errorLine.textContent = answer.error || 'Не удалось пересчитать прогноз';
        return;
      }
      value.textContent = num(answer.total);
      delta.textContent = ` +${num(answer.delta)}`;
      showTarget(answer.target, parsed);
      const a = answer.assumed;
      assumed.hidden = !a.count;
      if (a.count) {
        const where = `${a.count} ${D.plural(a.count, 'дисциплине', 'дисциплинам', 'дисциплинам')}`;
        assumed.textContent = a.percent === null
          ? 'Баллы за семестр ещё не выставлены: в прогнозе они равны нулю.'
          : `Баллы за семестр ещё не выставлены по ${where}: взят ваш средний результат — ${a.percent} %.`;
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(send, DEBOUNCE_MS);
    });

    // Список экзаменов и зачётов без оценки.
    const list = el('ul', 'fc__list');
    for (const d of open) {
      const li = el('li', 'fc__item');
      const info = el('div', 'fc__info');
      const when = d.examDate ? ` · ${D.dayMonth(d.examDate)}` : '';
      info.append(
        D.disciplineTitle('span', 'fc__name', d.discipline, d.color),
        el('span', 'muted fc__kind', `${d.control === 'exam' ? 'Экзамен' : 'Зачёт'}${when}`),
      );
      const group = el('div', 'fc__picks');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', `${d.discipline}: какую оценку получу`);
      const options = d.control === 'exam'
        ? [['5', '5', 'Получу 5'], ['4', '4', 'Получу 4'], ['3', '3', 'Получу 3']]
        : [['passed', 'зачтено', 'Зачтено'], ['failed', 'не зачтено', 'Не зачтено']];
      if (d.control === 'exam') group.append(el('span', 'muted fc__get', 'Получу'));
      const buttons = new Map();
      for (const [grade, text, aria] of options) {
        const btn = el('button', 'fc__pick', text);
        btn.type = 'button';
        btn.setAttribute('aria-label', aria);
        btn.setAttribute('aria-pressed', 'false');
        // Повторное нажатие снимает выбор.
        btn.addEventListener('click', () => {
          if (choices[d.id] === grade) delete choices[d.id];
          else choices[d.id] = grade;
          showPicks();
          send();
        });
        buttons.set(grade, btn);
        group.append(btn);
      }
      pickButtons.set(d.id, buttons);
      li.append(info, group);
      list.append(li);
    }

    box.append(
      top,
      target,
      list,
      reset,
      errorLine,
      assumed,
      el('p', 'muted fc__note', 'Это прогноз: он нигде не сохраняется и не меняет рейтинг.'),
    );
    send();
    return box;
  }

  return { render };
})();
