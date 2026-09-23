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
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

async function createNote(page, workspaceId, data) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/notes`, {
    body: '<p>corpo</p>',
    ...data,
  });
}

async function openNotes(page) {
  await enterWorkspace(page);
  await gotoRoute(page, 'notes');
}

function card(page, title) {
  return page.locator('.note-card', { hasText: title });
}

test.describe('Cor da nota', () => {
  test('a cor escolhida no editor aparece no cartao e reabre selecionada', async ({ page }) => {
    await seed(page, 'cor-escolher');
    await openNotes(page);

    await page.locator('#btn-new-note').click();
    await page.locator('#note-title').fill('Nota laranja');
    await page.locator('.rt-editor').click();
    await page.keyboard.type('corpo');
    await page.locator('#note-color-picker .color-option[data-color="#f59e0b"]').click();
    await page.locator('#btn-save-drawer').click();

    await expect(card(page, 'Nota laranja')).toHaveAttribute('style', /--note-color: ?#f59e0b/);

    await card(page, 'Nota laranja').click();

    await expect(page.locator('#note-color-picker .color-option.selected')).toHaveAttribute(
      'data-color',
      '#f59e0b',
    );
  });

  test('escolher sem cor limpa a cor da nota', async ({ page }) => {
    const workspace = await seed(page, 'cor-limpar');

    await createNote(page, workspace.id, { title: 'Nota colorida', color: '#ef4444' });
    await openNotes(page);

    await expect(card(page, 'Nota colorida')).toHaveAttribute('style', /--note-color/);

    await card(page, 'Nota colorida').click();
    await page.locator('#note-color-picker .color-option[data-color=""]').click();
    await page.locator('#btn-save-drawer').click();

    await expect(card(page, 'Nota colorida')).toBeVisible();
    await expect(card(page, 'Nota colorida')).not.toHaveAttribute('style', /--note-color/);
  });
});

test.describe('Modo leitura e editor expandido', () => {
  test('nota publicada por outra pessoa abre em modo leitura com o autor', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const ownerAccount = newAccount('leitura-dono');

    await signUp(owner, ownerAccount);

    const workspace = await createWorkspace(owner, 'Workspace leitura');
    const project = await createProject(owner, workspace.id, 'Projeto leitura');
    const note = await createNote(owner, workspace.id, {
      title: 'Guia do projeto',
      body: '<h2>Passos</h2><ul class="checklist"><li class="checked">um</li></ul>',
      projectId: project.id,
    });

    await apiRequest(owner, 'PATCH', `/workspaces/${workspace.id}/notes/${note.id}/visibility`, {
      visibility: 'PROJECT',
    });

    const code = await inviteMember(owner, workspace.id);
    const memberContext = await browser.newContext();
    const member = await memberContext.newPage();

    await signUp(member, newAccount('leitura-membro'));
    await joinWorkspaceAsMember(member, code, workspace.id);

    const me = await apiRequest(member, 'GET', '/me');

    await apiRequest(owner, 'POST', `/projects/${project.id}/members`, { userId: me.id });
    await setNavigationPlacement(member, { dock: 'bottom' });
    await openNotes(member);
    await card(member, 'Guia do projeto').click();

    const drawer = member.locator('#note-drawer');

    await expect(drawer).toHaveClass(/active/);
    await expect(drawer).toHaveClass(/is-reading/);
    await expect(drawer.locator('.note-reader h2')).toHaveText('Passos');
    await expect(drawer.locator('.note-reader ul.checklist > li.checked')).toHaveText('um');
    await expect(drawer.locator('.note-reader-meta')).toContainText(ownerAccount.name);
    await expect(member.locator('#btn-save-drawer')).toBeHidden();

    await ownerContext.close();
    await memberContext.close();
  });

  test('o editor expande para a largura toda e volta', async ({ page }) => {
    await seed(page, 'expandir');
    await openNotes(page);
    await page.locator('#btn-new-note').click();

    const drawer = page.locator('#note-drawer');
    const narrow = (await drawer.boundingBox()).width;

    await page.locator('#btn-expand-drawer').click();

    await expect(drawer).toHaveClass(/is-expanded/);
    expect((await drawer.boundingBox()).width).toBeGreaterThan(narrow);

    await page.locator('#btn-expand-drawer').click();

    await expect(drawer).not.toHaveClass(/is-expanded/);
  });
});

test.describe('Ordenacao, visualizacao e duplicar', () => {
  test('ordenar por titulo poe as notas em ordem alfabetica', async ({ page }) => {
    const workspace = await seed(page, 'ordenar-titulo');

    await createNote(page, workspace.id, { title: 'Zebra' });
    await createNote(page, workspace.id, { title: 'Abacate' });
    await createNote(page, workspace.id, { title: 'Manga' });
    await openNotes(page);

    await expect(page.locator('.note-title')).toHaveText(['Manga', 'Abacate', 'Zebra']);

    await page.locator('.sort-btn[data-sort="title"]').click();

    await expect(page.locator('.note-title')).toHaveText(['Abacate', 'Manga', 'Zebra']);
  });

  test('fixadas continuam primeiro ao ordenar por titulo', async ({ page }) => {
    const workspace = await seed(page, 'ordenar-fixadas');

    await createNote(page, workspace.id, { title: 'Zebra', isPinned: true });
    await createNote(page, workspace.id, { title: 'Abacate' });
    await openNotes(page);
    await page.locator('.sort-btn[data-sort="title"]').click();

    await expect(page.locator('.note-title')).toHaveText(['Zebra', 'Abacate']);
  });

  test('a visualizacao em lista persiste ao voltar para a pagina', async ({ page }) => {
    const workspace = await seed(page, 'lista-persistente');

    await createNote(page, workspace.id, { title: 'Qualquer' });
    await openNotes(page);
    await page.locator('.view-btn[data-view="list"]').click();

    await expect(page.locator('.notes-grid-scroll')).toHaveClass(/is-list/);

    await openNotes(page);

    await expect(page.locator('.notes-grid-scroll')).toHaveClass(/is-list/);
    await expect(page.locator('.view-btn[data-view="list"]')).toHaveClass(/active/);
  });

  test('duplicar cria uma copia da nota com o mesmo corpo', async ({ page }) => {
    const workspace = await seed(page, 'duplicar');

    await createNote(page, workspace.id, { title: 'Original', body: '<p>conteudo unico</p>', color: '#8b5cf6' });
    await openNotes(page);
    await card(page, 'Original').hover();
    await card(page, 'Original').locator('.btn-duplicate-note').click();

    await expect(card(page, 'Original (cópia)')).toBeVisible();
    await expect(card(page, 'Original (cópia)').locator('.note-content-preview')).toContainText('conteudo unico');
    await expect(card(page, 'Original (cópia)')).toHaveAttribute('style', /--note-color: ?#8b5cf6/);
    await expect(page.locator('.note-card')).toHaveCount(2);
  });
});
