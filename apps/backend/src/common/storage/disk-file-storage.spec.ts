import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiskFileStorage } from './disk-file-storage';

describe('DiskFileStorage', () => {
  const root = join(tmpdir(), `fluxo-vault-${randomUUID()}`);
  const storage = new DiskFileStorage(root);

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('grava o arquivo sob uma chave gerada e devolve o tamanho', async () => {
    const stored = await storage.save('workspace-1', {
      originalName: 'arquitetura.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('conteudo'),
    });

    expect(stored.sizeBytes).toBe(8);
    expect(stored.storageKey).toMatch(/^workspace-1\/[0-9a-f-]{36}\.pdf$/);
  });

  it('ignora o nome enviado pelo usuário ao formar o caminho', async () => {
    const stored = await storage.save('workspace-1', {
      originalName: '../../../etc/passwd',
      mimeType: 'text/plain',
      buffer: Buffer.from('x'),
    });

    expect(stored.storageKey).not.toContain('..');
    expect(stored.storageKey.startsWith('workspace-1/')).toBe(true);
  });

  it('lê de volta o conteúdo gravado', async () => {
    const stored = await storage.save('workspace-1', {
      originalName: 'leitura.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('conteudo lido'),
    });

    const chunks: Buffer[] = [];

    for await (const chunk of storage.read(stored.storageKey)) {
      chunks.push(Buffer.from(chunk as Buffer));
    }

    expect(Buffer.concat(chunks).toString()).toBe('conteudo lido');
  });

  it('remove o arquivo gravado', async () => {
    const stored = await storage.save('workspace-1', {
      originalName: 'nota.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('x'),
    });

    await storage.remove(stored.storageKey);

    expect(existsSync(join(root, stored.storageKey))).toBe(false);
  });

  it('propaga a falha ao remover um arquivo que não existe', async () => {
    await expect(storage.remove('workspace-1/inexistente.txt')).rejects.toThrow();
  });
});
