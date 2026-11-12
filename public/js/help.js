'use strict';
// Раздел «Помощь»: адрес /help?q=… сразу показывает ответ (так работает «Забыли пароль?»).
(function () {
  const q = new URLSearchParams(window.location.search).get('q') || '';
  // «Пройти тур заново»: тур начинается с первого шага, на какой бы странице ни был студент.
  const tourStart = document.getElementById('tour-help-start');
  if (tourStart && window.DekanatTour) tourStart.addEventListener('click', () => window.DekanatTour.restart());

  window.DekanatHelp.mount(document.getElementById('help-box'), { syncAddress: true, initial: q.slice(0, 200) });
})();
