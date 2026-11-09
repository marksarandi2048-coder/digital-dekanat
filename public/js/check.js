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
    new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T00:00:00Z`));

  const VIEW = {
    valid: { tone: 'ok', title: '✓ Билет действителен', text: (d) => `до ${fullDate(d.validUntil)}` },
    expired: { tone: 'bad', title: '✕ Срок действия билета истёк', text: (d) => `Действовал до ${fullDate(d.validUntil)}` },
    not_found: { tone: 'bad', title: '✕ Билет не найден', text: () => 'Отсканируйте QR-код ещё раз.' },
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
      if (!res.ok) throw new Error(data.error || 'Не удалось проверить билет');
    } catch (err) {
      loading.hidden = true;
      const alert = el('p', 'alert', err.message === 'Failed to fetch' ? 'Нет связи с сервером' : err.message);
      alert.setAttribute('role', 'alert');
      result.replaceChildren(alert);
      return;
    }
    loading.hidden = true;
    render(data);
  }

  check(window.location.pathname.split('/')[2] || '');
})();
