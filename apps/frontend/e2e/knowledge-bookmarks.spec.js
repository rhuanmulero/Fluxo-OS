import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  inviteMember,
  joinWorkspaceAsMember,
  setNavigationPlacement,
} from './support/shell.js';

async function openLinks(page) {
  await enterWorkspace(page);
  await gotoRoute(page, 'knowledge');
  await page.locator('.knowledge-tab[data-tab="bookmarks"]').click();
  await expect(page.locator('#bookmark-list')).toBeVisible();
}

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

async function fillBookmark(page, { name, url, folder }) {
  await page.locator('#bookmark-name').fill(name);
  await page.locator('#bookmark-url').fill(url);
  await page.locator('#bookmark-folder .dropdown-trigger').click();

  const existing = page.locator(`#bookmark-folder .dropdown-option[data-value="${folder}"]`);

  if ((await existing.count()) > 0) {
    await existing.click();
    return;
  }

  await page.locator('#bookmark-folder .dropdown-option.is-create').click();
  await page.keyboard.type(folder);
  await page.keyboard.press('Enter');
}

test.describe('Painel de Links', () => {
  test('sem link, o painel mostra a tela vazia', async ({ page }) => {
    await seed(page, 'h11-empty');
    await openLinks(page);

    await expect(page.locator('#bookmark-list .empty-state h3')).toHaveText(
      'Nenhum link por aqui',
    );
  });

  test('criar, editar e excluir um link', async ({ page }) => {
    await seed(page, 'h11-crud');
    await openLinks(page);

    await page.locator('#btn-new-bookmark').click();
    await fillBookmark(page, {
      name: 'Documentação do Nest',
      url: 'https://docs.nestjs.com',
      folder: 'Backend',
    });
    await page.locator('#btn-save-bookmark').click();

    const card = page.locator('.knowledge-card', { hasText: 'Documentação do Nest' });
    await expect(card).toBeVisible();
    await expect(card.locator('.knowledge-card-meta')).toHaveText('docs.nestjs.com');
    await expect(card.locator('.knowledge-scope')).toHaveText('Privado');

    await card.locator('.btn-edit-bookmark').click();
    await expect(page.locator('#bookmark-drawer-title')).toHaveText('Editar link');
    await page.locator('#bookmark-name').fill('Nest oficial');
    await page.locator('#btn-save-bookmark').click();

    await expect(page.locator('.knowledge-card', { hasText: 'Nest oficial' })).toBeVisible();

    await page.locator('.btn-delete-bookmark').first().click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(page.locator('#bookmark-list .empty-state')).toBeVisible();
  });

  test('javascript: e barrado com erro sob o campo, antes de sair da tela', async ({ page }) => {
    await seed(page, 'h11-protocol');
    await openLinks(page);

    const requests = [];
    await page.route('**/api/workspaces/*/bookmarks', async (route) => {
      if (route.request().method() === 'POST') requests.push(route.request());
      await route.continue();
    });

    await page.locator('#btn-new-bookmark').click();
    await fillBookmark(page, {
      name: 'Ruim',
      url: 'javascript:alert(1)',
      folder: 'Links',
    });
    await page.locator('#btn-save-bookmark').click();

    await expect(page.locator('#bookmark-drawer [data-field="url"] .field-error')).toHaveText(
      'Informe um endereço que comece com http:// ou https://.',
    );
    expect(requests).toHaveLength(0);
  });

  test('o link abre em aba nova, com noopener e noreferrer', async ({ page }) => {
    await seed(page, 'h11-target');
    await openLinks(page);

    await page.locator('#btn-new-bookmark').click();
    await fillBookmark(page, {
      name: 'Fluxo',
      url: 'https://fluxo.exemplo/docs',
      folder: 'Links',
    });
    await page.locator('#btn-save-bookmark').click();

    const link = page.locator('.bookmark-link').first();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('href', 'https://fluxo.exemplo/docs');
  });

  test('a busca filtra por nome e por endereco', async ({ page }) => {
    await seed(page, 'h11-search');
    await openLinks(page);

    await page.locator('#btn-new-bookmark').click();
    await fillBookmark(page, {
      name: 'Referência A',
      url: 'https://alfa.exemplo',
      folder: 'Links',
    });
    await page.locator('#btn-save-bookmark').click();
    await expect(page.locator('.knowledge-card')).toHaveCount(1);

    await page.locator('#btn-new-bookmark').click();
    await fillBookmark(page, {
      name: 'Referência B',
      url: 'https://beta.exemplo',
      folder: 'Links',
    });
    await page.locator('#btn-save-bookmark').click();
    await expect(page.locator('.knowledge-card')).toHaveCount(2);

    const search = page.locator('.knowledge-search');

    await search.fill('beta');
    await search.press('Enter');
    await expect(page.locator('.knowledge-card')).toHaveCount(1);
    await expect(page.locator('.bookmark-link')).toHaveText('Referência B');

    await search.fill('Referência A');
    await search.press('Enter');
    await expect(page.locator('.bookmark-link')).toHaveText('Referência A');
  });

  test('MEMBER nao ve a opcao de escopo Workspace', async ({ page, browser }) => {
    await signUp(page, newAccount('h11-owner'));
    const workspace = await createWorkspace(page, 'Workspace H11 Escopo');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('h11-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await setNavigationPlacement(memberPage, { dock: 'bottom' });

    await openLinks(memberPage);
    await memberPage.locator('#btn-new-bookmark').click();
    await memberPage.locator('#bookmark-scope .dropdown-trigger').click();

    await expect(memberPage.locator('#bookmark-scope .dropdown-option')).toHaveText([
      'Privado',
      'Projeto',
    ]);

    await memberContext.close();
  });

  test('link de workspace criado pelo dono aparece para o membro', async ({ page, browser }) => {
    await signUp(page, newAccount('h11-shared-owner'));
    const workspace = await createWorkspace(page, 'Workspace H11 Compartilhado');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('h11-shared-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await setNavigationPlacement(memberPage, { dock: 'bottom' });
    await setNavigationPlacement(page, { dock: 'bottom' });

    await openLinks(page);
    await page.locator('#btn-new-bookmark').click();
    await fillBookmark(page, {
      name: 'Manual da Guilda',
      url: 'https://fluxo.exemplo/manual',
      folder: 'Institucional',
    });
    await page.locator('#bookmark-scope .dropdown-trigger').click();
    await page.locator('#bookmark-scope .dropdown-option[data-value="WORKSPACE"]').click();
    await page.locator('#btn-save-bookmark').click();

    await expect(page.locator('.knowledge-scope')).toHaveText('Workspace');

    await openLinks(memberPage);

    await expect(memberPage.locator('.bookmark-link')).toHaveText('Manual da Guilda');
    await expect(memberPage.locator('.btn-edit-bookmark')).toHaveCount(0);

    await memberContext.close();
  });
});
