'use strict';
// Тема оформления. Подключается в <head> ДО стилей и выполняется сразу,
// чтобы страница не «мигала» другой темой при загрузке.
// Выбор хранится в этом браузере (localStorage) — это не личные данные, на сервер не уходит.
(function () {
  // Ранее выбранная тема, которой больше нет (например, «Современный светлый»), заменяется на основную.
  const THEMES = ['classic', 'dark'];
  const KEY = 'dekanat-theme';

  function read() {
    try {
      const t = window.localStorage.getItem(KEY);
      return THEMES.includes(t) ? t : 'classic';
    } catch {
      return 'classic'; // хранилище может быть запрещено — тогда тема по умолчанию
    }
  }

  // Цвет строки состояния телефона и заголовка приложения — как у шапки выбранной темы.
  const BAR_COLOR = { classic: '#13245a', dark: '#171c2d' };

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.setAttribute('content', BAR_COLOR[theme]);
  }

  apply(read());

  window.DekanatTheme = {
    THEMES,
    get: read,
    set(theme) {
      if (!THEMES.includes(theme)) return;
      try {
        window.localStorage.setItem(KEY, theme);
      } catch {
        // не сохранилось — тема всё равно применится до перезагрузки
      }
      apply(theme);
    },
  };
})();
