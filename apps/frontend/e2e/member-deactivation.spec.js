import { expect, test } from '@playwright/test';
import { newAccount, signIn, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  inviteMember,
  joinWorkspaceAsMember,
  setNavigationPlacement,
} from './support/shell.js';

test.describe('Desligar funcionario', () => {
  test('desligar tira o acesso e mantem o nome na lista', async ({ page }) => {
    const owner = newAccount('k10-dono');
    await signUp(page, owner);

    const workspace = await createWorkspace(page, 'Workspace k10');
    const code = await inviteMember(page, workspace.id);

    const employee = newAccount('k10-func');
    await signUp(page, employee);
    await joinWorkspaceAsMember(page, code, workspace.id);

    await signIn(page, owner);
    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspace.id);
    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);

    await page.locator('[data-label="Configurações"]').click();
    await page.locator('.settings-rail-item[data-section="members"]').click();

    const row = page.locator('.member-row', { hasText: employee.name });

    await expect(row).toBeVisible();
    await row.locator('.member-deactivate').click();
    await page.locator('.confirm-dialog [data-answer="yes"]').click();

    await expect(row).toHaveClass(/is-inactive/);
    await expect(row).toContainText('Desligado');
    await expect(row.locator('.member-reactivate')).toBeVisible();

    await signIn(page, employee);

    const workspaces = await apiRequest(page, 'GET', '/workspaces');

    expect(workspaces.map((item) => item.id)).not.toContain(workspace.id);
  });

  test('reativar devolve o acesso', async ({ page }) => {
    const owner = newAccount('k10-dono2');
    await signUp(page, owner);

    const workspace = await createWorkspace(page, 'Workspace k10b');
    const code = await inviteMember(page, workspace.id);

    const employee = newAccount('k10-func2');
    await signUp(page, employee);
    await joinWorkspaceAsMember(page, code, workspace.id);
    const employeeId = (await apiRequest(page, 'GET', '/me')).id;

    await signIn(page, owner);
    await apiRequest(page, 'PATCH', `/workspaces/${workspace.id}/members/${employeeId}/status`, {
      active: false,
    });
    await apiRequest(page, 'PATCH', `/workspaces/${workspace.id}/members/${employeeId}/status`, {
      active: true,
    });

    await signIn(page, employee);

    const workspaces = await apiRequest(page, 'GET', '/workspaces');

    expect(workspaces.map((item) => item.id)).toContain(workspace.id);
  });
});
