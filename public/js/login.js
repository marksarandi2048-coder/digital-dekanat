'use strict';
// Страница входа.
(function () {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const button = document.getElementById('login-button');

  function showError(text) {
    errorBox.textContent = text; // textContent — текст не превращается в HTML
    errorBox.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const login = form.login.value.trim();
    const password = form.password.value;
    if (!login || !password) {
      showError('Введите логин и пароль');
      return;
    }

    button.disabled = true;
    button.textContent = 'Входим…';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.href = data.user && data.user.role === 'staff' ? '/requests' : '/today';
        return;
      }
      showError(data.error || 'Не удалось войти');
    } catch {
      showError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
    }
    button.disabled = false;
    button.textContent = 'Войти';
  });
})();
