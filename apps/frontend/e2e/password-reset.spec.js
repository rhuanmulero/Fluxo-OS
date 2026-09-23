import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

const NEUTRAL_MESSAGE =
  'Se existir uma conta com esse e-mail, enviamos o link de redefinição. Confira sua caixa de entrada.';

test.describe('Recuperacao de senha nas telas', () => {
  test('o link morto virou botao e revela o formulario de e-mail', async ({ page }) => {
    await page.goto('/login.html');

    const trigger = page.locator('[data-action="forgot"]');
    await expect(trigger).toHaveText('Esqueceu a senha?');
    expect(await trigger.evaluate((el) => el.tagName)).toBe('BUTTON');

    await expect(page.locator('#forgotForm')).toBeHidden();

    await trigger.click();

    await expect(page.locator('#forgotForm')).toBeVisible();
    await expect(page.locator('#loginForm')).toBeHidden();
    await expect(page.locator('#forgotForm [name="email"]')).toBeFocused();

    await page.locator('[data-action="back-to-login"]').click();

    await expect(page.locator('#forgotForm')).toBeHidden();
    await expect(page.locator('#loginForm')).toBeVisible();
  });

  test('o e-mail e obrigatorio e o erro nasce sob o campo', async ({ page }) => {
    await page.goto('/login.html');
    await page.locator('[data-action="forgot"]').click();

    await expect(
      page.locator('#forgotForm [data-field="email"] label .field-required'),
    ).toHaveText('*');

    const requests = [];
    await page.route('**/api/auth/request-password-reset', async (route) => {
      requests.push(route.request());
      await route.continue();
    });

    await page.locator('#forgotForm button[type="submit"]').click();

    await expect(page.locator('#forgotForm [data-field="email"] .field-error')).toHaveText(
      'Informe o e-mail da conta.',
    );
    expect(requests).toHaveLength(0);
  });

  test('a resposta e a mesma para conta existente e inexistente', async ({ page }) => {
    const account = newAccount('i03-neutral');
    await signUp(page, account);

    await page.goto('/login.html');
    await page.locator('[data-action="forgot"]').click();
    await page.locator('#forgotForm [name="email"]').fill(account.email);
    await page.locator('#forgotForm button[type="submit"]').click();

    await expect(page.locator('#forgotForm .form-notice')).toHaveText(NEUTRAL_MESSAGE);

    await page.goto('/login.html');
    await page.locator('[data-action="forgot"]').click();
    await page.locator('#forgotForm [name="email"]').fill('nao-existe-mesmo@fluxo.local');
    await page.locator('#forgotForm button[type="submit"]').click();

    await expect(page.locator('#forgotForm .form-notice')).toHaveText(NEUTRAL_MESSAGE);
  });

  test('o botao gira enquanto o pedido esta em voo', async ({ page }) => {
    const account = newAccount('i03-pending');
    await signUp(page, account);

    await page.route('**/api/auth/request-password-reset', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/login.html');
    await page.locator('[data-action="forgot"]').click();
    await page.locator('#forgotForm [name="email"]').fill(account.email);

    const button = page.locator('#forgotForm button[type="submit"]');
    await button.click();

    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button.locator('.btn-spinner')).toBeVisible();

    await expect(page.locator('#forgotForm .form-notice')).toHaveText(NEUTRAL_MESSAGE);
  });

  test('sem token, a pagina de nova senha mostra o aviso de link invalido', async ({ page }) => {
    await page.goto('/reset-password.html');

    await expect(page.locator('#resetForm')).toBeHidden();
    await expect(page.locator('#resetInvalid')).toBeVisible();
    await expect(page.locator('#resetInvalid')).toContainText('Este link não é mais válido.');
  });

  test('senha curta e senhas diferentes mostram o erro sob o campo certo', async ({ page }) => {
    await page.goto('/reset-password.html?token=qualquer-coisa');

    await expect(page.locator('#resetForm')).toBeVisible();
    await expect(page.locator('[data-field="password"] label .field-required')).toHaveText('*');
    await expect(page.locator('[data-field="confirmation"] label .field-required')).toHaveText('*');

    const requests = [];
    await page.route('**/api/auth/reset-password', async (route) => {
      requests.push(route.request());
      await route.continue();
    });

    await page.locator('#resetForm button[type="submit"]').click();
    await expect(page.locator('[data-field="password"] .field-error')).toHaveText(
      'Informe a nova senha.',
    );
    await expect(page.locator('[data-field="confirmation"] .field-error')).toHaveText(
      'Repita a nova senha.',
    );

    await page.locator('[name="password"]').fill('curta');
    await page.locator('[name="confirmation"]').fill('curta');
    await page.locator('#resetForm button[type="submit"]').click();
    await expect(page.locator('[data-field="password"] .field-error')).toHaveText(
      'A senha deve ter ao menos 8 caracteres.',
    );

    await page.locator('[name="password"]').fill('senha-nova-123');
    await page.locator('[name="confirmation"]').fill('outra-senha-456');
    await page.locator('#resetForm button[type="submit"]').click();
    await expect(page.locator('[data-field="confirmation"] .field-error')).toHaveText(
      'As duas senhas precisam ser iguais.',
    );

    expect(requests).toHaveLength(0);
  });

  test('um token invalido devolve mensagem em portugues, nunca em ingles', async ({ page }) => {
    await page.goto('/reset-password.html?token=token-que-nao-existe');

    await page.locator('[name="password"]').fill('senha-nova-123');
    await page.locator('[name="confirmation"]').fill('senha-nova-123');
    await page.locator('#resetForm button[type="submit"]').click();

    const error = page.locator('[data-field="password"] .field-error');
    await expect(error).toBeVisible();

    const message = await error.textContent();
    expect(message).toMatch(/[áâãéêíóôõúç]|link|senha|válido/i);
    expect(message).not.toMatch(/invalid|expired|token|password|not found/i);
  });
});
