'use strict';
// Страницы ошибок 404 и 500: подставляем иллюстрацию (рисунки — в common.js).
(function () {
  const D = window.Dekanat;
  for (const box of document.querySelectorAll('[data-illu]')) box.replaceChildren(D.illustration(box.dataset.illu));
})();
