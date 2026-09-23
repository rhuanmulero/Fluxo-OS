export function newAccount(label) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    name: `Teste ${label}`,
    email: `e2e-${label}-${stamp}@fluxo.local`,
    password: 'senha-de-teste-123',
  };
}

export async function signUp(page, account) {
  await page.goto('/login.html');

  const response = await page.evaluate(async (credentials) => {
    const result = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    return { status: result.status, body: await result.text() };
  }, account);

  if (response.status !== 200) {
    throw new Error(`Falha ao cadastrar conta de teste: ${response.status} ${response.body}`);
  }

  return account;
}

export async function signIn(page, account) {
  await page.goto('/login.html');

  const response = await page.evaluate(async (credentials) => {
    const result = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });

    return { status: result.status, body: await result.text() };
  }, account);

  if (response.status !== 200) {
    throw new Error(`Falha ao autenticar conta de teste: ${response.status} ${response.body}`);
  }
}
