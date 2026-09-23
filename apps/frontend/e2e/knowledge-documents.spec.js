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

async function openVault(page) {
  await enterWorkspace(page);
  await gotoRoute(page, 'knowledge');
  await expect(page.locator('#document-list')).toBeVisible();
}

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

async function fillUpload(page, { name, folder, content = 'conteudo', fileName = 'arquivo.pdf', mimeType = 'application/pdf' }) {
  await page.locator('#btn-new-document').click();
  await page.locator('#document-file').setInputFiles({
    name: fileName,
    mimeType,
    buffer: Buffer.from(content),
  });
  await page.locator('#document-name').fill(name);
  await page.locator('#document-folder .dropdown-trigger').click();

  const existing = page.locator(
    `#document-folder .dropdown-option[data-value="${folder}"]`,
  );

  if ((await existing.count()) > 0) {
    await existing.click();
    return;
  }

  await page.locator('#document-folder .dropdown-option.is-create').click();
  await page.keyboard.type(folder);
  await page.keyboard.press('Enter');
}

test.describe('Painel de Documentos', () => {
  test('sem documento, o painel mostra a tela vazia', async ({ page }) => {
    await seed(page, 'h10-empty');
    await openVault(page);

    await expect(page.locator('#document-list .empty-state h3')).toHaveText(
      'Nenhum documento por aqui',
    );
  });

  test('enviar um PDF cria o cartao sob a pasta escolhida, com tamanho legivel', async ({
    page,
  }) => {
    await seed(page, 'h10-upload');
    await openVault(page);

    await fillUpload(page, { name: 'Arquitetura', folder: 'Docs', content: 'x'.repeat(2048) });
    await page.locator('#btn-save-document').click();

    const group = page.locator('.knowledge-group', { hasText: 'Docs' });
    await expect(group.locator('.knowledge-card')).toHaveCount(1);
    await expect(group.locator('.knowledge-card strong')).toHaveText('Arquitetura');
    await expect(group.locator('.knowledge-card-meta')).toContainText('arquivo.pdf');
    await expect(group.locator('.knowledge-card-meta')).toContainText('2 KB');
    await expect(group.locator('.knowledge-scope')).toHaveText('Privado');
  });

  test('o botao de baixar aponta para a rota de download com o atributo download', async ({
    page,
  }) => {
    const workspace = await seed(page, 'h10-download');
    await openVault(page);

    await fillUpload(page, { name: 'Manual', folder: 'Docs' });
    await page.locator('#btn-save-document').click();

    const link = page.locator('.btn-download-document').first();
    await expect(link).toHaveAttribute('download', '');

    const href = await link.getAttribute('href');
    expect(href).toContain(`/api/workspaces/${workspace.id}/documents/`);
    expect(href?.endsWith('/download')).toBe(true);
  });

  test('tipo recusado mostra a mensagem do servidor na barra de feedback', async ({ page }) => {
    await seed(page, 'h10-type');
    await openVault(page);

    await fillUpload(page, {
      name: 'Binario',
      folder: 'Docs',
      fileName: 'virus.exe',
      mimeType: 'application/x-msdownload',
    });
    await page.locator('#btn-save-document').click();

    await expect(page.locator('.page-feedback')).toHaveText(
      'Tipo de arquivo não aceito no Vault.',
    );
  });

  test('os campos obrigatorios sao marcados e o erro nasce sob cada um', async ({ page }) => {
    await seed(page, 'h10-required');
    await openVault(page);

    await page.locator('#btn-new-document').click();

    for (const field of ['file', 'name', 'folder', 'scope']) {
      await expect(
        page.locator(`#document-drawer [data-field="${field}"] label .field-required`),
      ).toHaveText('*');
    }

    await page.locator('#btn-save-document').click();

    await expect(
      page.locator('#document-drawer [data-field="file"] .field-error'),
    ).toHaveText('Escolha o arquivo a enviar.');
    await expect(
      page.locator('#document-drawer [data-field="name"] .field-error'),
    ).toHaveText('Informe o nome do documento.');
    await expect(page.locator('.page-feedback')).toBeHidden();
  });

  test('MEMBER nao ve a opcao de escopo Workspace', async ({ page, browser }) => {
    await signUp(page, newAccount('h10-owner'));
    const workspace = await createWorkspace(page, 'Workspace H10 Escopo');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('h10-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await setNavigationPlacement(memberPage, { dock: 'bottom' });
    await setNavigationPlacement(page, { dock: 'bottom' });

    await openVault(memberPage);
    await memberPage.locator('#btn-new-document').click();
    await memberPage.locator('#document-scope .dropdown-trigger').click();

    await expect(
      memberPage.locator('#document-scope .dropdown-option'),
    ).toHaveText(['Privado', 'Projeto']);

    await openVault(page);
    await page.locator('#btn-new-document').click();
    await page.locator('#document-scope .dropdown-trigger').click();

    await expect(page.locator('#document-scope .dropdown-option')).toHaveText([
      'Privado',
      'Projeto',
      'Workspace',
    ]);

    await memberContext.close();
  });

  test('a busca filtra pelo nome e nao alcanca o privado de outra pessoa', async ({
    page,
    browser,
  }) => {
    await signUp(page, newAccount('h10-search-owner'));
    const workspace = await createWorkspace(page, 'Workspace H10 Busca');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('h10-search-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await setNavigationPlacement(memberPage, { dock: 'bottom' });
    await setNavigationPlacement(page, { dock: 'bottom' });

    await openVault(page);
    await fillUpload(page, { name: 'Segredo do dono', folder: 'Pessoal' });
    await page.locator('#btn-save-document').click();
    await expect(page.locator('.knowledge-card')).toHaveCount(1);

    await page.locator('.knowledge-search').fill('Segredo');
    await page.locator('.knowledge-search').press('Enter');
    await expect(page.locator('.knowledge-card')).toHaveCount(1);

    await page.locator('.knowledge-search').fill('Inexistente');
    await page.locator('.knowledge-search').press('Enter');
    await expect(page.locator('#document-list .empty-state')).toBeVisible();

    await openVault(memberPage);
    await memberPage.locator('.knowledge-search').fill('Segredo');
    await memberPage.locator('.knowledge-search').press('Enter');
    await expect(memberPage.locator('#document-list .empty-state')).toBeVisible();

    await memberContext.close();
  });

  test('excluir pede confirmacao, mostra o botao girando e some da lista', async ({ page }) => {
    await seed(page, 'h10-delete');
    await openVault(page);

    await fillUpload(page, { name: 'Para excluir', folder: 'Docs' });
    await page.locator('#btn-save-document').click();
    await expect(page.locator('.knowledge-card')).toHaveCount(1);

    await page.route('**/api/workspaces/*/documents/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      await route.continue();
    });

    await page.locator('.btn-delete-document').first().click();

    const dialog = page.locator('.confirm-overlay .confirm-dialog');
    await expect(dialog.locator('h3')).toHaveText('Excluir documento');

    await dialog.locator('[data-answer="no"]').click();
    await expect(page.locator('.knowledge-card')).toHaveCount(1);

    await page.locator('.btn-delete-document').first().click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(page.locator('.btn-delete-document').first()).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(page.locator('#document-list .empty-state')).toBeVisible({ timeout: 15_000 });
  });
});
