'use strict';
// «Рейтинг по семестрам»: график рейтинга по всем семестрам студента и сравнение двух выбранных.
// Данные приходят с сервера в /api/grades (поле history) — только свои, у сотрудника — выбранного студента.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const NS = 'http://www.w3.org/2000/svg';
  const fmt = (n, digits = 1) =>
    new Intl.NumberFormat(window.DekanatI18n.locale, { maximumFractionDigits: digits, minimumFractionDigits: digits === 2 ? 2 : 0 }).format(n);

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    return node;
  }

  // «Осень 25/26», «Весна 24/25» — коротко, чтобы помещалось под графиком на 360 px.
  function shortName(h) {
    const y = Number(h.startsOn.slice(0, 4));
    const autumn = Number(h.startsOn.slice(5, 7)) >= 8;
    const yy = (n) => String(n % 100).padStart(2, '0');
    return autumn
      ? [tr('grades.history_autumn'), `${yy(y)}/${yy(y + 1)}`]
      : [tr('grades.history_spring'), `${yy(y - 1)}/${yy(y)}`];
  }

  // ---------- График ----------
  function drawChart(box, history, picked, onPick) {
    const W = Math.max(280, Math.round(box.clientWidth));
    const H = 150; // невысокий: блок стоит рядом со сводкой и не должен её перерастать
    const pad = { left: 34, right: 18, top: 24, bottom: 40 };
    const totals = history.map((h) => h.total);
    const hi = Math.max(100, Math.ceil(Math.max(...totals) / 10) * 10);
    const rawLo = Math.max(0, Math.min(...totals) - 5);
    const step = hi - rawLo <= 50 ? 10 : 20;
    const lo = Math.floor(rawLo / step) * step;
    const inset = W < 500 ? 22 : 36; // крайние точки отступают от шкалы, чтобы подписи не налезали
    const x = (i) => (history.length === 1 ? W / 2 : pad.left + inset + (i * (W - pad.left - pad.right - 2 * inset)) / (history.length - 1));
    const y = (v) => pad.top + ((hi - v) * (H - pad.top - pad.bottom)) / (hi - lo);

    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'hist-chart__svg' });
    root.setAttribute('role', 'img');
    root.setAttribute(
      'aria-label',
      tr('grades.history_chart', {
        list: history.map((h) => `${h.name} — ${fmt(h.total)}${h.isFinal ? '' : ` (${tr('grades.history_prelim')})`}`).join('; '),
      }),
    );

    // Сетка и подписи шкалы — бледные, чтобы не спорить с линией.
    for (let v = lo; v <= hi; v += step) {
      root.append(svg('line', { x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v), class: 'hist-chart__grid' }));
      const t = svg('text', { x: pad.left - 8, y: y(v) + 4, class: 'hist-chart__axis', 'text-anchor': 'end' });
      t.textContent = v;
      root.append(t);
    }

    // Линия: между закрытыми семестрами сплошная, к идущему — пунктир.
    const pts = history.map((h, i) => [x(i), y(h.total)]);
    const finalIdx = history.map((h, i) => (h.isFinal ? i : -1)).filter((i) => i >= 0);
    if (finalIdx.length > 1) {
      root.append(svg('path', { d: finalIdx.map((i, k) => `${k ? 'L' : 'M'}${pts[i][0]} ${pts[i][1]}`).join(''), class: 'hist-chart__line' }));
    }
    history.forEach((h, i) => {
      if (h.isFinal || i === 0) return;
      root.append(svg('path', { d: `M${pts[i - 1][0]} ${pts[i - 1][1]}L${pts[i][0]} ${pts[i][1]}`, class: 'hist-chart__line hist-chart__line--prelim' }));
    });

    // Точки, подписи значений у двух выбранных и подписи семестров снизу.
    history.forEach((h, i) => {
      const chosen = picked.includes(h.id);
      root.append(svg('circle', { cx: pts[i][0], cy: pts[i][1], r: chosen ? 6.5 : 5, class: `hist-chart__dot${h.isFinal ? '' : ' hist-chart__dot--prelim'}${chosen ? ' hist-chart__dot--chosen' : ''}` }));
      if (chosen) {
        const v = svg('text', { x: pts[i][0], y: pts[i][1] - 12, class: 'hist-chart__value', 'text-anchor': 'middle' });
        v.textContent = fmt(h.total);
        root.append(v);
      }
      const [season, years] = shortName(h);
      const label = svg('text', { x: pts[i][0], y: H - pad.bottom + 20, class: `hist-chart__label${chosen ? ' hist-chart__label--chosen' : ''}`, 'text-anchor': 'middle' });
      const a = svg('tspan', { x: pts[i][0] });
      a.textContent = season;
      const b = svg('tspan', { x: pts[i][0], dy: 16 });
      b.textContent = years;
      label.append(a, b);
      root.append(label);
    });

    // Подсказка при наведении или касании; нажатие ставит семестр во второе поле сравнения.
    const tip = el('div', 'hist-tip');
    tip.hidden = true;
    const colW = history.length === 1 ? W : (W - pad.left - pad.right) / (history.length - 1);
    history.forEach((h, i) => {
      const hit = svg('rect', { x: pts[i][0] - colW / 2, y: 0, width: colW, height: H, class: 'hist-chart__hit' });
      const show = () => {
        tip.replaceChildren(
          el('strong', null, h.name),
          el('span', null, `${tr('grades.history_rating')}: ${fmt(h.total)}${h.isFinal ? '' : ` (${tr('grades.history_prelim')})`}`),
          el('span', null, h.average !== null ? tr('grades.history_tip_avg', { p0: fmt(h.average, 2) }) : tr('grades.history_no_marks')),
        );
        tip.hidden = false;
        const left = Math.min(Math.max(pts[i][0], 90), W - 90);
        tip.style.left = `${left}px`;
        // Над точкой, а если сверху мало места — под ней, чтобы не закрывать саму точку.
        tip.style.top = `${pts[i][1] > 96 ? pts[i][1] - 92 : pts[i][1] + 16}px`;
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerleave', () => { tip.hidden = true; });
      hit.addEventListener('click', () => onPick(h.id));
      root.append(hit);
    });

    box.replaceChildren(root, tip);
  }

  // ---------- Сравнение ----------
  // ongoing — один из семестров ещё идёт: разница не окончательная, поэтому серая и без стрелок.
  function diffCell(a, b, digits, ongoing) {
    const td = el('td', 'hist-table__diff');
    if (a === null || b === null) {
      td.textContent = '—';
      return td;
    }
    const d = Math.round((b - a) * 100) / 100;
    if (ongoing) {
      const text = `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d), digits)}`;
      const span = el('span', 'hist-diff hist-diff--ongoing', text);
      span.setAttribute('aria-label', `${text}, ${tr('grades.history_ongoing')}`);
      td.append(span);
      return td;
    }
    if (d === 0) {
      td.append(el('span', 'hist-diff hist-diff--same', `= ${fmt(0)}`));
      td.setAttribute('aria-label', tr('grades.history_same'));
      return td;
    }
    const up = d > 0;
    const span = el('span', `hist-diff hist-diff--${up ? 'up' : 'down'}`, `${up ? '▲' : '▼'} ${up ? '+' : '−'}${fmt(Math.abs(d), digits)}`);
    span.setAttribute('aria-label', tr(up ? 'grades.history_up' : 'grades.history_down', { p0: fmt(Math.abs(d), digits) }));
    td.append(span);
    return td;
  }

  function renderTable(history, aId, bId) {
    // Колонки — по времени: раньше слева, разница «позже минус раньше».
    const [first, second] = [history.find((h) => h.id === aId), history.find((h) => h.id === bId)]
      .sort((p, q) => (p.startsOn < q.startsOn ? -1 : 1));
    const table = el('table', 'hist-table');
    const head = el('tr');
    head.append(el('th', null, ''));
    for (const h of [first, second]) {
      const th = el('th');
      th.scope = 'col';
      th.title = h.name;
      const [season, years] = shortName(h);
      th.append(el('span', 'hist-table__season', season), el('span', null, years));
      if (!h.isFinal) th.append(el('span', 'hist-table__prelim', tr('grades.history_prelim')));
      head.append(th);
    }
    const ongoing = !first.isFinal || !second.isFinal;
    const thDiff = el('th', null, tr('grades.history_diff'));
    thDiff.scope = 'col';
    if (ongoing) thDiff.append(el('span', 'hist-table__prelim', tr('grades.history_ongoing')));
    head.append(thDiff);
    const thead = el('thead');
    thead.append(head);

    const tbody = el('tbody');
    const addRow = (label, a, b, digits, strong, text) => {
      const tr_ = el('tr', strong ? 'hist-table__main' : null);
      const th = el('th', null, label);
      th.scope = 'row';
      tr_.append(th);
      for (const v of [a, b]) tr_.append(el('td', null, v === null ? text : fmt(v, digits)));
      tr_.append(diffCell(a, b, digits, ongoing));
      tbody.append(tr_);
    };
    addRow(tr('grades.history_rating'), first.total, second.total, 1, true);
    for (const block of first.blocks) {
      const other = second.blocks.find((x) => x.key === block.key);
      addRow(block.label, block.points, other ? other.points : null, 1, false);
    }
    addRow(tr('grades.history_average'), first.average, second.average, 2, true, tr('grades.history_no_marks'));
    table.append(thead, tbody);
    return table;
  }

  function picker(id, label, history, value, onChange) {
    const wrap = el('div', 'group-picker hist__picker');
    const l = el('label', null, label);
    l.htmlFor = id;
    const select = el('select');
    select.id = id;
    for (const h of history) {
      const opt = el('option', null, h.isCurrent ? tr('grades.name_tekuschiy', { name: h.name }) : h.name);
      opt.value = String(h.id);
      opt.selected = h.id === value;
      select.append(opt);
    }
    select.onchange = () => onChange(Number(select.value));
    wrap.append(l, select);
    return wrap;
  }

  function render(data) {
    const history = data.history || [];
    const card = el('section', 'card hist');
    card.setAttribute('aria-labelledby', 'hist-title');
    const title = el('h2', 'section-title', tr('grades.history_title'));
    title.id = 'hist-title';
    card.append(title);
    if (history.length < 2) {
      card.append(el('p', 'muted', tr('grades.history_one')));
      return card;
    }
    card.append(el('p', 'muted hist__hint', tr('grades.history_hint')));

    // По умолчанию — два последних закрытых семестра; если закрыт только один, то он и текущий.
    const finals = history.filter((h) => h.isFinal);
    const base = finals.length >= 2 ? finals : history;
    let a = base[base.length - 2].id;
    let b = base[base.length - 1].id;

    const chart = el('div', 'hist-chart');
    const pickers = el('div', 'hist__pickers');
    const compare = el('div', 'hist__compare');
    card.append(chart);
    if (history.some((h) => !h.isFinal)) card.append(el('p', 'hist__legend', tr('grades.history_legend')));

    // Таблица сравнения спрятана под кнопкой, чтобы блок оставался компактным.
    const panel = el('div', 'hist__panel');
    panel.id = 'hist-panel';
    panel.hidden = true;
    panel.append(pickers, compare);
    const toggle = el('button', 'button button--secondary button--small hist__toggle', tr('grades.history_toggle'));
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', panel.id);
    const setOpen = (open) => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = tr(open ? 'grades.history_toggle_hide' : 'grades.history_toggle');
    };
    toggle.addEventListener('click', () => setOpen(panel.hidden));
    card.append(toggle, panel);

    function update() {
      drawChart(chart, history, [a, b], (id) => {
        setOpen(true); // нажатие на точку сразу показывает сравнение
        if (id === b) return;
        if (id === a) a = b;
        b = id;
        update();
      });
      pickers.replaceChildren(
        picker('hist-a', tr('grades.history_compare'), history, a, (id) => { if (id === b) b = a; a = id; update(); }),
        picker('hist-b', tr('grades.history_with'), history, b, (id) => { if (id === a) a = b; b = id; update(); }),
      );
      const scroll = el('div', 'hist__table-wrap');
      scroll.append(renderTable(history, a, b));
      compare.replaceChildren(scroll);
    }

    // Рисуем, когда блок уже на странице (нужна его ширина), и перерисовываем при смене ширины.
    let width = 0;
    new ResizeObserver(() => {
      const w = Math.round(chart.clientWidth);
      if (w && w !== width) {
        width = w;
        update();
      }
    }).observe(chart);
    update();
    return card;
  }

  window.DekanatHistory = { render };
})();
