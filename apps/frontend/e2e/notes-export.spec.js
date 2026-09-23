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

function numFormatFor(numberingXml, numId) {
  const numMatch = numberingXml.match(
    new RegExp(`<w:num w:numId="${numId}"><w:abstractNumId w:val="(\\d+)"`),
  );

  if (!numMatch) throw new Error(`numId ${numId} não encontrado em numbering.xml`);

  const abstractMatch = numberingXml.match(
    new RegExp(`<w:abstractNum w:abstractNumId="${numMatch[1]}"[\\s\\S]*?<w:numFmt w:val="([a-zA-Z]+)"`),
  );

  if (!abstractMatch) throw new Error(`abstractNum ${numMatch[1]} não encontrado em numbering.xml`);

  return abstractMatch[1];
}

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
    title: 'Nota exportável',
    body: '<h2>Seção</h2><p>Texto com <strong>negrito</strong>.</p><ul><li>um</li><li>dois</li></ul>',
  });

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

async function download(page, format) {
  await page.locator('.note-card', { hasText: 'Nota exportável' }).hover();
  await page.locator('.btn-download-note').click();

  const started = page.waitForEvent('download');

  await page.locator(`.note-export-option[data-format="${format}"]`).click();

  return started;
}

test.describe('Exportar nota', () => {
  test('o botao de download oferece os tres formatos', async ({ page }) => {
    await seed(page, 'k20-menu');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await page.locator('.note-card', { hasText: 'Nota exportável' }).hover();
    await page.locator('.btn-download-note').click();

    await expect(page.locator('.note-export-option')).toHaveText(['Markdown', 'Word (DOCX)', 'PDF']);
  });

  test('o markdown sai como markdown, nao como HTML', async ({ page }) => {
    await seed(page, 'k20-md');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    const file = await download(page, 'md');

    expect(file.suggestedFilename()).toBe('Nota exportável.md');

    const stream = await file.createReadStream();
    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    const text = Buffer.concat(chunks).toString('utf8');

    expect(text).toContain('## Seção');
    expect(text).toContain('**negrito**');
    expect(text).toContain('-   um');
    expect(text).not.toContain('<p>');
  });

  test('o docx sai com a extensao e o cabecalho de zip', async ({ page }) => {
    await seed(page, 'k20-docx');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    const file = await download(page, 'docx');

    expect(file.suggestedFilename()).toBe('Nota exportável.docx');

    const stream = await file.createReadStream();
    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    expect(Buffer.concat(chunks).subarray(0, 2).toString('latin1')).toBe('PK');
  });

  test('o pdf sai com a extensao e o cabecalho de pdf', async ({ page }) => {
    await seed(page, 'k20-pdf');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    const file = await download(page, 'pdf');

    expect(file.suggestedFilename()).toBe('Nota exportável.pdf');

    const stream = await file.createReadStream();
    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    expect(Buffer.concat(chunks).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('nota com corpo em texto solto (sem elemento) preserva o conteudo no docx e no pdf', async ({
    page,
  }) => {
    await signUp(page, newAccount('k20-texto-solto'));
    const workspace = await createWorkspace(page, 'Workspace k20-texto-solto');

    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota texto solto',
      body: 'Uma linha sem elemento',
    });

    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await page.locator('.note-card', { hasText: 'Nota texto solto' }).hover();
    await page.locator('.btn-download-note').click();

    const docxStarted = page.waitForEvent('download');
    await page.locator('.note-export-option[data-format="docx"]').click();
    const docxBuffer = await bufferOf(await docxStarted);
    const documentXml = readZipEntry(docxBuffer, 'word/document.xml').toString('utf8');

    expect(documentXml).toContain('Uma linha sem elemento');

    await page.locator('.note-card', { hasText: 'Nota texto solto' }).hover();
    await page.locator('.btn-download-note').click();

    const pdfStarted = page.waitForEvent('download');
    await page.locator('.note-export-option[data-format="pdf"]').click();
    const pdfBuffer = await bufferOf(await pdfStarted);

    expect(pdfTextStrings(pdfBuffer)).toContain('Uma linha sem elemento');
  });

  test('lista numerada sai numerada, distinta da lista com marcador, no docx e no pdf', async ({
    page,
  }) => {
    await signUp(page, newAccount('k20-listas'));
    const workspace = await createWorkspace(page, 'Workspace k20-listas');

    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota lista numerada',
      body: '<ol><li>Primeiro</li><li>Segundo</li></ol>',
    });
    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota lista marcada',
      body: '<ul><li>Primeiro</li><li>Segundo</li></ul>',
    });

    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    async function downloadFrom(title, format) {
      const card = page.locator('.note-card', { hasText: title });

      await card.hover();
      await card.locator('.btn-download-note').click();

      const started = page.waitForEvent('download');
      await card.locator(`.note-export-option[data-format="${format}"]`).click();

      return bufferOf(await started);
    }

    const downloadDocx = (title) => downloadFrom(title, 'docx');
    const downloadPdf = (title) => downloadFrom(title, 'pdf');

    const numberedDocx = await downloadDocx('Nota lista numerada');
    const numberedDocumentXml = readZipEntry(numberedDocx, 'word/document.xml').toString('utf8');
    const numberedNumberingXml = readZipEntry(numberedDocx, 'word/numbering.xml').toString('utf8');
    const numberedNumId = numberedDocumentXml.match(/<w:numId w:val="(\d+)"/)[1];

    expect(numFormatFor(numberedNumberingXml, numberedNumId)).toBe('decimal');

    const bulletedDocx = await downloadDocx('Nota lista marcada');
    const bulletedDocumentXml = readZipEntry(bulletedDocx, 'word/document.xml').toString('utf8');
    const bulletedNumberingXml = readZipEntry(bulletedDocx, 'word/numbering.xml').toString('utf8');
    const bulletedNumId = bulletedDocumentXml.match(/<w:numId w:val="(\d+)"/)[1];

    expect(numFormatFor(bulletedNumberingXml, bulletedNumId)).toBe('bullet');

    const numberedPdf = await downloadPdf('Nota lista numerada');
    const numberedStrings = pdfTextStrings(numberedPdf);

    expect(numberedStrings).toContain('1. Primeiro');
    expect(numberedStrings).toContain('2. Segundo');

    const bulletedPdf = await downloadPdf('Nota lista marcada');
    const bulletedStrings = pdfTextStrings(bulletedPdf);

    expect(bulletedStrings.some((s) => s.includes('Primeiro'))).toBe(true);
    expect(bulletedStrings.some((s) => /^\s*1[.)]\s/.test(s))).toBe(false);
  });
});
