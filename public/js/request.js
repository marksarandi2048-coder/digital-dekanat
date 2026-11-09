'use strict';
// Отдельная страница заявки (/requests/5). На широком экране заявки открываются
// справа от списка, как в почте, поэтому туда и переходим.
(function () {
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  const id = window.location.pathname.split('/')[2];
  const justCreated = new URLSearchParams(window.location.search).get('created') === '1';

  if (window.matchMedia('(min-width: 1100px)').matches) {
    window.location.replace(`/requests?id=${encodeURIComponent(id)}${justCreated ? '&created=1' : ''}`);
    return;
  }

  window.RequestView.load({
    container: content,
    id,
    heading: 'h1',
    justCreated,
    onError(message) {
      loading.hidden = true;
      content.hidden = true;
      errorBox.textContent = message;
      errorBox.hidden = false;
    },
  }).then((r) => {
    if (!r) return;
    document.title = tr('request.title_tsifrovoy_dekanat', { title: r.title });
    loading.hidden = true;
    content.hidden = false;
  });
})();
