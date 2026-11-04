'use strict';
// Заглушка «Написать в деканат». Тема приходит из адреса и выводится как обычный текст.
(function () {
  const topic = new URLSearchParams(window.location.search).get('topic');
  if (topic) {
    document.getElementById('topic-text').textContent = topic.slice(0, 300);
    document.getElementById('topic-box').hidden = false;
  }
})();
