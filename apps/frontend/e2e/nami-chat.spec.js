import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { apiRequest, createWorkspace, createProject, enterWorkspace } from './support/shell.js';

test('Nami configura chave, conversa, restaura histórico e preserva rascunho após falha', async ({ page }) => {
  await signUp(page, newAccount('nami-ui'));
  const workspace = await createWorkspace(page, 'Workspace Nami');
  await createProject(page, workspace.id, 'Projeto Nami');
  let configured = false;
  let fail = false;
  let deleted = false;
  const conversation = { id: 'conv-ui', title: 'Como testar?', messages: [{ role: 'user', content: 'Como testar?' }, { role: 'model', content: '<script>não executar</script> Use **testes automatizados** no \\*\\*Fluxo\\*\\*.' }] };
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
    } else if (path.endsWith('/conversations')) body = deleted ? [] : [conversation];
    else if (request.method() === 'PATCH') {
      Object.assign(conversation, request.postDataJSON());
      await route.fulfill({ status: 204 });
      return;
    } else if (request.method() === 'DELETE') {
      deleted = true;
      await route.fulfill({ status: 204 });
      return;
    }
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
  await page.getByRole('button', { name: 'Conversar com a Nami', exact: true }).press('Enter');
  await panel.getByLabel('Mensagem para a Nami', { exact: true }).fill('Como testar?');
  const composer = panel.getByLabel('Mensagem para a Nami', { exact: true });
  await composer.press('Shift+Enter');
  await expect(composer).toHaveValue('Como testar?\n');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await composer.press('Enter');
  const reply = panel.locator('.nami-assistant .nami-markdown');
  await expect.poll(async () => {
    const text = await reply.textContent();
    return text.includes('<script>') && !text.includes('Fluxo');
  }).toBe(true);
  await expect(reply).toContainText('Fluxo');
  await expect(panel.locator('.nami-assistant')).toContainText('<script>não executar</script>');
  await expect(panel.locator('.nami-messages script')).toHaveCount(0);
  await expect(panel.locator('.nami-assistant div strong')).toHaveText(['testes automatizados', 'Fluxo']);
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
  const mascot = page.getByRole('button', { name: 'Conversar com a Nami', exact: true });
  await mascot.press('Enter');
  await expect(panel).toBeVisible();
  await page.locator('[data-route="tasks"]').click();
  await expect(panel).toBeHidden();
  await expect(mascot).toBeVisible();
  await mascot.press('Enter');
  await expect(panel).toBeVisible();

  await page.locator('#btn-new-task').click();
  await expect(panel).toBeHidden();
  await expect(mascot).toBeHidden();
  await page.locator('#btn-close-drawer').click();
  await expect(mascot).toBeVisible();

  await mascot.press('Enter');
  await panel.getByRole('button', { name: 'Histórico', exact: true }).click();
  await panel.locator('.nami-history-row').hover();
  await panel.getByRole('button', { name: 'Fixar conversa', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Desafixar conversa' })).toHaveAttribute('aria-pressed', 'true');
  await panel.locator('.nami-history-row').hover();
  await panel.getByRole('button', { name: 'Renomear conversa' }).click();
  await panel.getByRole('textbox', { name: 'Nome da conversa' }).fill('Testes do Fluxo');
  await panel.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Testes do Fluxo' })).toBeVisible();
  await panel.locator('.nami-history-row').hover();
  const expand = panel.getByRole('button', { name: 'Tela cheia' });
  await expand.click();
  const sidebar = panel.getByRole('complementary', { name: 'Histórico da Nami' });
  await sidebar.getByRole('button', { name: 'Testes do Fluxo' }).click();
  await expect(composer).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Testes do Fluxo' })).toHaveAttribute('aria-current', 'true');
  await sidebar.getByRole('button', { name: /Nova conversa/ }).click();
  await expect(panel.getByRole('heading', { name: 'No que vamos trabalhar?' })).toBeVisible();
  await expand.click();
  await expect(sidebar).toBeHidden();
  await panel.getByRole('button', { name: 'Histórico', exact: true }).click();
  await panel.locator('.nami-history-row').hover();
  await panel.getByRole('button', { name: 'Excluir conversa' }).click();
  await panel.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(panel.getByText('Você ainda não tem conversas salvas.')).toBeVisible();

  await panel.getByRole('button', { name: 'Voltar ao chat' }).click();
  await page.route('**/api/me/nami/messages', route => route.fulfill({ json: {
    id: 'creation-demo',
    messages: [{ role: 'model', content: 'Revise e confirme para salvar.' }],
    creation: { kind: 'project', label: 'Projeto', data: { name: 'Projeto criado pela Nami' } },
  } }));
  await composer.fill('Crie o projeto Projeto criado pela Nami');
  await composer.press('Enter');
  const confirmation = panel.getByRole('button', { name: 'Confirmar criação' });
  await expect(confirmation).toBeVisible();
  await expect(panel.locator('.nami-creation dd')).toHaveText('Projeto criado pela Nami');
  await expect(page.locator('.tasks-sidebar').getByText('Projeto criado pela Nami', { exact: true })).toHaveCount(0);
  await confirmation.click();
  await expect(panel.getByText('Projeto salvo com sucesso.')).toBeVisible();

  await expect(page.locator('.tasks-sidebar').getByText('Projeto criado pela Nami', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.tasks-sidebar')).toBeVisible();

  const project = await createProject(page, workspace.id, 'Projeto da consulta Nami');
  const columns = await apiRequest(page, 'GET', `/projects/${project.id}/columns`);
  const task = await apiRequest(page, 'POST', `/projects/${project.id}/tasks`, {
    title: 'Revisar entrega Nami', kanbanColumnId: columns[0].id, type: 'BUG', priority: 'LOW',
  });
  await page.reload();
  await page.locator('.tasks-sidebar').getByText('Projeto da consulta Nami', { exact: true }).click();
  await mascot.press('Enter');
  await expect(panel).toBeVisible();
  let action = { kind: 'lookup', label: 'Demanda', data: { resource: 'task', target: task.title } };
  await page.route('**/api/me/nami/messages', route => route.fulfill({ json: {
    id: 'actions-demo',
    messages: [{ role: 'model', content: 'Confira o resultado.' }],
    creation: action,
  } }));
  await composer.fill('A demanda Revisar entrega Nami existe?');
  await composer.press('Enter');
  await expect(panel.locator('.nami-creation')).toContainText('1 item encontrado.');
  await expect(panel.locator('.nami-creation')).toContainText(task.title);
  action = { kind: 'edit', label: 'Editar demanda', data: {
    resource: 'task', target: task.title, changes: { priority: 'HIGH' },
  } };
  await composer.fill('Mude a prioridade da demanda para alta');
  await composer.press('Enter');
  await panel.locator('.nami-creation').getByRole('button', { name: /Revisar entrega Nami/ }).click();
  await expect(panel.locator('.nami-creation')).toContainText('Baixa → Alta');
  await expect.poll(async () => (await apiRequest(page, 'GET', `/projects/${project.id}/tasks/${task.id}`)).priority).toBe('LOW');
  await panel.getByRole('button', { name: 'Confirmar edição' }).click();
  await expect(panel.getByText('Alteração salva com sucesso.')).toBeVisible();
  expect(await apiRequest(page, 'GET', `/projects/${project.id}/tasks/${task.id}`)).toMatchObject({
    title: task.title, type: 'BUG', priority: 'HIGH',
  });

});
