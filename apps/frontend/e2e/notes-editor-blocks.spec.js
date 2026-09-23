import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

async function openEditor(page) {
  await enterWorkspace(page);
  await gotoRoute(page, 'notes');
  await page.locator('#btn-new-note').click();
  await expect(page.locator('#note-drawer')).toHaveClass(/active/);

  return page.locator('.rt-editor');
}

test.describe('Editor de notas alem do markdown', () => {
  test('a barra oferece os comandos novos', async ({ page }) => {
    await seed(page, 'blocos-barra');
    await openEditor(page);

    for (const command of ['undo', 'redo', 'checklist', 'callout', 'hr', 'inline-code', 'highlight']) {
      await expect(page.locator(`.rt-btn[data-command="${command}"]`)).toBeVisible();
    }
  });

  test('checklist vira lista com caixinha e o clique na caixinha marca o item', async ({ page }) => {
    await seed(page, 'blocos-checklist');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('comprar pao');
    await page.locator('.rt-btn[data-command="checklist"]').click();

    const item = editor.locator('ul.checklist > li');

    await expect(item).toHaveText(['comprar pao']);
    await expect(item).not.toHaveClass(/checked/);

    await item.click({ position: { x: 8, y: 10 } });

    await expect(item).toHaveClass(/checked/);

    await item.click({ position: { x: 8, y: 10 } });

    await expect(item).not.toHaveClass(/checked/);
  });

  test('marca-texto envolve a selecao com a cor escolhida', async ({ page }) => {
    await seed(page, 'blocos-marca-texto');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('importante');
    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="highlight"]').click();
    await page.locator('.rt-choice[data-value="hl-green"]').click();

    await expect(editor.locator('mark.hl-green')).toHaveText('importante');
  });

  test('a mesma cor de marca-texto de novo remove a marca', async ({ page }) => {
    await seed(page, 'blocos-marca-texto-toggle');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('importante');
    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="highlight"]').click();
    await page.locator('.rt-choice[data-value="hl-yellow"]').click();

    await expect(editor.locator('mark')).toHaveCount(1);

    await page.locator('.rt-btn[data-command="highlight"]').click();
    await page.locator('.rt-choice[data-value="hl-yellow"]').click();

    await expect(editor.locator('mark')).toHaveCount(0);
    await expect(editor).toContainText('importante');
  });

  test('caixa de destaque converte o bloco atual', async ({ page }) => {
    await seed(page, 'blocos-callout');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('cuidado com isso');
    await page.locator('.rt-btn[data-command="callout"]').click();
    await page.locator('.rt-choice[data-value="callout-warning"]').click();

    await expect(editor.locator('div.callout.callout-warning')).toHaveText('cuidado com isso');
  });

  test('divisoria entra depois do bloco e o caret segue na linha seguinte', async ({ page }) => {
    await seed(page, 'blocos-divisoria');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('antes');
    await page.locator('.rt-btn[data-command="hr"]').click();
    await page.keyboard.type('depois');

    await expect(editor.locator('hr')).toHaveCount(1);
    await expect(editor.locator('hr + *')).toHaveText('depois');
  });

  test('codigo inline envolve a selecao em code', async ({ page }) => {
    await seed(page, 'blocos-codigo-inline');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('npm install');
    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="inline-code"]').click();

    await expect(editor.locator('code')).toHaveText('npm install');
    await expect(editor.locator('pre')).toHaveCount(0);
  });

  test('desfazer reverte o ultimo comando e refazer reaplica', async ({ page }) => {
    await seed(page, 'blocos-desfazer');
    const editor = await openEditor(page);

    await expect(page.locator('.rt-btn[data-command="undo"]')).toBeDisabled();

    await editor.click();
    await page.keyboard.type('texto');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');

    await expect(editor.locator('strong')).toHaveText('texto');

    await page.locator('.rt-btn[data-command="undo"]').click();

    await expect(editor.locator('strong')).toHaveCount(0);
    await expect(editor).toContainText('texto');

    await page.locator('.rt-btn[data-command="redo"]').click();

    await expect(editor.locator('strong')).toHaveText('texto');
  });

  test('Ctrl+Z desfaz o comando da barra', async ({ page }) => {
    await seed(page, 'blocos-ctrl-z');
    const editor = await openEditor(page);

    await editor.click();
    await page.keyboard.type('titulo');
    await page.locator('.rt-btn[data-command="h2"]').click();

    await expect(editor.locator('h2')).toHaveCount(1);

    await page.keyboard.press('Control+Z');

    await expect(editor.locator('h2')).toHaveCount(0);
    await expect(editor).toContainText('titulo');
  });

  test('nota com checklist marcada salva e reabre marcada', async ({ page }) => {
    await seed(page, 'blocos-salvar');
    const editor = await openEditor(page);

    await page.locator('#note-title').fill('Compras');
    await editor.click();
    await page.keyboard.type('leite');
    await page.locator('.rt-btn[data-command="checklist"]').click();
    await editor.locator('ul.checklist > li').click({ position: { x: 8, y: 10 } });
    await page.locator('#btn-save-drawer').click();

    await page.locator('.note-card', { hasText: 'Compras' }).click();

    await expect(page.locator('.rt-editor ul.checklist > li.checked')).toHaveText('leite');
  });
});
