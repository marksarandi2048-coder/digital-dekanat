'use strict';
// Страница «Успеваемость»: сводка «как у меня дела», дисциплины, активность, надбавка.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  const num = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
  const GRADE = {
    5: '5 — отлично',
    4: '4 — хорошо',
    3: '3 — удовлетворительно',
    2: '2 — неудовлетворительно',
    passed: 'Зачтено',
    failed: 'Не зачтено',
  };
  const CONTROL = { exam: 'Экзамен', credit: 'Зачёт' };
  const BONUS = { volunteering: 'Волонтёрство', sport: 'Спортивная секция', research: 'Научная работа' };
  const isDebt = (g) => g === '2' || g === 'failed';

  // ---------- Статус оценки ----------
  function contactLink(topic) {
    const a = el('a', 'button button--danger', 'Написать в деканат');
    a.href = `/contact?topic=${encodeURIComponent(topic)}`;
    return a;
  }

  function renderStatus(status, topic) {
    if (status.state === 'set') {
      return el('p', 'status status--set', status.date ? `Выставлено ${D.dayMonth(status.date)}` : 'Выставлено');
    }
    if (status.state === 'pending') {
      return el('p', 'status status--pending', `Ожидается до ${D.dayMonth(status.due)}`);
    }
    const box = el('div', 'status status--overdue');
    box.append(
      el('p', 'status__text', `Срок прошёл ${D.dayMonth(status.due)}, а оценки всё ещё нет. Обратитесь в деканат.`),
      contactLink(topic),
    );
    return box;
  }

  // Строка «что оценивается — значение — статус».
  function row(label, value, valueClass, status, topic) {
    const r = el('div', 'grade-row');
    const top = el('div', 'grade-row__top');
    top.append(el('span', 'grade-row__label', label));
    if (value) top.append(el('span', `grade-row__value ${valueClass || ''}`, value));
    r.append(top, renderStatus(status, topic));
    return r;
  }

  // ---------- Сводка ----------
  function verdicts(data) {
    const s = data.summary;
    const out = [];
    if (s.debts.length) {
      out.push(['bad', `${s.debts.length === 1 ? 'Есть долг' : `Есть долги (${s.debts.length})`}: ${s.debts.join(', ')}.`]);
    }
    if (s.overdue) {
      out.push(['bad', `${s.overdue} ${D.plural(s.overdue, 'оценка не выставлена', 'оценки не выставлены', 'оценок не выставлено')} в срок — можно написать в деканат.`]);
    }
    if (!out.length) {
      out.push(['ok', s.isFinal ? 'Семестр закрыт без долгов.' : `Всё идёт по плану: долгов нет, ждём ещё ${s.pending} ${D.plural(s.pending, 'оценку', 'оценки', 'оценок')}.`]);
    } else if (!s.isFinal && s.pending) {
      out.push(['info', `Ещё ожидается ${s.pending} ${D.plural(s.pending, 'оценка', 'оценки', 'оценок')}.`]);
    }
    return out;
  }

  // note — подпись вместо «0 из N», если баллы этой части ещё не выставлены.
  function meter(block, note) {
    const wrap = el('div', 'meter');
    const head = el('div', 'meter__head');
    head.append(
      el('span', 'meter__label', block.label),
      el('span', note ? 'meter__value meter__value--pending' : 'meter__value', note || `${block.key === 'bonus' ? '+' : ''}${num(block.points)} из ${block.max}`),
    );
    const track = el('div', 'meter__track');
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${block.label}: ${num(block.points)} из ${block.max}`);
    const fill = el('div', 'meter__fill');
    fill.style.width = `${Math.min(100, (block.points / block.max) * 100)}%`;
    track.append(fill);
    wrap.append(head, track);
    return wrap;
  }

  function renderSummary(data) {
    const s = data.summary;
    const card = el('section', 'card summary');
    card.setAttribute('aria-labelledby', 'summary-title');
    const title = el('h2', 'section-title', 'Как у меня дела');
    title.id = 'summary-title';
    card.append(title);

    const v = el('div', 'verdicts');
    for (const [tone, text] of verdicts(data)) v.append(el('p', `verdict verdict--${tone}`, text));
    card.append(v);

    // Рейтинг — крупным числом.
    const hero = el('div', 'rating');
    const num1 = el('p', 'rating__number');
    num1.append(el('span', 'rating__value', num(data.rating.total)), el('span', 'rating__max', ` из ${data.rating.max} + надбавка`));
    hero.append(
      el('p', 'rating__label', 'Рейтинг за семестр'),
      num1,
      el('span', s.isFinal ? 'tag tag--now' : 'tag', s.isFinal ? 'Итоговый' : 'Предварительный'),
    );
    if (!s.isFinal) hero.append(el('p', 'rating__hint', 'Пока выставлено не всё: то, что ещё не выставлено, считается как 0.'));
    card.append(hero);

    const meters = el('div', 'meters');
    const socialStatus = data.social && data.social.status;
    for (const b of data.rating.blocks) {
      let note = null;
      if (b.key === 'social' && socialStatus && socialStatus.state !== 'set') {
        note = socialStatus.state === 'pending' ? `ожидается до ${D.dayMonth(socialStatus.due)}` : 'срок прошёл';
      }
      meters.append(meter(b, note));
    }
    card.append(meters);

    // Короткие цифры.
    const facts = el('dl', 'facts');
    const fact = (label, value, tone) => {
      const box = el('div', `fact${tone ? ` fact--${tone}` : ''}`);
      box.append(el('dt', null, label), el('dd', null, value));
      facts.append(box);
    };
    fact('Оценки за сессию', `${s.gradesSet} из ${s.gradesTotal}`);
    fact('Ожидается', String(s.pending));
    fact('Срок прошёл', String(s.overdue), s.overdue ? 'bad' : null);
    fact('Долги', s.debts.length ? String(s.debts.length) : 'нет', s.debts.length ? 'bad' : null);
    card.append(facts);

    if (s.nextDeadline) {
      const nd = el('div', 'next-deadline');
      nd.append(el('p', 'next-deadline__title', `Ближайший срок — ${D.dayMonth(s.nextDeadline.due)}`));
      const ul = el('ul', 'next-deadline__list');
      for (const i of s.nextDeadline.items) ul.append(el('li', null, i.discipline ? `${i.what}: ${i.discipline}` : i.what));
      nd.append(ul);
      card.append(nd);
    }

    if (data.previous) {
      const p = el('p', 'previous');
      p.append(document.createTextNode(`${data.previous.name}: `));
      p.append(el('strong', null, num(data.previous.total)));
      p.append(document.createTextNode(data.previous.isFinal ? ' (итоговый) · ' : ' · '));
      const a = el('a', null, 'посмотреть');
      a.href = semesterLink(data.previous.id);
      p.append(a);
      card.append(p);
    }
    return card;
  }

  // ---------- Дисциплины ----------
  function renderDiscipline(d) {
    const overdue = d.currentStatus.state === 'overdue' || d.gradeStatus.state === 'overdue';
    const card = el('article', `subject${overdue ? ' subject--overdue' : ''}${isDebt(d.grade) ? ' subject--debt' : ''}`);
    const head = el('div', 'subject__head');
    head.append(el('h3', 'subject__title', d.discipline), el('span', 'badge', CONTROL[d.control]));
    card.append(head);

    const meta = [d.teacher.replace(/^(\S+)\s+(\S)\S*\s+(\S)\S*$/, '$1 $2. $3.')];
    if (d.examDate) meta.push(`${CONTROL[d.control].toLowerCase()} ${D.dayMonth(d.examDate)}`);
    card.append(el('p', 'subject__meta', meta.join(' · ')));

    card.append(
      row(
        'Баллы за семестр',
        d.currentPoints !== null ? `${num(d.currentPoints)} из ${d.currentMax}` : null,
        null,
        d.currentStatus,
        `Не выставлены баллы за семестр по дисциплине «${d.discipline}»${d.currentStatus.due ? ` (срок был ${D.dayMonth(d.currentStatus.due)})` : ''}`,
      ),
    );
    card.append(
      row(
        CONTROL[d.control],
        d.grade ? GRADE[d.grade] : null,
        d.grade ? (isDebt(d.grade) ? 'grade grade--bad' : 'grade grade--ok') : null,
        d.gradeStatus,
        `Не выставлена оценка (${CONTROL[d.control].toLowerCase()}) по дисциплине «${d.discipline}»`,
      ),
    );
    return card;
  }

  // ---------- Активность и надбавка ----------
  function renderSocial(social) {
    const card = el('section', 'card');
    card.append(el('h2', 'section-title', 'Общественная активность'));
    if (!social) {
      card.append(el('p', 'muted', 'За этот семестр баллы не предусмотрены.'));
      return card;
    }
    card.append(
      row('Баллы', social.points !== null ? `${num(social.points)} из ${social.maxPoints}` : null, null, social.status, 'Не выставлены баллы за общественную активность'),
    );
    if (social.note) card.append(el('p', 'muted', social.note));
    return card;
  }

  function renderBonuses(bonuses, bonusBlock) {
    const card = el('section', 'card');
    const head = el('div', 'subject__head');
    head.append(el('h2', 'section-title', 'Надбавка'), el('span', 'bonus-total', `+${num(bonusBlock.points)} из ${bonusBlock.max}`));
    card.append(head);
    if (!bonuses.length) {
      card.append(el('p', 'muted', 'В этом семестре надбавки пока нет. Её начисляют за волонтёрство, спортивные секции МГИМО и научные работы.'));
      return card;
    }
    const ul = el('ul', 'bonus-list');
    for (const b of bonuses) {
      const li = el('li', 'bonus');
      const text = el('div', 'bonus__text');
      text.append(el('span', 'badge', BONUS[b.category]), el('p', 'bonus__title', b.title), el('p', 'muted', D.dayMonth(b.awardedOn)));
      li.append(text, el('span', 'bonus__points', `+${num(b.points)}`));
      ul.append(li);
    }
    card.append(ul);
    return card;
  }

  // ---------- Выбор семестра и студента ----------
  function semesterLink(id) {
    const params = new URLSearchParams(window.location.search);
    params.set('semester', id);
    return `/grades?${params}`;
  }

  function setupPicker(pickerId, selectId, options, current, param) {
    const select = document.getElementById(selectId);
    select.replaceChildren(
      ...options.map((o) => {
        const opt = el('option', null, o.label);
        opt.value = String(o.value);
        opt.selected = o.value === current;
        return opt;
      }),
    );
    select.onchange = () => {
      const params = new URLSearchParams(window.location.search);
      params.set(param, select.value);
      if (param === 'student') params.delete('semester');
      window.location.search = params.toString();
    };
    document.getElementById(pickerId).hidden = false;
  }

  async function load() {
    const params = new URLSearchParams(window.location.search);
    const api = new URLSearchParams();
    for (const key of ['semester', 'student']) if (params.get(key)) api.set(key, params.get(key));

    let data;
    try {
      data = await D.fetchJSON(`/api/grades?${api}`);
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }

    if (data.students) {
      setupPicker('student-picker', 'student-select', data.students.map((s) => ({ value: s.id, label: `${s.fullName}, ${s.group}` })), data.student && data.student.id, 'student');
    }
    if (!data.student || !data.semester) {
      loading.hidden = true;
      content.replaceChildren(el('div', 'empty', 'Данных об успеваемости пока нет'));
      content.hidden = false;
      return;
    }
    setupPicker(
      'semester-picker',
      'semester-select',
      data.semesters.map((s) => ({ value: s.id, label: s.isCurrent ? `${s.name} (текущий)` : s.name })),
      data.semester.id,
      'semester',
    );

    const parts = [renderSummary(data)];
    const subjects = el('section', 'subjects');
    subjects.append(el('h2', 'section-title', 'Дисциплины'));
    if (data.disciplines.length) {
      const list = el('div', 'subject-list');
      for (const d of data.disciplines) list.append(renderDiscipline(d));
      subjects.append(list);
    } else {
      subjects.append(el('p', 'day__empty', 'В этом семестре дисциплин нет'));
    }
    parts.push(subjects, renderSocial(data.social), renderBonuses(data.bonuses, data.rating.blocks.find((b) => b.key === 'bonus')));

    content.replaceChildren(...parts);
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
