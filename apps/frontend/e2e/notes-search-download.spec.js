import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  inviteMember,
  joinWorkspaceAsMember,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

async function openNotes(page) {
  await enterWorkspace(page);
  await gotoRoute(page, 'notes');
  await expect(page.locator('.notes-grid-scroll')).toBeVisible();
}

async function createNote(page, workspaceId, title, body) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/notes`, { title, body });
}

test.describe('Busca e download em Notas', () => {
  test('a busca vai ao servidor e encontra pelo corpo da nota', async ({ page }) => {
    const workspace = await seed(page, 'h12-search');

    await createNote(page, workspace.id, 'Reuniao de arquitetura', 'combinamos usar hexagonal');
    await createNote(page, workspace.id, 'Lista de compras', 'cafe e leite');

    await openNotes(page);
    await expect(page.locator('.note-card')).toHaveCount(2);

    const request = page.waitForRequest(
      (candidate) => candidate.url().includes('/notes') && candidate.url().includes('q=hexagonal'),
    );

    await page.locator('#note-search').fill('hexagonal');
    await page.locator('#note-search').press('Enter');

    await request;

    await expect(page.locator('.note-card')).toHaveCount(1);
    await expect(page.locator('.note-title')).toHaveText('Reuniao de arquitetura');
  });

  test('a busca mostra o carregamento na lista', async ({ page }) => {
    const workspace = await seed(page, 'h12-loading');

    await createNote(page, workspace.id, 'Nota qualquer', 'corpo qualquer');

    await openNotes(page);

    await page.route('**/api/workspaces/*/notes*', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      await route.continue();
    });

    await page.locator('#note-search').fill('qualquer');
    await page.locator('#note-search').press('Enter');

    await expect(page.locator('.notes-grid-scroll > .region-loader')).toBeVisible();
    await expect(page.locator('.notes-grid-scroll.is-loading')).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test('a busca nao encontra nota privada de outra pessoa', async ({ page, browser }) => {
    await signUp(page, newAccount('h12-owner'));
    const workspace = await createWorkspace(page, 'Workspace H12 Privacidade');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    await createNote(page, workspace.id, 'Segredo do dono', 'palavra rarissima aqui');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('h12-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await setNavigationPlacement(memberPage, { dock: 'bottom' });

    await openNotes(memberPage);

    await memberPage.locator('#note-search').fill('rarissima');
    await memberPage.locator('#note-search').press('Enter');

    await expect(memberPage.locator('.note-card')).toHaveCount(0);
    await expect(memberPage.locator('.notes-grid-scroll .empty-state')).toBeVisible();

    await memberContext.close();
  });

  test('baixar gera um .md com titulo e corpo, preservando acento no nome', async ({ page }) => {
    const workspace = await seed(page, 'h12-download');

    await createNote(page, workspace.id, 'Anotações da reunião', 'primeiro item');

    await openNotes(page);

    await page.locator('.note-card').first().hover();
    await page.locator('.btn-download-note').first().click();

    const download = page.waitForEvent('download');

    await page.locator('.note-export-option[data-format="md"]').click();

    const file = await download;

    expect(file.suggestedFilename()).toBe('Anotações da reunião.md');

    const stream = await file.createReadStream();
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks).toString()).toBe('# Anotações da reunião\n\nprimeiro item\n');
  });

  test('nota com titulo so de simbolos baixa como nota.md, sem erro', async ({ page }) => {
    const workspace = await seed(page, 'h12-fallback');

    await createNote(page, workspace.id, '***', 'corpo');

    await openNotes(page);

    await page.locator('.note-card').first().hover();
    await page.locator('.btn-download-note').first().click();

    const download = page.waitForEvent('download');

    await page.locator('.note-export-option[data-format="md"]').click();

    const file = await download;

    expect(file.suggestedFilename()).toBe('nota.md');
  });
});
