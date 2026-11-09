'use strict';
// «Что нужно на экзамене»: блок в «Оценках». Сервер считает по правилам настоящего рейтинга,
// здесь только выбор оценок и показ результата. Ничего не сохраняется.
window.DekanatForecast = (function () {
  const D = window.Dekanat;
  const el = D.el;
  const num = D.decimal;
  const TARGET_MAX = 110;
  const DEBOUNCE_MS = 250;

  function countsText(plan) {
    const parts = [
      [plan.counts[5], tr('forecast.pyaterka'), tr('forecast.pyaterki'), tr('forecast.pyaterok')],
      [plan.counts[4], tr('forecast.chetverka'), tr('forecast.chetverki'), tr('forecast.chetverok')],
      [plan.counts[3], tr('forecast.troyka'), tr('forecast.troyki'), tr('forecast.troek')],
    ].filter(([n]) => n > 0).map(([n, one, few, many]) => `${n} ${D.plural(n, one, few, many)}`);
    if (plan.credits) parts.push(plan.credits === 1 ? tr('forecast.sdat_zachet') : tr('forecast.sdat_vse_zachety'));
    return parts.join(', ');
  }

  function render(data) {
    const open = data.disciplines.filter((d) => !d.grade);
    const box = el('section', 'card fc');
    box.id = 'forecast';
    box.setAttribute('aria-labelledby', 'fc-title');
    const title = el('h2', 'section-title', tr('forecast.chto_nuzhno_na_ekzamene'));
    title.id = 'fc-title';

    if (!open.length) {
      box.append(title, D.emptyState({ inline: true, illu: 'read', title: tr('forecast.vse_otsenki_uzhe_vystavleny') }));
      return box;
    }

    // По умолчанию зачёты сданы: студент может снять отметку.
    const defaults = () => Object.fromEntries(open.filter((d) => d.control === 'credit').map((d) => [d.id, 'passed']));
    const isDefault = () => {
      const base = defaults();
      return open.every((d) => choices[d.id] === base[d.id]);
    };
    let choices = defaults();
    let requestId = 0;
    let timer = null;
    const pickButtons = new Map();

    // Прогноз сверху: остаётся на виду, пока выбираешь оценки.
    const value = el('span', 'fc__value', '…');
    const delta = el('span', 'fc__delta', '');
    const score = el('p', 'fc__score');
    score.setAttribute('role', 'status');
    score.append(value, el('span', 'fc__max', tr('forecast.iz_100_nadbavka')), delta);
    const head = el('div', 'fc__head');
    head.append(title, el('span', 'badge badge--moved', tr('forecast.prognoz')));
    const top = el('div', 'fc__top');
    const unset = el('p', 'fc__unset', '');
    top.append(head, score, unset, el('p', 'muted fc__caption', tr('forecast.raznitsa_vklad_vybrannykh_otsenok')));

    // Обратный режим.
    const label = el('label', 'fc__target-label', tr('forecast.khochu_reyting_ne_nizhe'));
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
      reset.hidden = isDefault();
      const missing = open.filter((d) => !choices[d.id]).length;
      unset.textContent = missing ? tr('forecast.ne_vybrano_missing_schitayutsya', { missing }) : '';
      unset.hidden = !missing;
    }

    const reset = el('button', 'button-link fc__reset', tr('forecast.sbrosit_vybor'));
    reset.type = 'button';
    reset.hidden = true;
    reset.addEventListener('click', () => {
      choices = defaults();
      showPicks();
      send();
    });

    function showTarget(plan, parsed) {
      if (!parsed.valid) {
        result.replaceChildren(el('p', 'fc__hint', tr('forecast.vvedite_chislo_ot_0', { TARGET_MAX })));
        return;
      }
      if (!plan) {
        result.replaceChildren();
        return;
      }
      if (!plan.reachable) {
        const what = open.some((d) => d.control === 'exam') ? tr('forecast.pri_vsekh_pyaterkakh') : tr('forecast.esli_sdat_vse_zachety');
        result.replaceChildren(el('p', 'fc__hint', tr('forecast.nedostizhimo_dazhe_what_poluchitsya', { what, p1: num(plan.max) })));
        return;
      }
      const apply = el('button', 'button button--secondary button--small fc__apply', tr('forecast.podstavit'));
      apply.type = 'button';
      apply.addEventListener('click', () => {
        choices = { ...plan.choices };
        showPicks();
        send();
      });
      const text = el('p', 'fc__answer');
      text.append(el('strong', null, tr('forecast.dostatochno')), document.createTextNode(tr('forecast.p0_poluchitsya_p1', { p0: countsText(plan), p1: num(plan.total) })));
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
        errorLine.textContent = answer.error || tr('forecast.ne_udalos_pereschitat_prognoz');
        return;
      }
      value.textContent = num(answer.total);
      delta.textContent = ` +${num(answer.delta)}`;
      showTarget(answer.target, parsed);
      const a = answer.assumed;
      assumed.hidden = !a.count;
      if (a.count) {
        const where = `${a.count} ${D.plural(a.count, tr('forecast.distsipline'), tr('forecast.distsiplinam'), tr('forecast.distsiplinam'))}`;
        assumed.textContent = a.percent === null
          ? tr('forecast.bally_za_semestr_esche')
          : tr('forecast.bally_za_semestr_esche_2', { where, percent: a.percent });
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
        el('span', 'muted fc__kind', `${d.control === 'exam' ? tr('forecast.ekzamen') : tr('forecast.zachet')}${when}`),
      );
      const group = el('div', 'fc__picks');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', tr('forecast.discipline_kakuyu_otsenku_poluchu', { discipline: d.discipline }));
      const options = d.control === 'exam'
        ? [['5', '5', tr('forecast.poluchu_5')], ['4', '4', tr('forecast.poluchu_4')], ['3', '3', tr('forecast.poluchu_3')]]
        : [['passed', tr('forecast.zachteno'), tr('forecast.zachteno_2')], ['failed', tr('forecast.ne_zachteno'), tr('forecast.ne_zachteno_2')]];
      if (d.control === 'exam') group.append(el('span', 'muted fc__get', tr('forecast.poluchu')));
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
      el('p', 'muted fc__note', tr('forecast.eto_prognoz_on_nigde')),
    );
    showPicks();
    send();
    return box;
  }

  return { render };
})();
