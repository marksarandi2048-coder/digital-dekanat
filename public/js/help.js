'use strict';
// Раздел «Помощь»: адрес /help?q=… сразу показывает ответ (так работает «Забыли пароль?»).
(function () {
  const q = new URLSearchParams(window.location.search).get('q') || '';
  window.DekanatHelp.mount(document.getElementById('help-box'), { syncAddress: true, initial: q.slice(0, 200) });
})();
