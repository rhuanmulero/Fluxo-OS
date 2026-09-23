import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  inviteMember,
  joinWorkspaceAsMember,
} from './support/shell.js';

async function countNativeSelects(page) {
  return page.evaluate(() => document.querySelectorAll('select').length);
}

async function openSettings(page, sectionId) {
  await page.keyboard.press('Alt+Comma');
  await expect(page.locator('.settings-overlay')).toHaveClass(/active/);
  await page.locator(`.settings-rail-item[data-section="${sectionId}"]`).click();
}

test.describe('Migracao dos selects nativos', () => {
  test('nenhuma pagina renderiza select nativo e cada posicao virou um Dropdown', async ({
    page,
  }) => {
    const account = newAccount('j05-mounts');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace J05 Montagens');
    const project = await createProject(page, workspace.id, 'Projeto J05');

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await enterWorkspace(page);

    const pages = [
      {
        route: 'tasks',
        container: '.tasks-container',
        mounts: [
          '#task-column',
          '#task-type',
          '#task-assignee',
          '#task-priority',
          '#project-member-pick',
        ],
      },
      {
        route: 'kanban',
        container: '.kanban-wrapper',
        mounts: ['#input-col-status', '#task-assignee', '#task-priority', '#task-column-select'],
      },
      { route: 'notes', container: '.notes-container', mounts: ['#note-project-select'] },

      {
        route: 'knowledge',
        container: '.knowledge-panel-root',
        mounts: ['#document-folder', '#document-scope'],
      },
      { route: 'routine', container: '.routine-container', mounts: ['#event-project'] },
      {
        route: 'pomodoro',
        container: '.pomodoro-wrapper',
        mounts: ['#task-select', '#spotify-select'],
      },
    ];

    for (const scenario of pages) {
      await gotoRoute(page, scenario.route);

      const scope = page.locator(scenario.container);

      for (const mount of scenario.mounts) {
        await expect(scope.locator(`${mount} > .dropdown > .dropdown-trigger`)).toHaveCount(1);
      }

      expect(await countNativeSelects(page)).toBe(0);
    }
  });

  test('escolher com o mouse e com o teclado muda o valor do campo de prioridade', async ({
    page,
  }) => {
    const account = newAccount('j05-keyboard');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace J05 Teclado');
    const project = await createProject(page, workspace.id, 'Projeto J05 Teclado');

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-new-task').click();
    await expect(page.locator('#task-drawer')).toHaveClass(/active/);

    const trigger = page.locator('#task-priority .dropdown-trigger');
    await expect(trigger).toHaveText('Normal');

    await trigger.click();
    await page.locator('#task-priority .dropdown-option[data-value="HIGH"]').click();
    await expect(trigger).toHaveText('Alta Prioridade');

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveText('Baixa Prioridade');
  });

  test('a coluna fica desabilitada ao editar uma demanda existente e liberada ao criar', async ({
    page,
  }) => {
    const account = newAccount('j05-disabled');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace J05 Coluna');
    const project = await createProject(page, workspace.id, 'Projeto J05 Coluna');
    const columns = await apiRequest(page, 'GET', `/projects/${project.id}/columns`);

    await apiRequest(page, 'POST', `/projects/${project.id}/tasks`, {
      title: 'Demanda J05',
      kanbanColumnId: columns[0].id,
      priority: 'MEDIUM',
      type: 'FEATURE',
    });

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('.btn-open-drawer').first().click();
    await expect(page.locator('#task-column .dropdown-trigger')).toBeDisabled();
    await expect(page.locator('#task-column .dropdown')).toHaveClass(/is-disabled/);

    await page.locator('#btn-cancel-drawer').click();
    await page.locator('#btn-new-task').click();
    await expect(page.locator('#task-column .dropdown-trigger')).toBeEnabled();
  });

  test('trocar o status de uma etapa em Metas ocupa o gatilho e recarrega a lista', async ({
    page,
  }) => {
    const account = newAccount('j05-stage');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace J05 Etapa');
    const project = await createProject(page, workspace.id, 'Projeto J05 Etapa');

    const roadmap = await apiRequest(page, 'POST', `/projects/${project.id}/roadmaps`, {
      title: 'Roadmap J05',
    });
    await apiRequest(page, 'POST', `/projects/${project.id}/roadmaps/${roadmap.id}/stages`, {
      title: 'Etapa J05',
      points: 5,
    });

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await enterWorkspace(page);
    await gotoRoute(page, 'roadmap');

    const status = page.locator('.stage-status').first();
    await expect(status.locator('.dropdown-trigger')).toHaveText('Planejada');

    await page.route('**/api/projects/*/roadmaps/*/stages/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      await route.continue();
    });

    await status.locator('.dropdown-trigger').click();
    await status.locator('.dropdown-option[data-value="DONE"]').click();

    await expect(status.locator('.dropdown')).toHaveClass(/is-busy/);
    await expect(status.locator('.dropdown-trigger')).toBeDisabled();

    await expect(page.locator('.roadmap-progress strong')).toHaveText('100%');
  });

  test('trocar o papel de um membro ocupa o gatilho enquanto a chamada corre', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('j05-role-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace J05 Papel');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('j05-role-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    const memberId = (await apiRequest(memberPage, 'GET', '/me')).id;
    await memberContext.close();

    await enterWorkspace(page);
    await openSettings(page, 'members');

    const role = page.locator(`.member-row[data-user="${memberId}"] .member-role`);
    await expect(role.locator('.dropdown-trigger')).toHaveText('Membro');

    await page.route(`**/api/workspaces/${workspace.id}/members/${memberId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      await route.continue();
    });

    await role.locator('.dropdown-trigger').click();
    await role.locator('.dropdown-option[data-value="ADMIN"]').click();

    await expect(role.locator('.dropdown')).toHaveClass(/is-busy/);
    await expect(role.locator('.dropdown-trigger')).toBeDisabled();

    await expect(
      page.locator(`.member-row[data-user="${memberId}"] .member-role .dropdown-trigger`),
    ).toHaveText('Administrador');
  });

  test('trocar a governanca de um modulo ocupa o gatilho enquanto a chamada corre', async ({
    page,
  }) => {
    const account = newAccount('j05-governance');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace J05 Governanca');
    const project = await createProject(page, workspace.id, 'Projeto J05 Governanca');

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await enterWorkspace(page);
    await openSettings(page, 'governance');

    const governance = page.locator('.governance-row[data-module="TASKS"] .governance-select');
    await expect(governance.locator('.dropdown-trigger')).toHaveText('Micromanagement');

    await page.route(`**/api/projects/${project.id}/module-settings/TASKS`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      await route.continue();
    });

    await governance.locator('.dropdown-trigger').click();
    await governance.locator('.dropdown-option[data-value="HIERARCHICAL"]').click();

    await expect(governance.locator('.dropdown')).toHaveClass(/is-busy/);

    await expect(
      page.locator('.governance-row[data-module="TASKS"] .governance-select .dropdown-trigger'),
    ).toHaveText('Hierárquico');
  });

  test('o painel do dropdown segue o tema em qualquer pagina', async ({ page }) => {
    const account = newAccount('j05-theme');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace J05 Tema');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await page.locator('#btn-new-note').click();
    await page.locator('#note-project-select .dropdown-trigger').click();

    const panel = page.locator('#note-project-select .dropdown-panel');
    const dark = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.evaluate(() => document.body.classList.add('light-theme'));

    const light = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(light).not.toBe(dark);
    expect(light).toContain('245, 245, 245');
  });
});
