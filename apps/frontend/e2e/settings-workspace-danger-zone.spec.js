import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { apiRequest, createWorkspace } from './support/shell.js';

async function abrirSecaoWorkspace(page) {
  await page.locator('.floating-nav [data-label="Configurações"]').click();
  await page.locator('[data-section="workspace"]').click();
}

test.describe('Zona de risco da secao Workspace', () => {
  test('o botao de excluir nao fica colado no texto que o explica', async ({ page }) => {
    const owner = newAccount('zr-espaco');
    await signUp(page, owner);
    await createWorkspace(page, 'Workspace Zona Espaco');

    await page.goto('/index.html');
    await expect(page.locator('#global-bg')).toBeAttached();
    await abrirSecaoWorkspace(page);

    const texto = await page.locator('.settings-hint').boundingBox();
    const botao = await page.locator('#workspace-delete').boundingBox();

    expect(botao.y - (texto.y + texto.height)).toBeGreaterThanOrEqual(12);
  });

  test('a falha ao excluir aparece na zona de risco, nao sob o campo de nome', async ({ page }) => {
    const owner = newAccount('zr-erro');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Zona Erro');

    await page.goto('/index.html');
    await expect(page.locator('#global-bg')).toBeAttached();

    await page.route(`**/api/workspaces/${workspace.id}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, message: 'Erro interno do servidor.' }),
      });
    });

    await abrirSecaoWorkspace(page);
    await page.locator('#workspace-delete').click();

    const dialogo = page.locator('.confirm-overlay');
    await dialogo.locator('input').fill(workspace.name);
    await dialogo.locator('[data-answer="yes"]').click();

    await expect(page.locator('#workspace-delete-error')).toHaveText('Erro interno do servidor.');
    await expect(page.locator('#workspace-error')).toHaveText('');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('excluir remove o workspace da lista, com projetos e tarefas dentro', async ({ page }) => {
    const owner = newAccount('zr-exclui');
    await signUp(page, owner);

    const alvo = await createWorkspace(page, 'Workspace Zona Alvo');
    await apiRequest(page, 'POST', '/workspaces', { name: 'Workspace Zona Vizinho' });

    const projeto = await apiRequest(page, 'POST', `/workspaces/${alvo.id}/projects`, {
      name: 'Projeto Zona',
    });
    const colunas = await apiRequest(page, 'GET', `/projects/${projeto.id}/columns`);
    await apiRequest(page, 'POST', `/projects/${projeto.id}/tasks`, {
      kanbanColumnId: colunas[0].id,
      title: 'Tarefa Zona',
      priority: 'HIGH',
      type: 'FEATURE',
    });

    await page.goto('/index.html');
    await expect(page.locator('#global-bg')).toBeAttached();
    await abrirSecaoWorkspace(page);
    await page.locator('#workspace-delete').click();

    const dialogo = page.locator('.confirm-overlay');
    await dialogo.locator('input').fill(alvo.name);
    await dialogo.locator('[data-answer="yes"]').click();

    await page.waitForURL('**/workspace.html');
    await expect(page.locator('#workspaceList')).toContainText('Workspace Zona Vizinho');
    await expect(page.locator('#workspaceList')).not.toContainText('Workspace Zona Alvo');

    const restantes = await apiRequest(page, 'GET', '/workspaces');
    expect(restantes.map((item) => item.name)).toEqual(['Workspace Zona Vizinho']);
  });
});
