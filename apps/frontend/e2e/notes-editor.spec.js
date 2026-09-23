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
  await gotoRoute(page, 'notes');
  await page.locator('#btn-new-note').click();
  await expect(page.locator('#note-drawer')).toHaveClass(/active/);
}

test.describe('Editor das Anotacoes', () => {
  test('a barra oferece os comandos novos', async ({ page }) => {
    await seed(page, 'k19-barra');
    await enterWorkspace(page);
    await openEditor(page);

    for (const command of ['h2', 'h3', 'bold', 'italic', 'strike', 'ul', 'ol', 'quote', 'code', 'link', 'clear']) {
      await expect(page.locator(`.rt-btn[data-command="${command}"]`)).toBeVisible();
    }
  });

  test('negrito por atalho envolve a selecao', async ({ page }) => {
    await seed(page, 'k19-atalho');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.keyboard.type('destaque');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');

    await expect(editor.locator('strong')).toHaveText('destaque');
  });

  test('lista numerada vira ol', async ({ page }) => {
    await seed(page, 'k19-lista');
    await enterWorkspace(page);
    await openEditor(page);

    await page.locator('.rt-editor').click();
    await page.keyboard.type('primeiro');
    await page.locator('.rt-btn[data-command="ol"]').click();

    await expect(page.locator('.rt-editor ol li')).toHaveText(['primeiro']);
  });

  test('colar traz texto puro, sem estilo de fora', async ({ page }) => {
    await seed(page, 'k19-colar');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await editor.evaluate((element) => {
      const data = new DataTransfer();

      data.setData('text/html', '<p style="color:red"><b>colado</b></p>');
      data.setData('text/plain', 'colado');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });

    await expect(editor).toContainText('colado');
    await expect(editor.locator('[style]')).toHaveCount(0);
  });

  test('o contador de palavras acompanha o texto', async ({ page }) => {
    await seed(page, 'k19-contador');
    await enterWorkspace(page);
    await openEditor(page);

    await page.locator('.rt-editor').click();
    await page.keyboard.type('uma duas tres');

    await expect(page.locator('.rt-words')).toContainText('3');
  });

  test('a nota salva e reabre com a formatacao', async ({ page }) => {
    await seed(page, 'k19-salvar');
    await enterWorkspace(page);
    await openEditor(page);

    await page.locator('#note-title').fill('Nota formatada');
    await page.locator('.rt-editor').click();
    await page.keyboard.type('conteudo');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');
    await page.locator('#btn-save-drawer').click();

    await page.locator('.note-card', { hasText: 'Nota formatada' }).click();

    await expect(page.locator('.rt-editor strong')).toHaveText('conteudo');
  });

  test('nota com dois paragrafos salva e reabre com os blocos preservados', async ({ page }) => {
    await seed(page, 'k19-multi-paragrafo');
    await enterWorkspace(page);
    await openEditor(page);

    await page.locator('#note-title').fill('Nota multi-paragrafo');
    await page.locator('.rt-editor').click();
    await page.keyboard.type('linha um');
    await page.keyboard.press('Enter');
    await page.keyboard.type('linha dois');
    await page.locator('#btn-save-drawer').click();

    await page.locator('.note-card', { hasText: 'Nota multi-paragrafo' }).click();

    const editor = page.locator('.rt-editor');

    // O Chromium so envolve em <div> o conteudo depois do Enter — a primeira
    // linha fica solta no proprio contentEditable. O que prova que a quebra
    // de paragrafo sobreviveu ao sanitizador (e nao virou "linha umlinha
    // dois" grudado) e a presenca desse <div> isolando a segunda linha.
    await expect(editor.locator('div')).toHaveCount(1);
    await expect(editor.locator('div')).toHaveText('linha dois');
    await expect(editor).toContainText('linha um');
  });

  test('lista em selecao de dois paragrafos vira uma lista so, com um item por paragrafo', async ({ page }) => {
    await seed(page, 'k19-multi-lista');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.keyboard.type('Primeiro paragrafo');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Segundo paragrafo');
    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="ul"]').click();

    await expect(page.locator('.rt-editor ol, .rt-editor ul')).toHaveCount(1);
    await expect(page.locator('.rt-editor ol li, .rt-editor ul li')).toHaveText([
      'Primeiro paragrafo',
      'Segundo paragrafo',
    ]);
  });

  test('titulo em selecao de dois paragrafos converte os dois blocos', async ({ page }) => {
    await seed(page, 'k19-multi-titulo');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.keyboard.type('Bloco Um');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bloco Dois');
    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="h2"]').click();

    await expect(editor.locator('h2')).toHaveCount(2);
    await expect(editor.locator('h2')).toHaveText(['Bloco Um', 'Bloco Dois']);
  });

  test('aplicar a mesma lista de novo, sem reselecionar, desfaz o lote inteiro', async ({ page }) => {
    await seed(page, 'k19-multi-lista-toggle');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.keyboard.type('Linha A');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Linha B');
    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="ul"]').click();

    await expect(editor.locator('ul')).toHaveCount(1);

    await page.locator('.rt-btn[data-command="ul"]').click();

    await expect(editor.locator('ul')).toHaveCount(0);
    await expect(editor).toContainText('Linha A');
    await expect(editor).toContainText('Linha B');
  });

  test('selecao com lista existente + paragrafo comum vira uma lista so, sem li aninhado', async ({ page }) => {
    await seed(page, 'k19-multi-lista-mista');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.keyboard.type('item um');
    await page.locator('.rt-btn[data-command="ul"]').click();

    // Sair da lista precisa de Enter num item vazio (comportamento padrao
    // do navegador para contenteditable): o primeiro Enter cria um novo
    // <li> vazio, o segundo o transforma num <div> comum fora da lista.
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('paragrafo comum');

    await page.keyboard.press('Control+A');
    await page.locator('.rt-btn[data-command="ul"]').click();

    await expect(editor.locator('ul, ol')).toHaveCount(1);
    await expect(page.locator('.rt-editor li ul, .rt-editor li ol')).toHaveCount(0);
    await expect(editor.locator('li')).toHaveText(['item um', 'paragrafo comum']);
  });

  test('negrito com caret vazio: digitar em seguida sai em negrito', async ({ page }) => {
    await seed(page, 'k19-negrito-vazio');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.locator('.rt-btn[data-command="bold"]').click();
    await page.keyboard.type('sticky');

    await expect(editor.locator('strong')).toHaveText('sticky');
  });

  test('negrito duas vezes sem digitar nao deixa strong vazio', async ({ page }) => {
    await seed(page, 'k19-negrito-desfaz');
    await enterWorkspace(page);
    await openEditor(page);

    const editor = page.locator('.rt-editor');

    await editor.click();
    await page.locator('.rt-btn[data-command="bold"]').click();
    await page.locator('.rt-btn[data-command="bold"]').click();
    await page.keyboard.type('plano');

    await expect(page.locator('.rt-editor strong')).toHaveCount(0);
    await expect(editor).toHaveText('plano');
  });
});
