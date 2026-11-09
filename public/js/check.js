'use strict';
// Открытая проверка студенческого билета по коду из QR. Вход не нужен.
(function () {
  const result = document.getElementById('result');
  const loading = document.getElementById('state-loading');

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  const fullDate = (d) =>
    new Intl.DateTimeFormat(window.DekanatI18n.locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T00:00:00Z`));

  const VIEW = {
    valid: { tone: 'ok', title: tr('check.bilet_deystvitelen'), text: (d) => tr('check.do_p0', { p0: fullDate(d.validUntil) }) },
    expired: { tone: 'bad', title: tr('check.srok_deystviya_bileta_istek'), text: (d) => tr('check.deystvoval_do_p0', { p0: fullDate(d.validUntil) }) },
    not_found: { tone: 'bad', title: tr('check.bilet_ne_nayden'), text: () => tr('check.otskaniruyte_qr_kod_esche') },
  };

  function render(data) {
    const view = VIEW[data.state] || VIEW.not_found;
    const card = el('section', `card verify-result verify-result--${view.tone}`);
    card.append(el('p', 'verify-result__title', view.title), el('p', null, view.text(data)));
    result.replaceChildren(card);
  }

  async function check(code) {
    let data;
    try {
      const res = await fetch(`/api/check/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('check.ne_udalos_proverit_bilet'));
    } catch (err) {
      loading.hidden = true;
      const alert = el('p', 'alert', err instanceof TypeError ? tr('check.net_podklyucheniya_proverka_rabotaet') : err.message);
      alert.setAttribute('role', 'alert');
      result.replaceChildren(alert);
      return;
    }
    loading.hidden = true;
    render(data);
  }

  check(window.location.pathname.split('/')[2] || '');
})();
