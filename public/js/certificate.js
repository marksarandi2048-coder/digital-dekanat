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
      showError(tr('certificate.elektronnaya_spravka_po_etoy'));
      return;
    }

    const parts = [];
    if (c.state !== 'valid') {
      parts.push(el('p', 'verdict verdict--bad', c.state === 'expired' ? tr('certificate.srok_deystviya_spravki_istek') : tr('certificate.spravka_otozvana')));
    }

    const doc = el('article', 'certificate');
    doc.append(el('p', 'certificate__watermark', tr('certificate.kontsept_ne_ofitsialnyy_dokument')));

    const head = el('div', 'certificate__head');
    const logo = document.createElement('img');
    logo.src = '/img/logo.svg';
    logo.alt = '';
    logo.width = 40;
    logo.height = 40;
    head.append(logo, el('p', 'certificate__org', tr('certificate.tsifrovoy_dekanat_elektronnaya_spravka')));
    doc.append(head);

    doc.append(el('h1', 'certificate__title', tr('certificate.spravka_ob_obuchenii')), el('p', 'certificate__number', tr('certificate.number_ot_p1', { number: c.number, p1: D.fullDate(c.issuedAt.slice(0, 10)) })));

    const text = el('p', 'certificate__text');
    text.append(
      el('strong', null, c.fullName),
      document.createTextNode(
        tr('certificate.obuchaetsya_na_course_kurse', { course: c.course, p1: c.faculty.charAt(0).toLowerCase(), p2: c.faculty.slice(1), program: c.program, studyForm: c.studyForm }),
      ),
    );
    doc.append(text);
    if (c.purpose) doc.append(el('p', 'certificate__text', tr('certificate.spravka_vydana_dlya_predostavleniya', { purpose: c.purpose })));
    doc.append(el('p', 'certificate__text', tr('certificate.deystvitelna_do_p0', { p0: D.fullDate(c.validUntil) })));
    doc.append(el('p', 'certificate__sign', tr('certificate.podpisano_signedby', { signedBy: c.signedBy })));

    // QR-код и ручная проверка.
    const check = el('div', 'certificate__check');
    const qr = document.createElement('img');
    qr.className = 'certificate__qr';
    qr.src = `/api/requests/${encodeURIComponent(id)}/qr.svg`;
    qr.alt = tr('certificate.qr_kod_dlya_proverki');
    qr.width = 140;
    qr.height = 140;
    const howto = el('div', 'certificate__howto');
    howto.append(
      el('p', 'certificate__howto-title', tr('certificate.proverka_podlinnosti')),
      el('p', null, tr('certificate.otskaniruyte_qr_kod_ili')),
      el('p', 'certificate__url', c.verifyBase),
      el('p', null, tr('certificate.i_vvedite_kod')),
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
