import { expect, test } from '@playwright/test';
import { newAccount, signIn, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  setNavigationPlacement,
} from './support/shell.js';

async function openAccount(page, account) {
  await signUp(page, account);
  await createWorkspace(page, 'Workspace conta');
  await setNavigationPlacement(page, { dock: 'bottom' });
  await enterWorkspace(page);
  await page.locator('[data-label="Configurações"]').click();
  await page.locator('.settings-rail-item[data-section="account"]').click();
}

test.describe('Configuracao de Conta', () => {
  test('a secao Conta abre com nome e e-mail preenchidos', async ({ page }) => {
    const account = newAccount('k13-abrir');
    await openAccount(page, account);

    await expect(page.locator('#account-name')).toHaveValue(account.name);
    await expect(page.locator('#account-email')).toHaveValue(account.email);
    await expect(page.locator('#account-email')).toBeDisabled();
    await expect(page.locator('#btn-save-account-email')).toHaveCount(0);
  });

  test('trocar o nome salva e reflete no chip do usuario', async ({ page }) => {
    await openAccount(page, newAccount('k13-nome'));

    await page.locator('#account-name').fill('Nome Trocado');
    await page.locator('#btn-save-account-name').click();

    await expect(page.locator('#account-feedback')).toContainText('Nome atualizado.');

    const me = await apiRequest(page, 'GET', '/me');

    expect(me.name).toBe('Nome Trocado');
  });

  test('senha curta demais e recusada com mensagem em portugues', async ({ page }) => {
    const account = newAccount('k13-senha-curta');
    await openAccount(page, account);

    await page.locator('#account-current-password').fill(account.password);
    await page.locator('#account-new-password').fill('123');
    await page.locator('#btn-save-account-password').click();

    await expect(page.locator('#account-feedback')).toContainText('ao menos 8 caracteres');
  });

  test('senha atual errada e recusada', async ({ page }) => {
    await openAccount(page, newAccount('k13-senha-errada'));

    await page.locator('#account-current-password').fill('senha-que-nao-e-a-minha');
    await page.locator('#account-new-password').fill('outra-senha-longa-9');
    await page.locator('#btn-save-account-password').click();

    await expect(page.locator('#account-feedback')).toContainText('Senha incorreta.');
  });

  test('trocar a senha permite entrar com a nova', async ({ page }) => {
    const account = newAccount('k13-senha-ok');
    await openAccount(page, account);

    await page.locator('#account-current-password').fill(account.password);
    await page.locator('#account-new-password').fill('nova-senha-longa-9');
    await page.locator('#btn-save-account-password').click();

    await expect(page.locator('#account-feedback')).toContainText('Senha trocada.');

    await signIn(page, { email: account.email, password: 'nova-senha-longa-9' });
  });

  test('encerrar as outras sessoes responde sem erro', async ({ page }) => {
    await openAccount(page, newAccount('k13-sessoes'));

    await page.locator('#btn-revoke-sessions').click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(page.locator('#account-feedback')).toContainText('Outras sessões encerradas.');
  });
});
