'use strict';
// Страница «Успеваемость»: сводка «как у меня дела», дисциплины, активность, надбавка.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  const num = (n) => new Intl.NumberFormat(window.DekanatI18n.locale, { maximumFractionDigits: 1 }).format(n);
  const GRADE = {
    5: tr('grades.5_otlichno'),
    4: tr('grades.4_khorosho'),
    3: tr('grades.3_udovletvoritelno'),
    2: tr('grades.2_neudovletvoritelno'),
    passed: tr('grades.zachteno'),
    failed: tr('grades.ne_zachteno'),
  };
  const CONTROL = { exam: tr('grades.ekzamen'), credit: tr('grades.zachet') };
  const BONUS = { volunteering: tr('grades.volonterstvo'), sport: tr('grades.sportivnaya_sektsiya'), research: tr('grades.nauchnaya_rabota') };
  const isDebt = (g) => g === '2' || g === 'failed';

  // ---------- Статус оценки ----------
  function contactLink(topic) {
    const a = el('a', 'button button--danger', tr('grades.napisat_v_dekanat'));
    a.href = `/requests/new?type=appeal&topic=${encodeURIComponent(topic)}`;
    return a;
  }

  function renderStatus(status, topic) {
    if (status.state === 'set') {
      return el('p', 'status status--set', status.date ? tr('grades.vystavleno_p0', { p0: D.dayMonth(status.date) }) : tr('grades.vystavleno'));
    }
    if (status.state === 'pending') {
      return el('p', 'status status--pending', tr('grades.ozhidaetsya_do_p0', { p0: D.dayMonth(status.due) }));
    }
    const box = el('div', 'status status--overdue');
    box.append(
      el('p', 'status__text', tr('grades.srok_proshel_p0_a', { p0: D.dayMonth(status.due) })),
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
      out.push(['bad', `${s.debts.length === 1 ? tr('grades.est_dolg') : tr('grades.est_dolgi_length', { length: s.debts.length })}: ${s.debts.join(', ')}.`]);
    }
    if (s.overdue) {
      out.push(['bad', tr('grades.overdue_p1_v_srok', { overdue: s.overdue, p1: D.plural(s.overdue, tr('grades.otsenka_ne_vystavlena'), tr('grades.otsenki_ne_vystavleny'), tr('grades.otsenok_ne_vystavleno')) })]);
    }
    if (!out.length && !s.isFinal && !s.pending) {
      out.push(['info', tr('grades.v_etom_semestre_poka')]);
    } else if (!out.length) {
      out.push(['ok', s.isFinal ? tr('grades.semestr_zakryt_bez_dolgov') : tr('grades.vse_idet_po_planu', { pending: s.pending, p1: D.plural(s.pending, tr('grades.otsenku'), tr('grades.otsenki'), tr('grades.otsenok')) })]);
    } else if (!s.isFinal && s.pending) {
      out.push(['info', tr('grades.esche_ozhidaetsya_pending_p1', { pending: s.pending, p1: D.plural(s.pending, tr('grades.otsenka'), tr('grades.otsenki'), tr('grades.otsenok')) })]);
    }
    return out;
  }

  // Полоска одной части рейтинга. Подпись и полоска всегда про одно и то же:
  //  - семестр идёт: «набрано из возможного на сегодня» (как крупное число вверху),
  //    а максимум за семестр — мелкой припиской под полоской;
  //  - семестр закрыт: «набрано из максимума за семестр».
  // note — подпись, если в этой части ещё ничего не выставлено.
  function meter(block, note, inProgress) {
    const wrap = el('div', 'meter');
    const head = el('div', 'meter__head');
    const byPossible = inProgress && block.possible !== undefined;
    const scale = byPossible ? block.possible : block.max; // от чего считается полоска
    const empty = byPossible && block.possible === 0;

    let value;
    if (block.key === 'bonus') value = tr('grades.p0_iz_max', { p0: num(block.points), max: block.max });
    else if (empty) value = note || tr('grades.esche_ne_vystavleno');
    else if (byPossible) value = tr('grades.p0_iz_p1', { p0: num(block.points), p1: num(block.possible) });
    else value = note || tr('grades.p0_iz_max_2', { p0: num(block.points), max: block.max });
    head.append(
      el('span', 'meter__label', block.label),
      el('span', empty || (!byPossible && note) ? 'meter__value meter__value--pending' : 'meter__value', value),
    );

    const share = scale > 0 ? Math.min(1, block.points / scale) : 0;
    const track = el('div', 'meter__track');
    track.setAttribute('role', 'img');
    track.setAttribute(
      'aria-label',
      empty
        ? tr('grades.label_esche_ne_vystavleno', { label: block.label })
        : byPossible
          ? tr('grades.label_p1_iz_p2', { label: block.label, p1: num(block.points), p2: num(block.possible), p3: Math.round(share * 100) })
          : tr('grades.label_p1_iz_max', { label: block.label, p1: num(block.points), max: block.max }),
    );
    const fill = el('div', 'meter__fill');
    fill.style.width = `${share * 100}%`;
    track.append(fill);
    wrap.append(head, track);

    if (byPossible && block.key !== 'bonus') {
      wrap.append(el('p', 'meter__note', empty ? tr('grades.maksimum_za_semestr_max', { max: block.max }) : tr('grades.p0_maksimum_za_semestr', { p0: Math.round(share * 100), max: block.max })));
    }
    return wrap;
  }

  // Крупный блок с рейтингом.
  function renderHero(data) {
    const s = data.summary;
    const r = data.rating;
    const hero = el('div', 'rating');

    if (s.isFinal) {
      const n = el('p', 'rating__number');
      n.append(el('span', 'rating__value', num(r.total)), el('span', 'rating__max', tr('grades.iz_max_nadbavka', { max: r.max })));
      hero.append(el('p', 'rating__label', tr('grades.reyting_za_semestr')), n, el('span', 'tag tag--now', tr('grades.itogovyy')));
      return hero;
    }

    // Семестр идёт: главное — как студент справляется с тем, что уже выставлено.
    hero.append(el('p', 'rating__label', tr('grades.nabrano_na_segodnya')));
    if (r.soFar.percent === null) {
      hero.append(el('p', 'rating__empty', tr('grades.otsenok_za_etot_semestr')));
    } else {
      const n = el('p', 'rating__number');
      n.append(el('span', 'rating__value', num(r.soFar.points)), el('span', 'rating__max', tr('grades.iz_p0_vozmozhnykh', { p0: num(r.soFar.possible) })));
      const line = el('div', 'rating__line');
      line.append(el('span', 'tag tag--now', tr('grades.percent_ot_vozmozhnogo', { percent: r.soFar.percent })));
      if (r.bonus > 0) line.append(el('span', 'tag', tr('grades.p0_nadbavka', { p0: num(r.bonus) })));
      hero.append(n, line);
    }
    hero.append(
      el(
        'p',
        'rating__hint',
        tr('grades.reyting_za_semestr_p0', { p0: num(r.total), max: r.max }),
      ),
    );
    return hero;
  }

  function renderSummary(data) {
    const s = data.summary;
    const card = el('section', 'card summary');
    card.setAttribute('aria-labelledby', 'summary-title');
    const title = el('h2', 'section-title', tr('grades.kak_u_menya_dela'));
    title.id = 'summary-title';
    card.append(title);

    const v = el('div', 'verdicts');
    for (const [tone, text] of verdicts(data)) v.append(el('p', `verdict verdict--${tone}`, text));
    card.append(v);

    card.append(renderHero(data));

    const meters = el('div', 'meters');
    const socialStatus = data.social && data.social.status;
    for (const b of data.rating.blocks) {
      let note = null;
      if (b.key === 'social' && socialStatus && socialStatus.state !== 'set') {
        note = socialStatus.state === 'pending' ? tr('grades.ozhidaetsya_do_p0_2', { p0: D.dayMonth(socialStatus.due) }) : tr('grades.srok_proshel');
      }
      meters.append(meter(b, note, !s.isFinal));
    }
    card.append(meters);

    // Короткие цифры.
    const facts = el('dl', 'facts');
    const fact = (label, value, tone) => {
      const box = el('div', `fact${tone ? ` fact--${tone}` : ''}`);
      box.append(el('dt', null, label), el('dd', null, value));
      facts.append(box);
    };
    fact(tr('grades.otsenki_za_sessiyu'), tr('grades.gradesset_iz_gradestotal', { gradesSet: s.gradesSet, gradesTotal: s.gradesTotal }));
    fact(tr('grades.ozhidaetsya'), String(s.pending));
    fact(tr('grades.srok_proshel_2'), String(s.overdue), s.overdue ? 'bad' : null);
    fact(tr('grades.dolgi'), s.debts.length ? String(s.debts.length) : tr('grades.net'), s.debts.length ? 'bad' : null);
    card.append(facts);

    if (s.nextDeadline) {
      const nd = el('div', 'next-deadline');
      nd.append(el('p', 'next-deadline__title', tr('grades.blizhayshiy_srok_p0', { p0: D.dayMonth(s.nextDeadline.due) })));
      const ul = el('ul', 'next-deadline__list');
      for (const i of s.nextDeadline.items) ul.append(el('li', null, i.discipline ? `${i.what}: ${i.discipline}` : i.what));
      nd.append(ul);
      card.append(nd);
    }

    if (data.previous) {
      const p = el('p', 'previous');
      p.append(document.createTextNode(`${data.previous.name}: `));
      p.append(el('strong', null, num(data.previous.total)));
      p.append(document.createTextNode(data.previous.isFinal ? tr('grades.itogovyy_2') : ' · '));
      const a = el('a', null, tr('grades.posmotret'));
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
    head.append(D.disciplineTitle('h3', 'subject__title', d.discipline, d.color), el('span', 'badge', CONTROL[d.control]));
    card.append(head);

    const meta = [d.teacher.replace(/^(\S+)\s+(\S)\S*\s+(\S)\S*$/, '$1 $2. $3.')];
    if (d.examDate) meta.push(`${CONTROL[d.control].toLowerCase()} ${D.dayMonth(d.examDate)}`);
    card.append(el('p', 'subject__meta', meta.join(' · ')));

    card.append(
      row(
        tr('grades.bally_za_semestr'),
        d.currentPoints !== null ? tr('grades.p0_iz_currentmax', { p0: num(d.currentPoints), currentMax: d.currentMax }) : null,
        null,
        d.currentStatus,
        tr('grades.ne_vystavleny_bally_za', { discipline: d.discipline, p1: d.currentStatus.due ? tr('grades.srok_byl_p0', { p0: D.dayMonth(d.currentStatus.due) }) : '' }),
      ),
    );
    card.append(
      row(
        CONTROL[d.control],
        d.grade ? GRADE[d.grade] : null,
        d.grade ? (isDebt(d.grade) ? 'grade grade--bad' : 'grade grade--ok') : null,
        d.gradeStatus,
        tr('grades.ne_vystavlena_otsenka_p0', { p0: CONTROL[d.control].toLowerCase(), discipline: d.discipline }),
      ),
    );
    return card;
  }

  // ---------- Активность и надбавка ----------
  function renderSocial(social) {
    const card = el('section', 'card');
    card.append(el('h2', 'section-title', tr('grades.obschestvennaya_aktivnost')));
    if (!social) {
      card.append(el('p', 'muted', tr('grades.za_etot_semestr_bally')));
      return card;
    }
    card.append(
      row(tr('grades.bally'), social.points !== null ? tr('grades.p0_iz_maxpoints', { p0: num(social.points), maxPoints: social.maxPoints }) : null, null, social.status, tr('grades.ne_vystavleny_bally_za_2')),
    );
    if (social.note) card.append(el('p', 'muted', social.note));
    return card;
  }

  function renderBonuses(bonuses, bonusBlock, showLink) {
    const card = el('section', 'card');
    const head = el('div', 'subject__head');
    head.append(el('h2', 'section-title', tr('grades.nadbavka')), el('span', 'bonus-total', tr('grades.p0_iz_max', { p0: num(bonusBlock.points), max: bonusBlock.max })));
    card.append(head);
    if (showLink) {
      const link = el('a', 'bonus-where', tr('grades.gde_zarabotat'));
      link.href = '/grades/bonus';
      card.append(link);
    }
    if (!bonuses.length) {
      card.append(el('p', 'muted', tr('grades.v_etom_semestre_nadbavki')));
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
      setupPicker('student-picker', 'student-select', data.students.map((s) => ({ value: s.id, label: [s.fullName, s.group].filter(Boolean).join(', ') })), data.student && data.student.id, 'student');
    }
    if (!data.student || !data.semester) {
      loading.hidden = true;
      content.replaceChildren(el('div', 'empty', tr('grades.dannykh_ob_uspevaemosti_poka')));
      content.hidden = false;
      return;
    }
    setupPicker(
      'semester-picker',
      'semester-select',
      data.semesters.map((s) => ({ value: s.id, label: s.isCurrent ? tr('grades.name_tekuschiy', { name: s.name }) : s.name })),
      data.semester.id,
      'semester',
    );

    // На компьютере: слева сводка (остаётся на месте при прокрутке), справа дисциплины.
    const side = el('aside', 'split__side split__side--sticky');
    side.setAttribute('aria-label', tr('grades.svodka'));
    side.append(renderSummary(data));
    const main = el('div', 'split__main');
    const subjects = el('section', 'subjects');
    subjects.append(el('h2', 'section-title', tr('grades.distsipliny')));
    if (data.disciplines.length) {
      const list = el('div', 'subject-list');
      for (const d of data.disciplines) list.append(renderDiscipline(d));
      subjects.append(list);
    } else {
      subjects.append(el('p', 'day__empty', tr('grades.v_etom_semestre_distsiplin')));
    }
    const extra = el('div', 'split__pair');
    extra.append(renderSocial(data.social), renderBonuses(data.bonuses, data.rating.blocks.find((b) => b.key === 'bonus'), !data.students && data.semester.isCurrent));
    // Калькулятор — только студенту и только за текущий семестр.
    if (!data.students && data.semester.isCurrent && data.disciplines.length) main.append(window.DekanatForecast.render(data));
    main.append(subjects, extra);

    content.className = 'split';
    content.replaceChildren(side, main);
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
