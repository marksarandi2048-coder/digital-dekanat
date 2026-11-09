'use strict';
// Страница входа: проверка полей, «показать пароль», загрузка на кнопке, демо-доступ.
(function () {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const button = document.getElementById('login-button');
  const buttonText = document.getElementById('login-button-text');
  const loginInput = form.elements.login;
  const passwordInput = form.elements.password;
  const toggle = document.getElementById('password-toggle');
  const demoStatus = document.getElementById('demo-status');
  const demoCards = [...document.querySelectorAll('.demo-card')];

  // Вымышленные демо-аккаунты из scripts/seed.js. Показываются жюри намеренно:
  // это не секреты, настоящих учётных записей здесь нет.
  const DEMO_ACCOUNTS = {
    'student-fmo': { login: 'v.aksenova', password: 'Student-1-demo' },
    'student-meo': { login: 'g.timofeev', password: 'Student-2-demo' },
    staff: { login: 'dekanat', password: 'Staff-demo-2026' },
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function wrapOf(input) {
    return input.closest('.input-wrap');
  }

  // Запускает «встряску»: класс снимается и ставится заново, чтобы анимация повторялась.
  function shake(input) {
    const wrap = wrapOf(input);
    wrap.classList.remove('is-shaking');
    void wrap.offsetWidth;
    wrap.classList.add('is-shaking');
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
    loginInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');
  }

  function showError(text, input) {
    errorBox.textContent = text; // textContent — текст не превращается в HTML
    errorBox.hidden = false;
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      shake(input);
      input.focus();
    }
  }

  function setLoading(isLoading) {
    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);
    form.setAttribute('aria-busy', String(isLoading));
    buttonText.textContent = isLoading ? 'Входим…' : 'Войти';
  }

  function setPasswordVisible(visible) {
    passwordInput.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
  }

  function clearDemoChoice() {
    demoStatus.textContent = '';
    for (const card of demoCards) card.setAttribute('aria-pressed', 'false');
  }

  for (const input of [loginInput, passwordInput]) {
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      clearDemoChoice();
    });
    wrapOf(input).addEventListener('animationend', (event) => {
      if (event.animationName === 'login-shake') event.currentTarget.classList.remove('is-shaking');
    });
  }

  toggle.addEventListener('click', () => {
    setPasswordVisible(toggle.getAttribute('aria-pressed') !== 'true');
    passwordInput.focus();
  });

  // Демо-карточка только заполняет форму: входит сам человек — кнопкой «Войти».
  for (const card of demoCards) {
    card.addEventListener('click', () => {
      if (button.disabled) return;
      const account = DEMO_ACCOUNTS[card.dataset.demo];
      clearError();
      loginInput.value = account.login;
      passwordInput.value = account.password;
      setPasswordVisible(false);
      clearDemoChoice();
      card.setAttribute('aria-pressed', 'true');
      const name = card.querySelector('.demo-card__name').textContent;
      demoStatus.textContent = `Подставлен доступ «${name}». Нажмите «Войти».`;

      // На телефоне кнопка «Войти» выше карточек — показываем её.
      button.focus({ preventScroll: true });
      const box = button.getBoundingClientRect();
      if (box.top < 0 || box.bottom > window.innerHeight) {
        button.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const login = loginInput.value.trim();
    const password = passwordInput.value;
    if (!login) {
      showError(password ? 'Введите логин' : 'Введите логин и пароль', loginInput);
      return;
    }
    if (!password) {
      showError('Введите пароль', passwordInput);
      return;
    }

    setPasswordVisible(false);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await window.DekanatPwa.signedIn();
        window.location.href = '/home'; // кнопка остаётся в загрузке до перехода
        return;
      }
      setLoading(false);
      if (res.status === 401) {
        showError('Неверный логин или пароль. Проверьте раскладку клавиатуры и Caps Lock.', passwordInput);
        passwordInput.select();
      } else {
        showError(data.error || 'Не удалось войти. Попробуйте ещё раз.');
      }
    } catch {
      setLoading(false);
      showError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
    }
  });
})();
