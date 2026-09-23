import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function gotoSnippets(page) {
  await page.evaluate(() => {
    localStorage.setItem('fluxo.nav.edge', 'bottom');
    localStorage.removeItem('fluxo.nav.left');
    localStorage.removeItem('fluxo.nav.top');
  });
  await page.reload();
  await expect(page.locator('#global-bg')).toBeAttached();

  await page.locator('[data-route="knowledge"]').click();
  await page.locator('.knowledge-tab[data-tab="snippets"]').click();
  await expect(page.locator('.snippets-grid')).toBeVisible();
}

async function seed(page, label, withProject = false) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  if (withProject) {
    const project = await createProject(page, workspace.id, `Projeto ${label}`);
    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
  }

  await setNavigationPlacement(page, { dock: 'bottom' });
  await enterWorkspace(page);

  return workspace;
}

function field(page, scope, name) {
  return page.locator(`${scope} [data-field="${name}"]`);
}

test.describe('Campo obrigatorio e erro sob o campo', () => {
  test('em Rotina, Titulo e Inicio sao marcados e o erro nasce sob cada campo', async ({ page }) => {
    await seed(page, 'j06-routine');
    await gotoRoute(page, 'routine');

    await page.locator('#btn-new-event').click();
    await expect(page.locator('#event-drawer')).toHaveClass(/active/);

    await expect(field(page, '#event-drawer', 'title').locator('label .field-required')).toHaveText(
      '*',
    );
    await expect(
      field(page, '#event-drawer', 'startDate').locator('label .field-required'),
    ).toHaveText('*');

    await page.locator('#btn-save-event').click();

    await expect(field(page, '#event-drawer', 'title').locator('.field-error')).toHaveText(
      'Informe o título do evento.',
    );
    await expect(field(page, '#event-drawer', 'startDate').locator('.field-error')).toHaveText(
      'Informe a data de início.',
    );
    await expect(page.locator('#event-title')).toBeFocused();
    await expect(page.locator('.page-feedback')).toBeHidden();

    await page.locator('#event-title').fill('Reuniao J06');
    await page.locator('#btn-save-event').click();

    await expect(field(page, '#event-drawer', 'title').locator('.field-error')).toHaveCount(0);
    await expect(field(page, '#event-drawer', 'startDate').locator('.field-error')).toHaveText(
      'Informe a data de início.',
    );
    await expect(page.locator('#event-start-date')).toBeFocused();
  });

  test('em Rotina, o habito sem nome mostra o erro sob o campo e nao envia nada', async ({
    page,
  }) => {
    await seed(page, 'j06-habit');
    await gotoRoute(page, 'routine');
    await page.locator('.routine-tab[data-tab="habits"]').click();

    const requests = [];
    await page.route('**/api/workspaces/*/habits', async (route) => {
      if (route.request().method() === 'POST') requests.push(route.request());
      await route.continue();
    });

    await page.locator('#btn-new-habit').click();

    await expect(field(page, '.routine-toolbar', 'name').locator('.field-error')).toHaveText(
      'Informe o nome do hábito.',
    );
    expect(requests).toHaveLength(0);
  });

  test('em Tarefas, a demanda sem titulo mostra o erro sob o campo, nao num modal', async ({
    page,
  }) => {
    await seed(page, 'j06-task', true);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-new-task').click();
    await expect(page.locator('#task-drawer')).toHaveClass(/active/);

    await expect(field(page, '#task-drawer', 'title').locator('label .field-required')).toHaveText(
      '*',
    );

    await page.locator('#btn-save-drawer').click();

    await expect(field(page, '#task-drawer', 'title').locator('.field-error')).toHaveText(
      'Informe o título da demanda.',
    );
    await expect(page.locator('#modal-generic')).not.toHaveClass(/active/);
    await expect(page.locator('.page-feedback')).toBeHidden();
    await expect(page.locator('#task-title')).toBeFocused();
  });

  test('em Tarefas, o projeto sem nome mostra o erro sob o campo', async ({ page }) => {
    await seed(page, 'j06-project');
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-open-proj-modal').first().click();
    await expect(page.locator('#modal-new-project')).toHaveClass(/active/);

    await page.locator('#btn-save-proj').click();

    await expect(field(page, '#modal-new-project', 'name').locator('.field-error')).toHaveText(
      'Informe o nome do projeto.',
    );
    await expect(page.locator('#modal-generic')).not.toHaveClass(/active/);
  });

  test('no Kanban, coluna e demanda sem nome mostram o erro sob o campo', async ({ page }) => {
    await seed(page, 'j06-kanban', true);
    await gotoRoute(page, 'kanban');

    await page.locator('#btn-add-col-modal').click();
    await expect(page.locator('#modal-new-column')).toHaveClass(/active/);
    await page.locator('#btn-save-col').click();

    await expect(field(page, '#modal-new-column', 'name').locator('.field-error')).toHaveText(
      'Informe o nome da coluna.',
    );

    await page.locator('#btn-cancel-col').click();
    await page.locator('#btn-new-task').click();
    await page.locator('#btn-save-drawer').click();

    await expect(field(page, '#task-drawer', 'title').locator('.field-error')).toHaveText(
      'Informe o título da demanda.',
    );
  });

  test('em Notas, a nota sem titulo mostra o erro sob o campo e nao na barra do topo', async ({
    page,
  }) => {
    await seed(page, 'j06-note');
    await gotoRoute(page, 'notes');

    await page.locator('#btn-new-note').click();
    await page.locator('#btn-save-drawer').click();

    await expect(field(page, '#note-drawer', 'title').locator('.field-error')).toHaveText(
      'Informe o título da nota.',
    );
    await expect(page.locator('.page-feedback')).toBeHidden();
  });

  test('em Snippets, os tres campos obrigatorios mostram erro e o primeiro recebe foco', async ({
    page,
  }) => {
    await seed(page, 'j06-snippet');
    await gotoSnippets(page);

    await page.locator('#btn-new-snippet').click();
    await page.locator('#btn-save-drawer').click();

    await expect(field(page, '#snippet-drawer', 'name').locator('.field-error')).toHaveText(
      'Informe o nome do snippet.',
    );
    await expect(field(page, '#snippet-drawer', 'folder').locator('.field-error')).toHaveText(
      'Informe a pasta do snippet.',
    );
    await expect(field(page, '#snippet-drawer', 'code').locator('.field-error')).toHaveText(
      'Cole o código-fonte do snippet.',
    );
    await expect(page.locator('#snippet-title')).toBeFocused();
    await expect(page.locator('.page-feedback')).toBeHidden();
  });

  test('reabrir o formulario limpa os erros da tentativa anterior', async ({ page }) => {
    await seed(page, 'j06-reopen');
    await gotoRoute(page, 'notes');

    await page.locator('#btn-new-note').click();
    await page.locator('#btn-save-drawer').click();
    await expect(field(page, '#note-drawer', 'title').locator('.field-error')).toBeVisible();

    await page.locator('#btn-cancel-drawer').click();
    await page.locator('#btn-new-note').click();

    await expect(field(page, '#note-drawer', 'title').locator('.field-error')).toHaveCount(0);
  });

  test('o dialogo de formulario valida, devolve os valores e cancela com Esc', async ({ page }) => {
    await seed(page, 'j06-dialog');

    await page.evaluate(async () => {
      const { formDialog } = await import('/src/components/form-dialog.js');

      window.__dialog = formDialog.ask({
        title: 'Novo item',
        confirmLabel: 'Criar',
        fields: [
          { name: 'title', label: 'Título', required: true, message: 'Informe o título.' },
          { name: 'note', label: 'Observação' },
        ],
      });
    });

    const dialog = page.locator('.confirm-overlay .confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-field="title"] label .field-required')).toHaveText('*');
    await expect(dialog.locator('[data-field="note"] label .field-required')).toHaveCount(0);

    await dialog.locator('[data-answer="yes"]').click();
    await expect(dialog.locator('[data-field="title"] .field-error')).toHaveText(
      'Informe o título.',
    );
    await expect(dialog).toBeVisible();

    await dialog.locator('[data-field="title"] input').fill('Item J06');
    await dialog.locator('[data-field="note"] input').fill('Uma nota');
    await dialog.locator('[data-answer="yes"]').click();

    expect(await page.evaluate(() => window.__dialog)).toEqual({
      title: 'Item J06',
      note: 'Uma nota',
    });
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);

    await page.evaluate(async () => {
      const { formDialog } = await import('/src/components/form-dialog.js');

      window.__cancelled = formDialog.ask({
        title: 'Outro item',
        fields: [{ name: 'title', label: 'Título' }],
      });
    });

    await expect(page.locator('.confirm-overlay')).toBeVisible();
    await page.keyboard.press('Escape');

    expect(await page.evaluate(() => window.__cancelled)).toBeNull();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);
  });
});
