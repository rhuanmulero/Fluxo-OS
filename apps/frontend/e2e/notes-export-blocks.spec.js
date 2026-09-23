import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';
import { bufferOf, pdfTextStrings, readZipEntry } from './support/exported-files.js';

const BODY =
  '<ul class="checklist"><li class="checked">leite</li><li>pao</li></ul>' +
  '<p>texto <mark class="hl-yellow">marcado</mark> e <code>npm i</code></p>' +
  '<div class="callout callout-warning">cuidado aqui</div>' +
  '<hr>' +
  '<p>fim</p>';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
    title: 'Nota com blocos',
    body: BODY,
  });

  await setNavigationPlacement(page, { dock: 'bottom' });
  await enterWorkspace(page);
  await gotoRoute(page, 'notes');
}

async function download(page, format) {
  await page.locator('.note-card', { hasText: 'Nota com blocos' }).hover();
  await page.locator('.btn-download-note').click();

  const started = page.waitForEvent('download');

  await page.locator(`.note-export-option[data-format="${format}"]`).click();

  return bufferOf(await started);
}

test.describe('Exportar nota com blocos alem do markdown', () => {
  test('o markdown representa checklist, marca-texto, destaque e divisoria', async ({ page }) => {
    await seed(page, 'export-blocos-md');

    const text = (await download(page, 'md')).toString('utf8');

    expect(text).toContain('- [x] leite');
    expect(text).toContain('- [ ] pao');
    expect(text).toContain('==marcado==');
    expect(text).toContain('`npm i`');
    expect(text).toContain('> **Aviso:** cuidado aqui');
    expect(text).toContain('---');
    expect(text).not.toContain('<');
  });

  test('o docx traz os itens da checklist com o estado e o destaque rotulado', async ({ page }) => {
    await seed(page, 'export-blocos-docx');

    const documentXml = readZipEntry(await download(page, 'docx'), 'word/document.xml').toString('utf8');

    expect(documentXml).toContain('☑ leite');
    expect(documentXml).toContain('☐ pao');
    expect(documentXml).toContain('Aviso: ');
    expect(documentXml).toContain('cuidado aqui');
    expect(documentXml).toContain('<w:bottom');
  });

  test('o pdf traz os itens da checklist com o estado e o destaque rotulado', async ({ page }) => {
    await seed(page, 'export-blocos-pdf');

    const strings = pdfTextStrings(await download(page, 'pdf'));

    expect(strings).toContain('[x] leite');
    expect(strings).toContain('[ ] pao');
    expect(strings).toContain('Aviso: cuidado aqui');
  });
});
