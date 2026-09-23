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

test.describe('Nova Demanda vira Novo Projeto', () => {
  test('sem projeto, quem pode criar ve Novo Projeto e o modal abre pelo cabecalho', async ({
    page,
  }) => {
    await signUp(page, newAccount('j09-owner'));
    await createWorkspace(page, 'Workspace J09 Dono');
    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    const header = page.locator('.tasks-header .btn-create-task');
    await expect(header).toHaveText('Novo Projeto');
    await expect(header).toBeEnabled();

    await header.click();
    await expect(page.locator('#modal-new-project')).toHaveClass(/active/);

    await page.locator('#input-proj-name').fill('Projeto Nascido no Cabecalho');
    await page.locator('#btn-save-proj').click();

    await expect(page.locator('.tasks-header .btn-create-task')).toHaveText('Nova Demanda');
    await expect(page.locator('.tasks-header h1')).toHaveText('Projeto Nascido no Cabecalho');
  });

  test('o mais da barra lateral continua abrindo o mesmo modal', async ({ page }) => {
    await signUp(page, newAccount('j09-sidebar'));
    await createWorkspace(page, 'Workspace J09 Lateral');
    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('.tasks-sidebar #btn-open-proj-modal').click();
    await expect(page.locator('#modal-new-project')).toHaveClass(/active/);

    await page.locator('#btn-cancel-proj').click();
    await expect(page.locator('#modal-new-project')).not.toHaveClass(/active/);

    await page.locator('.tasks-header [data-action="new-project"]').click();
    await expect(page.locator('#modal-new-project')).toHaveClass(/active/);
  });

  test('um MEMBER sem projeto ve o botao desabilitado com o motivo no title', async ({
    page,
    browser,
  }) => {
    await signUp(page, newAccount('j09-boss'));
    const workspace = await createWorkspace(page, 'Workspace J09 Membro');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('j09-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await setNavigationPlacement(memberPage, { dock: 'bottom' });
    await enterWorkspace(memberPage);
    await gotoRoute(memberPage, 'tasks');

    const header = memberPage.locator('.tasks-header .btn-create-task');
    await expect(header).toHaveText('Nova Demanda');
    await expect(header).toBeDisabled();
    await expect(header).toHaveAttribute(
      'title',
      'Peça a um administrador para criar um projeto.',
    );
    await expect(memberPage.locator('.tasks-sidebar #btn-open-proj-modal')).toHaveCount(0);

    await memberContext.close();
  });
});
