import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace } from './support/shell.js';

test('Nami configura chave, conversa, restaura histórico e preserva rascunho após falha', async ({ page }) => {
  await signUp(page, newAccount('nami-ui'));
  await createWorkspace(page, 'Workspace Nami');
  let configured = false;
  let fail = false;
  const conversation = { id: 'conv-ui', title: 'Como testar?', messages: [{ role: 'user', content: 'Como testar?' }, { role: 'model', content: '<script>não executar</script> Use testes automatizados.' }] };
  await page.route('**/api/me/nami/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body;
    if (path.endsWith('/settings')) {
      if (request.method() === 'PUT') {
        expect(request.postDataJSON()).toEqual({ apiKey: 'chave-ficticia-de-teste-123456', model: 'gemini-3.5-flash-lite' });
        configured = true;
      }
      body = { configured, model: 'gemini-3.5-flash-lite' };
    } else if (path.endsWith('/messages')) {
      if (fail) { await route.fulfill({ status: 429, json: { message: 'Limite de uso do Gemini atingido.' } }); return; }
      body = conversation;
    } else if (path.endsWith('/conversations')) body = [conversation];
    else body = conversation;
    await route.fulfill({ json: body });
  });
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Conversar com a Nami', exact: true }).focus();
  await page.getByRole('button', { name: 'Conversar com a Nami', exact: true }).press('Enter');
  const panel = page.getByRole('dialog', { name: 'Chat da Nami' });
  await expect(panel.getByRole('heading', { name: 'Oi, eu sou a Nami!' })).toBeVisible();
  await expect(panel.getByLabel('Chave da API do Gemini', { exact: true })).toHaveCount(0);
  await expect(panel.getByLabel('Mensagem para a Nami', { exact: true })).toBeHidden();
  await expect(panel.getByRole('button', { name: 'Histórico', exact: true })).toBeHidden();

  await panel.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.locator('.settings-rail-item[data-section="nami"]')).toHaveClass(/active/);
  const settings = page.locator('.settings-content');
  const apiKey = settings.getByLabel('Chave da API do Gemini', { exact: true });
  await apiKey.fill('chave-ficticia-de-teste-123456');
  await settings.getByRole('button', { name: 'Salvar configuração' }).click();
  await expect(settings.getByRole('status')).toContainText('Configuração salva.');
  await expect(apiKey).toHaveValue('');
  await page.locator('.settings-close').click();
  await panel.getByLabel('Mensagem para a Nami', { exact: true }).fill('Como testar?');
  await panel.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(panel.locator('.nami-assistant')).toContainText('<script>não executar</script>');
  await expect(panel.locator('.nami-messages script')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Nova conversa', exact: true }).click();
  await panel.getByRole('button', { name: 'Histórico', exact: true }).click();
  await panel.locator('.nami-history').getByRole('button', { name: 'Como testar?' }).click();
  await expect(panel.locator('.nami-assistant')).toBeVisible();
  fail = true;
  await panel.getByLabel('Mensagem para a Nami', { exact: true }).fill('Continue');
  await panel.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Limite de uso do Gemini atingido.');
  await expect(panel.getByLabel('Mensagem para a Nami', { exact: true })).toHaveValue('Continue');
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  const close = panel.getByRole('button', { name: 'Fechar chat da Nami' });
  await expect(close).toBeVisible();
  await close.click();
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Conversar com a Nami', exact: true }).focus();
  await page.getByRole('button', { name: 'Conversar com a Nami', exact: true }).press('Enter');
  await page.screenshot({ path: '../../tmp/nami-mobile.png' });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: '../../tmp/nami-desktop.png' });
  await panel.getByLabel('Mensagem para a Nami', { exact: true }).press('Escape');
  await expect(panel).toBeHidden();
});
