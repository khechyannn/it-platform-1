if (getToken()) {
  window.location.href = '/chat';
}

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

document.querySelectorAll('.demo-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    emailInput.value = btn.dataset.email;
    passwordInput.value = btn.dataset.password;
    errorEl.hidden = true;
    emailInput.focus();
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Ошибка входа');
    }
    setSession(data.token, data.user);
    window.location.href = '/chat';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});
