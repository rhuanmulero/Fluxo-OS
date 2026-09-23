import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

const GOVERNANCE_LABELS = {
  MICROMANAGEMENT: 'Micromanagement',
  HIERARCHICAL: 'Hierárquico',
};

async function apiRequest(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();

      return {
        status: response.status,
        body: text === '' ? null : JSON.parse(text),
      };
    },
    { method, path, body },
  );
}

async function apiOk(page, method, path, body) {
  const result = await apiRequest(page, method, path, body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${method} ${path} falhou: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return result.body;
}

async function createWorkspace(page, name) {
  const workspace = await apiOk(page, 'POST', '/workspaces', { name });
  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspace.id);
  return workspace;
}

async function createProject(page, workspaceId, name) {
  return apiOk(page, 'POST', `/workspaces/${workspaceId}/projects`, { name });
}

async function enterWorkspace(page) {
  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

async function inviteMember(page, workspaceId, role) {
  const invite = await apiOk(page, 'POST', `/workspaces/${workspaceId}/invites`, { role });
  return invite.code;
}

async function joinWorkspaceAsMember(memberPage, account, code, workspaceId) {
  await signUp(memberPage, account);
  await apiOk(memberPage, 'POST', `/invites/${encodeURIComponent(code)}/accept`, {});
  await memberPage.evaluate(
    (id) => sessionStorage.setItem('fluxo_active_workspace', id),
    workspaceId,
  );
}

function gear(page) {
  return page.locator('.floating-nav [data-label="Configurações"]');
}

async function openGovernanceSection(page) {
  await gear(page).click();
  await page.locator('[data-section="governance"]').click();
  await expect(page.locator('#governance-list')).not.toHaveText('Carregando...');
}

async function firstColumnId(page, projectId) {
  const columns = await apiOk(page, 'GET', `/projects/${projectId}/columns`);
  return columns[0].id;
}

async function createTask(page, projectId, kanbanColumnId, title) {
  return apiOk(page, 'POST', `/projects/${projectId}/tasks`, {
    kanbanColumnId,
    title,
    priority: 'MEDIUM',
    type: 'FEATURE',
  });
}

test.describe('Secao Regras dos modulos do painel de Configuracoes', () => {
  test('modulos fixos aparecem so leitura e nao tem controle na interface para altera-los', async ({
    page,
  }) => {
    const owner = newAccount('c7-fixed-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C7 Fixos');
    const project = await createProject(page, workspace.id, 'Projeto C7 Fixos');
    await enterWorkspace(page);

    const settings = await apiOk(page, 'GET', `/projects/${project.id}/module-settings`);
    const configurableCount = settings.filter((setting) => setting.configurable).length;
    const fixedCount = settings.filter((setting) => !setting.configurable).length;

    expect(configurableCount).toBeGreaterThan(0);
    expect(fixedCount).toBeGreaterThan(0);

    await openGovernanceSection(page);

    await expect(page.locator('.governance-row')).toHaveCount(settings.length);
    await expect(page.locator('.governance-select')).toHaveCount(configurableCount);
    await expect(page.locator('.governance-fixed')).toHaveCount(fixedCount);
    await expect(page.locator('.governance-row[data-module]')).toHaveCount(configurableCount);

    const fixedLabels = await page.locator('.governance-fixed').allTextContents();
    for (const label of fixedLabels) {
      expect(label).toContain('(fixo)');
    }

    for (const setting of settings) {
      const row = page.locator(`.governance-row[data-module="${setting.module}"]`);

      if (setting.configurable) {
        await expect(row.locator('.governance-select .dropdown-trigger')).toHaveText(
          GOVERNANCE_LABELS[setting.governance],
        );
      } else {
        await expect(row).toHaveCount(0);
      }
    }
  });

  test('trocar o paradigma de TASKS muda de verdade o que um MEMBER pode fazer, e voltar libera de novo', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c7-toggle-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C7 Alternancia');
    const project = await createProject(page, workspace.id, 'Projeto C7 Alternancia');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c7-toggle-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = (await apiOk(memberPage, 'GET', '/me')).id;

    await apiOk(page, 'POST', `/projects/${project.id}/members`, { userId: memberId });

    const columnId = await firstColumnId(page, project.id);

    const taskUnderMicromanagement = await createTask(
      memberPage,
      project.id,
      columnId,
      'Tarefa sob micromanagement',
    );

    const deleteUnderMicromanagement = await apiRequest(
      memberPage,
      'DELETE',
      `/projects/${project.id}/tasks/${taskUnderMicromanagement.id}`,
    );
    expect(deleteUnderMicromanagement.status).toBe(204);

    await enterWorkspace(page);
    await openGovernanceSection(page);

    const tasksRow = page.locator('.governance-row[data-module="TASKS"]');
    const tasksSelect = tasksRow.locator('.governance-select');
    await expect(tasksSelect.locator('.dropdown-trigger')).toHaveText('Micromanagement');

    const patchPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/projects/${project.id}/module-settings/TASKS`) &&
        request.method() === 'PATCH',
    );

    await tasksSelect.locator('.dropdown-trigger').click();
    await tasksSelect.locator('.dropdown-option[data-value="HIERARCHICAL"]').click();

    const patchRequest = await patchPromise;
    expect(JSON.parse(patchRequest.postData())).toEqual({ governance: 'HIERARCHICAL' });
    await expect(page.locator('#governance-error')).toHaveText('');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await openGovernanceSection(page);
    await expect(
      page.locator('.governance-row[data-module="TASKS"] .governance-select .dropdown-trigger'),
    ).toHaveText('Hierárquico');

    const taskUnderHierarchical = await createTask(
      page,
      project.id,
      columnId,
      'Tarefa sob hierarquico',
    );

    const deleteDeniedByMember = await apiRequest(
      memberPage,
      'DELETE',
      `/projects/${project.id}/tasks/${taskUnderHierarchical.id}`,
    );
    expect(deleteDeniedByMember.status).toBe(403);
    expect(deleteDeniedByMember.body.message).toBe(
      'A regra de negócio deste módulo não permite esta ação.',
    );

    await page
      .locator('.governance-row[data-module="TASKS"] .governance-select .dropdown-trigger')
      .click();
    await page
      .locator(
        '.governance-row[data-module="TASKS"] .governance-select .dropdown-option[data-value="MICROMANAGEMENT"]',
      )
      .click();
    await expect(page.locator('#governance-error')).toHaveText('');

    const deleteAllowedAgain = await apiRequest(
      memberPage,
      'DELETE',
      `/projects/${project.id}/tasks/${taskUnderHierarchical.id}`,
    );
    expect(deleteAllowedAgain.status).toBe(204);

    await memberContext.close();
  });

  test('trocar de projeto na Guilda de configuracoes mostra o nome e as regras do projeto certo', async ({
    page,
  }) => {
    const owner = newAccount('c7-switch-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C7 Troca');
    const projectA = await createProject(page, workspace.id, 'Projeto C7 A');
    const projectB = await createProject(page, workspace.id, 'Projeto C7 B');

    await apiOk(page, 'PATCH', `/projects/${projectB.id}/module-settings/TASKS`, {
      governance: 'HIERARCHICAL',
    });

    await enterWorkspace(page);
    await openGovernanceSection(page);
    await expect(page.locator('h3').first()).toContainText(projectA.name);
    await expect(
      page.locator('.governance-row[data-module="TASKS"] .governance-select .dropdown-trigger'),
    ).toHaveText('Micromanagement');

    await page.evaluate(
      (id) => sessionStorage.setItem('fluxo_active_project', id),
      projectB.id,
    );
    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await openGovernanceSection(page);

    await expect(page.locator('h3').first()).toContainText(projectB.name);
    await expect(
      page.locator('.governance-row[data-module="TASKS"] .governance-select .dropdown-trigger'),
    ).toHaveText('Hierárquico');
  });
});
