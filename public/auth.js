document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const message = document.getElementById('message');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('hall', data.hall || '');

      // Redirect based on role
      if (data.role === 'admin') {
        goTo('admin-dashboard.html');
      } else if (data.role === 'judge') {
        goTo('judge-dashboard.html');
      } else if (data.role === 'team') {
        goTo('team-dashboard.html');
      }
    } else {
      message.textContent = data.message || 'تعذر تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.';
      message.className = 'message error';
    }
  } catch (error) {
    message.textContent = 'حدث خطأ غير متوقع. يرجى المحاولة لاحقًا.';
    message.className = 'message error';
  }
});