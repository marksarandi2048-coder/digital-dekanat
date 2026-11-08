'use strict';
// Электронная справка для просмотра и печати (сохранения в PDF).
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const printBtn = document.getElementById('print-button');

  const id = window.location.pathname.split('/')[2];
  document.getElementById('back-link').href = `/requests/${encodeURIComponent(id)}`;
  printBtn.addEventListener('click', () => window.print());

  function showError(text) {
    loading.hidden = true;
    errorBox.textContent = text;
    errorBox.hidden = false;
  }

  async function load() {
    let data;
    try {
      data = await D.fetchJSON(`/api/requests/${encodeURIComponent(id)}`);
    } catch (err) {
      showError(err.message);
      return;
    }
    const c = data.request.certificate;
    if (!c) {
      showError('Электронная справка по этой заявке ещё не готова.');
      return;
    }

    const parts = [];
    if (c.state !== 'valid') {
      parts.push(el('p', 'verdict verdict--bad', c.state === 'expired' ? 'Срок действия справки истёк — при проверке она будет недействительна.' : 'Справка отозвана.'));
    }

    const doc = el('article', 'certificate');
    doc.append(el('p', 'certificate__watermark', 'Концепт · не официальный документ'));

    const head = el('div', 'certificate__head');
    const logo = document.createElement('img');
    logo.src = '/img/logo.svg';
    logo.alt = '';
    logo.width = 40;
    logo.height = 40;
    head.append(logo, el('p', 'certificate__org', 'Цифровой деканат — электронная справка'));
    doc.append(head);

    doc.append(el('h1', 'certificate__title', 'Справка об обучении'), el('p', 'certificate__number', `№ ${c.number} от ${D.fullDate(c.issuedAt.slice(0, 10))}`));

    const text = el('p', 'certificate__text');
    text.append(
      el('strong', null, c.fullName),
      document.createTextNode(
        ` обучается на ${c.course} курсе, ${c.faculty.charAt(0).toLowerCase()}${c.faculty.slice(1)}, направление подготовки «${c.program}», форма обучения — ${c.studyForm}.`,
      ),
    );
    doc.append(text);
    if (c.purpose) doc.append(el('p', 'certificate__text', `Справка выдана для предоставления: ${c.purpose}.`));
    doc.append(el('p', 'certificate__text', `Действительна до ${D.fullDate(c.validUntil)}`));
    doc.append(el('p', 'certificate__sign', `Подписано: ${c.signedBy}`));

    // QR-код и ручная проверка.
    const check = el('div', 'certificate__check');
    const qr = document.createElement('img');
    qr.className = 'certificate__qr';
    qr.src = `/api/requests/${encodeURIComponent(id)}/qr.svg`;
    qr.alt = 'QR-код для проверки подлинности справки';
    qr.width = 140;
    qr.height = 140;
    const howto = el('div', 'certificate__howto');
    howto.append(
      el('p', 'certificate__howto-title', 'Проверка подлинности'),
      el('p', null, 'Отсканируйте QR-код или откройте страницу'),
      el('p', 'certificate__url', c.verifyBase),
      el('p', null, 'и введите код:'),
      el('p', 'certificate__code', c.code),
    );
    check.append(qr, howto);
    doc.append(check);

    parts.push(doc);
    content.replaceChildren(...parts);
    loading.hidden = true;
    content.hidden = false;
    printBtn.hidden = false;
  }

  load();
})();
